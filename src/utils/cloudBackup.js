/**
 * cloudBackup.js
 * Handles all Google Drive backup/restore operations.
 * Uses the appDataFolder scope — data is private to this app only.
 */

const BACKUP_FILENAME = 'motolog_backup.json';
const BACKUP_VERSION = 2;

// ─── Drive API Helpers ────────────────────────────────────────────────────────

const driveHeaders = (accessToken) => ({
  Authorization: `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
});

/**
 * Find the backup file ID in appDataFolder.
 * Returns null if not found.
 */
export const findBackupFile = async (accessToken) => {
  const url =
    `https://www.googleapis.com/drive/v3/files` +
    `?spaces=appDataFolder&q=name='${BACKUP_FILENAME}'&fields=files(id,modifiedTime,size)`;

  const res = await fetch(url, { headers: driveHeaders(accessToken) });
  if (!res.ok) throw new Error(`Drive list failed: ${res.status}`);
  const data = await res.json();
  return data.files?.[0] || null;
};

/**
 * Upload (create or update) the backup JSON to Drive appDataFolder.
 */
export const uploadBackup = async (accessToken, payload) => {
  const json = JSON.stringify(payload);
  const blob = new Blob([json], { type: 'application/json' });

  // Check if file exists already
  const existing = await findBackupFile(accessToken);

  if (existing) {
    // PATCH (update content)
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: json,
      }
    );
    if (!res.ok) throw new Error(`Drive update failed: ${res.status}`);
    return await res.json();
  } else {
    // POST (create new)
    const metadata = {
      name: BACKUP_FILENAME,
      parents: ['appDataFolder'],
      mimeType: 'application/json',
    };

    const form = new FormData();
    form.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' })
    );
    form.append('file', blob);

    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      }
    );
    if (!res.ok) throw new Error(`Drive upload failed: ${res.status}`);
    return await res.json();
  }
};

/**
 * Download and parse the backup JSON from Drive.
 */
export const downloadBackup = async (accessToken) => {
  const file = await findBackupFile(accessToken);
  if (!file) return null;

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`Drive download failed: ${res.status}`);
  const data = await res.json();
  return { ...data, _meta: file };
};

// ─── Backup Payload Builder ───────────────────────────────────────────────────

/**
 * Build a complete backup object from db functions.
 */
export const buildBackupPayload = (db) => {
  const {
    getBikes, getSettings, getFuelLogs, getExpenses,
    getServiceReminders, getTrips,
  } = db;

  const bikes = getBikes();
  const settings = getSettings();
  const bikeIds = bikes.map((b) => b.id);

  const fuelLogs = [];
  const expenses = [];
  const reminders = [];
  const trips = [];

  for (const id of bikeIds) {
    fuelLogs.push(...getFuelLogs(id, 9999));
    expenses.push(...getExpenses(id, 9999));
    reminders.push(...getServiceReminders(id));
    trips.push(...getTrips(id, 9999));
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

// ─── Restore Logic ────────────────────────────────────────────────────────────

/**
 * Restore all data from backup payload into the local SQLite db.
 * Uses the raw db handle for bulk inserts.
 */
export const restoreFromPayload = (dbHandle, payload) => {
  if (!payload || !payload.bikes) throw new Error('Invalid backup data');

  const db = dbHandle;

  // Wipe existing data
  db.execSync('DELETE FROM trips');
  db.execSync('DELETE FROM service_reminders');
  db.execSync('DELETE FROM expenses');
  db.execSync('DELETE FROM fuel_logs');
  db.execSync('DELETE FROM bikes');

  // Restore bikes
  for (const b of payload.bikes) {
    db.runSync(
      'INSERT OR REPLACE INTO bikes (id, bike_name, tank_capacity, notes, created_at) VALUES (?,?,?,?,?)',
      [b.id, b.bike_name, b.tank_capacity, b.notes || '', b.created_at || new Date().toISOString()]
    );
  }

  // Restore settings (keep id=1)
  if (payload.settings) {
    const s = payload.settings;
    db.runSync(
      'UPDATE settings SET fuel_price=?, currency=?, default_bike_id=?, theme=?',
      [s.fuel_price, s.currency, s.default_bike_id, s.theme || 'dark']
    );
  }

  // Restore fuel logs
  for (const f of payload.fuelLogs) {
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

  // Restore expenses
  for (const e of payload.expenses) {
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

  // Restore service reminders
  for (const r of payload.reminders) {
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

  // Restore trips
  for (const t of payload.trips) {
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

  return {
    bikes: payload.bikes.length,
    fuelLogs: payload.fuelLogs.length,
    expenses: payload.expenses.length,
    reminders: payload.reminders.length,
    trips: payload.trips.length,
  };
};
