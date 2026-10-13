/**
 * CSV export/import — round-trip compatible format for MotoLog.
 *
 * Format (v2):
 *   # MotoLog CSV v2
 *   # bike_id,<id>
 *   # bike_name,<name>
 *
 *   type,date,litres,price_per_litre,total_cost,odometer,station_name,notes,ride_tag,remaining_fuel,category,cost
 *   fuel,...
 *   expense,...
 */

const CSV_VERSION = 2;
const HEADER =
  'type,date,litres,price_per_litre,total_cost,odometer,station_name,notes,ride_tag,remaining_fuel,category,cost';

const escapeCsv = (value) => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
};

const parseCsvRecords = (text) => {
  const records = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        value += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        value += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(value);
      value = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(value);
      records.push(row);
      row = [];
      value = '';
    } else {
      value += char;
    }
  }
  if (inQuotes) throw new Error('CSV contains an unclosed quoted value');
  if (value || row.length > 0) {
    row.push(value);
    records.push(row);
  }
  return records;
};

const isValidDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '');
const positiveNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};
const nonNegativeNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};

export const buildCsvString = ({ bikeId, bikeName, fuelLogs = [], expenses = [] }) => {
  const lines = [
    `# MotoLog CSV v${CSV_VERSION}`,
    `# bike_id,${bikeId ?? ''}`,
    `# bike_name,${escapeCsv(bikeName || 'Unknown')}`,
    '',
    HEADER,
  ];

  for (const log of fuelLogs) {
    lines.push([
      'fuel',
      log.date || '',
      log.litres ?? '',
      log.price_per_litre ?? '',
      log.total_cost ?? '',
      log.odometer ?? '',
      escapeCsv(log.station_name || ''),
      escapeCsv(log.notes || ''),
      log.ride_tag || 'personal',
      log.remaining_fuel ?? 0,
      '',
      '',
    ].join(','));
  }

  for (const exp of expenses) {
    lines.push([
      'expense',
      exp.date || '',
      '',
      '',
      '',
      '',
      '',
      escapeCsv(exp.notes || ''),
      exp.ride_tag || 'personal',
      '',
      escapeCsv(exp.category || 'others'),
      exp.cost ?? '',
    ].join(','));
  }

  return lines.join('\n');
};

/**
 * Parse either the new unified CSV or the legacy Share-based export format.
 */
export const parseCsvString = (raw) => {
  if (!raw || typeof raw !== 'string') throw new Error('Empty CSV');

  const text = raw.replace(/^\uFEFF/, '');
  const records = parseCsvRecords(text);

  let bikeId = null;
  let bikeName = null;
  let mode = null; // 'unified' | 'legacy_fuel' | 'legacy_expense'
  let headers = null;
  const fuelLogs = [];
  const expenses = [];

  for (const cols of records) {
    const line = cols.join(',').trim();
    if (!line) continue;

    if (line.startsWith('#')) {
      const metaKey = (cols[0] || '').replace(/^#\s*/, '').toLowerCase();
      if (metaKey === 'bike_id') {
        bikeId = Number.parseInt(cols[1], 10) || null;
      } else if (metaKey === 'bike_name') {
        bikeName = cols[1] || null;
      }
      continue;
    }

    // Legacy section markers
    if (/^FUEL LOGS$/i.test(line)) {
      mode = 'legacy_fuel_header';
      continue;
    }
    if (/^EXPENSES$/i.test(line)) {
      mode = 'legacy_expense_header';
      continue;
    }
    if (/^MotoLog Export/i.test(line) || /^Bike:/i.test(line)) continue;

    // Some spreadsheet tools remove the MotoLog section labels but preserve
    // the column headers. Accept those files as well.
    if (cols[0]?.trim().toLowerCase() === 'date') {
      const headerColumns = cols.map((column) => column.trim().toLowerCase());
      if (headerColumns.includes('litres') && headerColumns.includes('odometer')) {
        mode = 'legacy_fuel';
        continue;
      }
      if (headerColumns.includes('category') && headerColumns.includes('cost')) {
        mode = 'legacy_expense';
        continue;
      }
    }

    if (mode === 'legacy_fuel_header') {
      mode = 'legacy_fuel';
      continue;
    }
    if (mode === 'legacy_expense_header') {
      mode = 'legacy_expense';
      continue;
    }

    // Unified header
    if (!headers && cols[0]?.toLowerCase() === 'type') {
      headers = cols.map((h) => h.trim().toLowerCase());
      mode = 'unified';
      continue;
    }

    if (mode === 'unified' && headers) {
      const row = {};
      headers.forEach((h, i) => {
        row[h] = cols[i] ?? '';
      });
      const type = (row.type || '').toLowerCase();
      if (type === 'fuel') {
        const litres = positiveNumber(row.litres);
        const odometer = nonNegativeNumber(row.odometer);
        if (!isValidDate(row.date) || litres === null || odometer === null) continue;
        const totalCost = nonNegativeNumber(row.total_cost);
        const price = nonNegativeNumber(row.price_per_litre);
        fuelLogs.push({
          date: row.date,
          litres,
          price_per_litre: price ?? (totalCost !== null ? totalCost / litres : 0),
          total_cost: totalCost ?? (price !== null ? price * litres : 0),
          odometer,
          station_name: row.station_name || '',
          notes: row.notes || '',
          ride_tag: row.ride_tag || 'personal',
          remaining_fuel: nonNegativeNumber(row.remaining_fuel) ?? 0,
        });
      } else if (type === 'expense') {
        const cost = positiveNumber(row.cost);
        if (!isValidDate(row.date) || cost === null) continue;
        expenses.push({
          date: row.date,
          category: row.category || 'others',
          cost,
          notes: row.notes || '',
          ride_tag: row.ride_tag || 'personal',
        });
      }
      continue;
    }

    if (mode === 'legacy_fuel' && cols.length >= 5) {
      const litres = positiveNumber(cols[1]);
      const odometer = nonNegativeNumber(cols[4]);
      if (!isValidDate(cols[0]) || litres === null || odometer === null) continue;
      const totalCost = nonNegativeNumber(cols[3]);
      const price = nonNegativeNumber(cols[2]);
      fuelLogs.push({
        date: cols[0],
        litres,
        price_per_litre: price ?? (totalCost !== null ? totalCost / litres : 0),
        total_cost: totalCost ?? (price !== null ? price * litres : 0),
        odometer,
        station_name: cols[5] || '',
        notes: cols[6] || '',
        ride_tag: cols[7] || 'personal',
        remaining_fuel: 0,
      });
      continue;
    }

    if (mode === 'legacy_expense' && cols.length >= 3) {
      const cost = positiveNumber(cols[2]);
      if (!isValidDate(cols[0]) || cost === null) continue;
      expenses.push({
        date: cols[0],
        category: cols[1] || 'others',
        cost,
        notes: cols[3] || '',
        ride_tag: cols[4] || 'personal',
      });
    }
  }

  if (fuelLogs.length === 0 && expenses.length === 0) {
    throw new Error('No fuel or expense rows found in CSV');
  }

  return { bikeId, bikeName, fuelLogs, expenses };
};
