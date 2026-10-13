/**
 * cloudBackup.js
 * Google Drive backup/restore using appDataFolder (private to this app).
 * Avoids Blob/FormData multipart which is unreliable in React Native Hermes.
 */

const BACKUP_FILENAME = 'motolog_backup.json';
const BACKUP_VERSION = 2;

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
  if (!payload || !Array.isArray(payload.bikes) || payload.bikes.length === 0) {
    throw new Error('Invalid backup data');
  }

  const db = dbHandle;
  const bikes = payload.bikes.filter((bike) => bike && bike.id && bike.bike_name);
  if (bikes.length !== payload.bikes.length) throw new Error('Backup contains an invalid bike');

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

    const restoredBikeIds = new Set(bikes.map((bike) => bike.id));
    const defaultBikeId = restoredBikeIds.has(payload.settings?.default_bike_id)
      ? payload.settings.default_bike_id
      : bikes[0].id;

    if (payload.settings) {
      const s = payload.settings;
      db.runSync(
        'UPDATE settings SET fuel_price=?, currency=?, default_bike_id=?, theme=?',
        [s.fuel_price || 108, s.currency || 'BDT', defaultBikeId, s.theme || 'dark']
      );
    } else {
      db.runSync('UPDATE settings SET default_bike_id = ?', [defaultBikeId]);
    }

    for (const f of payload.fuelLogs || []) {
      if (!restoredBikeIds.has(f.bike_id)) continue;
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

    for (const e of payload.expenses || []) {
      if (!restoredBikeIds.has(e.bike_id)) continue;
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

    for (const r of payload.reminders || []) {
      if (!restoredBikeIds.has(r.bike_id)) continue;
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

    for (const t of payload.trips || []) {
      if (!restoredBikeIds.has(t.bike_id)) continue;
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
    bikes: payload.bikes.length,
    fuelLogs: (payload.fuelLogs || []).length,
    expenses: (payload.expenses || []).length,
    reminders: (payload.reminders || []).length,
    trips: (payload.trips || []).length,
  };
};
