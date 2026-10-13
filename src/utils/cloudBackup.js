/**
 * cloudBackup.js
 * Google Drive backup/restore using appDataFolder (private to this app).
 * Avoids Blob/FormData multipart which is unreliable in React Native Hermes.
 */

const BACKUP_FILENAME = 'motolog_backup.json';
const BACKUP_VERSION = 2;

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const numberOr = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};
const positiveNumberOr = (value, fallback) => {
  const number = numberOr(value, fallback);
  return number > 0 ? number : fallback;
};
const positiveIntegerOrNull = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
};
const validDate = (value) => {
  const text = String(value || '');
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3])
    ? text
    : null;
};
const textOrEmpty = (value) => (value === null || value === undefined ? '' : String(value));

/**
 * Normalizes data downloaded from Drive before any destructive database work.
 * Older backups can contain strings for numeric SQLite columns; malformed child
 * records are skipped rather than allowed to crash a later render.
 */
export const normalizeBackupPayload = (payload) => {
  if (!isObject(payload) || !Array.isArray(payload.bikes) || payload.bikes.length === 0) {
    throw new Error('Invalid backup data');
  }

  const bikes = payload.bikes.map((bike) => {
    if (!isObject(bike)) throw new Error('Backup contains an invalid bike');
    const id = positiveIntegerOrNull(bike.id);
    const bikeName = textOrEmpty(bike.bike_name).trim();
    if (!id || !bikeName) throw new Error('Backup contains an invalid bike');
    return {
      id,
      bike_name: bikeName,
      tank_capacity: positiveNumberOr(bike.tank_capacity, 12),
      notes: textOrEmpty(bike.notes),
      created_at: textOrEmpty(bike.created_at) || new Date().toISOString(),
    };
  });
  const bikeIds = new Set(bikes.map((bike) => bike.id));
  if (bikeIds.size !== bikes.length) throw new Error('Backup contains duplicate bike IDs');

  const requestedDefaultBikeId = positiveIntegerOrNull(payload.settings?.default_bike_id);
  const defaultBikeId = bikeIds.has(requestedDefaultBikeId) ? requestedDefaultBikeId : bikes[0].id;
  const settings = {
    fuel_price: positiveNumberOr(payload.settings?.fuel_price, 108),
    currency: textOrEmpty(payload.settings?.currency).trim() || 'BDT',
    default_bike_id: defaultBikeId,
    theme: payload.settings?.theme === 'light' ? 'light' : 'dark',
  };
  const normalizeBikeId = (value) => {
    const bikeId = positiveIntegerOrNull(value) || defaultBikeId;
    return bikeIds.has(bikeId) ? bikeId : null;
  };
  const rows = (value) => Array.isArray(value) ? value : [];

  const fuelLogs = rows(payload.fuelLogs).flatMap((log) => {
    if (!isObject(log)) return [];
    const bikeId = normalizeBikeId(log.bike_id);
    const date = validDate(log.date);
    const litres = positiveNumberOr(log.litres, 0);
    const odometer = numberOr(log.odometer, -1);
    if (!bikeId || !date || litres <= 0 || odometer < 0) return [];
    const totalCost = numberOr(log.total_cost, 0);
    const price = numberOr(log.price_per_litre, totalCost > 0 ? totalCost / litres : 0);
    return [{
      id: positiveIntegerOrNull(log.id), bike_id: bikeId, date, litres,
      price_per_litre: Math.max(0, price), total_cost: Math.max(0, totalCost), odometer,
      station_name: textOrEmpty(log.station_name), notes: textOrEmpty(log.notes),
      ride_tag: textOrEmpty(log.ride_tag) || 'personal',
      remaining_fuel: Math.max(0, numberOr(log.remaining_fuel, 0)),
      created_at: textOrEmpty(log.created_at) || new Date().toISOString(),
    }];
  });
  const expenses = rows(payload.expenses).flatMap((expense) => {
    if (!isObject(expense)) return [];
    const bikeId = normalizeBikeId(expense.bike_id);
    const date = validDate(expense.date);
    const cost = positiveNumberOr(expense.cost, 0);
    if (!bikeId || !date || cost <= 0) return [];
    return [{
      id: positiveIntegerOrNull(expense.id), bike_id: bikeId, date, cost,
      category: textOrEmpty(expense.category) || 'others', notes: textOrEmpty(expense.notes),
      ride_tag: textOrEmpty(expense.ride_tag) || 'personal',
      created_at: textOrEmpty(expense.created_at) || new Date().toISOString(),
    }];
  });
  const reminders = rows(payload.reminders).flatMap((reminder) => {
    if (!isObject(reminder)) return [];
    const bikeId = normalizeBikeId(reminder.bike_id);
    const title = textOrEmpty(reminder.title).trim();
    const interval = positiveNumberOr(reminder.interval_km, 0);
    if (!bikeId || !title || interval <= 0) return [];
    return [{
      id: positiveIntegerOrNull(reminder.id), bike_id: bikeId, title,
      interval_km: interval, last_service_km: Math.max(0, numberOr(reminder.last_service_km, 0)),
      notes: textOrEmpty(reminder.notes), created_at: textOrEmpty(reminder.created_at) || new Date().toISOString(),
    }];
  });
  const trips = rows(payload.trips).flatMap((trip) => {
    if (!isObject(trip)) return [];
    const bikeId = normalizeBikeId(trip.bike_id);
    const title = textOrEmpty(trip.title).trim();
    const date = validDate(trip.date);
    const startOdometer = numberOr(trip.start_odometer, -1);
    const endOdometer = trip.end_odometer === null || trip.end_odometer === undefined || trip.end_odometer === ''
      ? null
      : numberOr(trip.end_odometer, -1);
    if (!bikeId || !title || !date || startOdometer < 0 || (endOdometer !== null && endOdometer < startOdometer)) return [];
    return [{
      id: positiveIntegerOrNull(trip.id), bike_id: bikeId, title, date,
      start_odometer: startOdometer, end_odometer: endOdometer,
      notes: textOrEmpty(trip.notes), ride_tag: textOrEmpty(trip.ride_tag) || 'personal',
      status: trip.status === 'active' ? 'active' : 'completed',
      avg_mileage: Math.max(0, numberOr(trip.avg_mileage, 0)),
      total_fuel_litres: Math.max(0, numberOr(trip.total_fuel_litres, 0)),
      total_fuel_cost: Math.max(0, numberOr(trip.total_fuel_cost, 0)),
      created_at: textOrEmpty(trip.created_at) || new Date().toISOString(),
    }];
  });

  return { bikes, settings, fuelLogs, expenses, reminders, trips };
};

const driveHeaders = (accessToken, extra = {}) => ({
  Authorization: `Bearer ${accessToken}`,
  ...extra,
});

/**
 * Find the backup file ID in appDataFolder.
 * Returns null if not found.
 */
export const findBackupFile = async (accessToken) => {
  if (!accessToken) throw new Error('Missing access token');

  const url =
    `https://www.googleapis.com/drive/v3/files` +
    `?spaces=appDataFolder&q=name='${BACKUP_FILENAME}'&orderBy=modifiedTime desc&fields=files(id,modifiedTime,size)`;

  const res = await fetch(url, { headers: driveHeaders(accessToken) });
  if (res.status === 401) throw new Error('Google session expired. Please sign in again.');
  if (!res.ok) throw new Error(`Drive list failed: ${res.status}`);
  const data = await res.json();
  return data.files?.[0] || null;
};

/**
 * Upload (create or update) the backup JSON to Drive appDataFolder.
 * Uses metadata create + media PATCH — no Blob required.
 */
export const uploadBackup = async (accessToken, payload) => {
  if (!accessToken) throw new Error('Missing access token');
  const json = JSON.stringify(payload);
  const existing = await findBackupFile(accessToken);

  if (existing?.id) {
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media`,
      {
        method: 'PATCH',
        headers: driveHeaders(accessToken, { 'Content-Type': 'application/json' }),
        body: json,
      }
    );
    if (res.status === 401) throw new Error('Google session expired. Please sign in again.');
    if (!res.ok) throw new Error(`Drive update failed: ${res.status}`);
    return await res.json();
  }

  // 1) Create empty file metadata in appDataFolder
  const metaRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: driveHeaders(accessToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      name: BACKUP_FILENAME,
      parents: ['appDataFolder'],
      mimeType: 'application/json',
    }),
  });
  if (metaRes.status === 401) throw new Error('Google session expired. Please sign in again.');
  if (!metaRes.ok) throw new Error(`Drive create failed: ${metaRes.status}`);
  const created = await metaRes.json();

  // 2) Upload content
  const contentRes = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${created.id}?uploadType=media`,
    {
      method: 'PATCH',
      headers: driveHeaders(accessToken, { 'Content-Type': 'application/json' }),
      body: json,
    }
  );
  if (!contentRes.ok) throw new Error(`Drive content upload failed: ${contentRes.status}`);
  return await contentRes.json();
};

/**
 * Download and parse the backup JSON from Drive.
 */
export const downloadBackup = async (accessToken) => {
  const file = await findBackupFile(accessToken);
  if (!file) return null;

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
    { headers: driveHeaders(accessToken) }
  );
  if (res.status === 401) throw new Error('Google session expired. Please sign in again.');
  if (!res.ok) throw new Error(`Drive download failed: ${res.status}`);
  const data = await res.json();
  return { ...data, _meta: file };
};

/**
 * Build a complete backup object from db functions.
 */
export const buildBackupPayload = (db) => {
  const {
    getBikes, getSettings, getFuelLogs, getExpenses,
    getServiceReminders, getTrips,
  } = db;

  const bikes = getBikes() || [];
  const settings = getSettings();
  const bikeIds = bikes.map((b) => b.id);

  const fuelLogs = [];
  const expenses = [];
  const reminders = [];
  const trips = [];

  for (const id of bikeIds) {
    // SQLite treats LIMIT -1 as unlimited; a backup must not silently omit
    // older records once a user passes an arbitrary row cap.
    fuelLogs.push(...(getFuelLogs(id, -1) || []));
    expenses.push(...(getExpenses(id, -1) || []));
    reminders.push(...(getServiceReminders(id) || []));
    trips.push(...(getTrips(id, -1) || []));
  }

  return {
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    settings,
    bikes,
    fuelLogs,
    expenses,
    reminders,
    trips,
  };
};

/**
 * Restore all data from backup payload into the local SQLite db.
 */
export const restoreFromPayload = (dbHandle, payload) => {
  const backup = normalizeBackupPayload(payload);
  const db = dbHandle;
  const { bikes, settings, fuelLogs, expenses, reminders, trips } = backup;

  db.execSync('BEGIN IMMEDIATE');
  try {
    db.execSync('DELETE FROM trips');
    db.execSync('DELETE FROM service_reminders');
    db.execSync('DELETE FROM expenses');
    db.execSync('DELETE FROM fuel_logs');
    db.execSync('DELETE FROM bikes');

    for (const b of bikes) {
      db.runSync(
        'INSERT OR REPLACE INTO bikes (id, bike_name, tank_capacity, notes, created_at) VALUES (?,?,?,?,?)',
        [b.id, b.bike_name, b.tank_capacity, b.notes || '', b.created_at || new Date().toISOString()]
      );
    }

    db.runSync(
      'UPDATE settings SET fuel_price=?, currency=?, default_bike_id=?, theme=?',
      [settings.fuel_price, settings.currency, settings.default_bike_id, settings.theme]
    );

    for (const f of fuelLogs) {
      db.runSync(
        `INSERT OR REPLACE INTO fuel_logs
        (id, bike_id, date, litres, price_per_litre, total_cost, odometer,
         station_name, notes, ride_tag, remaining_fuel, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        f.id, f.bike_id, f.date, f.litres, f.price_per_litre, f.total_cost,
        f.odometer, f.station_name || '', f.notes || '',
        f.ride_tag || 'personal', f.remaining_fuel || 0,
        f.created_at || new Date().toISOString(),
      ]
      );
    }

    for (const e of expenses) {
      db.runSync(
        `INSERT OR REPLACE INTO expenses
        (id, bike_id, date, category, cost, notes, ride_tag, created_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        e.id, e.bike_id, e.date, e.category, e.cost,
        e.notes || '', e.ride_tag || 'personal',
        e.created_at || new Date().toISOString(),
      ]
      );
    }

    for (const r of reminders) {
      db.runSync(
        `INSERT OR REPLACE INTO service_reminders
        (id, bike_id, title, interval_km, last_service_km, notes, created_at)
       VALUES (?,?,?,?,?,?,?)`,
      [
        r.id, r.bike_id, r.title, r.interval_km,
        r.last_service_km || 0, r.notes || '',
        r.created_at || new Date().toISOString(),
      ]
      );
    }

    for (const t of trips) {
      db.runSync(
        `INSERT OR REPLACE INTO trips
        (id, bike_id, title, date, start_odometer, end_odometer, notes,
         ride_tag, status, avg_mileage, total_fuel_litres, total_fuel_cost, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        t.id, t.bike_id, t.title, t.date, t.start_odometer,
        t.end_odometer || null, t.notes || '', t.ride_tag || 'personal',
        t.status || 'completed', t.avg_mileage || 0,
        t.total_fuel_litres || 0, t.total_fuel_cost || 0,
        t.created_at || new Date().toISOString(),
      ]
      );
    }

    db.execSync('COMMIT');
  } catch (error) {
    try { db.execSync('ROLLBACK'); } catch (_) {}
    throw error;
  }

  return {
    bikes: bikes.length,
    fuelLogs: fuelLogs.length,
    expenses: expenses.length,
    reminders: reminders.length,
    trips: trips.length,
  };
};
