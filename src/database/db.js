import * as SQLite from 'expo-sqlite';

let _db = null;

const getDb = () => {
  if (!_db) {
    _db = SQLite.openDatabaseSync('bike_expense.db');
    initSchema(_db);
  }
  return _db;
};

const initSchema = (db) => {
  db.execSync(`PRAGMA journal_mode = WAL;`);
  db.execSync(`
    CREATE TABLE IF NOT EXISTS bikes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bike_name TEXT NOT NULL,
      tank_capacity REAL DEFAULT 12,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  db.execSync(`
    CREATE TABLE IF NOT EXISTS fuel_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bike_id INTEGER DEFAULT 1,
      date TEXT NOT NULL,
      litres REAL NOT NULL,
      price_per_litre REAL NOT NULL,
      total_cost REAL NOT NULL,
      odometer REAL NOT NULL,
      station_name TEXT,
      notes TEXT,
      ride_tag TEXT DEFAULT 'personal',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  db.execSync(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bike_id INTEGER DEFAULT 1,
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      cost REAL NOT NULL,
      notes TEXT,
      ride_tag TEXT DEFAULT 'personal',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  db.execSync(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fuel_price REAL DEFAULT 108,
      currency TEXT DEFAULT 'BDT',
      default_bike_id INTEGER DEFAULT 1,
      theme TEXT DEFAULT 'dark'
    );
  `);
  db.execSync(`
    CREATE TABLE IF NOT EXISTS service_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bike_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      interval_km REAL NOT NULL,
      last_service_km REAL DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  db.execSync(`
    CREATE TABLE IF NOT EXISTS trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bike_id INTEGER DEFAULT 1,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      start_odometer REAL NOT NULL,
      end_odometer REAL,
      notes TEXT,
      ride_tag TEXT DEFAULT 'personal',
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migrations
  try { db.execSync(`ALTER TABLE fuel_logs ADD COLUMN ride_tag TEXT DEFAULT 'personal';`); } catch (_) {}
  try { db.execSync(`ALTER TABLE expenses ADD COLUMN ride_tag TEXT DEFAULT 'personal';`); } catch (_) {}
  try { db.execSync(`ALTER TABLE settings ADD COLUMN theme TEXT DEFAULT 'dark';`); } catch (_) {}

  const bikeCount = db.getFirstSync('SELECT COUNT(*) as cnt FROM bikes');
  if (bikeCount.cnt === 0) {
    db.runSync('INSERT INTO bikes (bike_name, tank_capacity) VALUES (?, ?)', ['My Motorcycle', 12]);
  }
  const settingsCount = db.getFirstSync('SELECT COUNT(*) as cnt FROM settings');
  if (settingsCount.cnt === 0) {
    db.runSync('INSERT INTO settings (fuel_price, currency, default_bike_id, theme) VALUES (?, ?, ?, ?)', [108, 'BDT', 1, 'dark']);
  }
};

// ─── Settings ────────────────────────────────────────────────────────────────

export const getSettings = () => {
  return getDb().getFirstSync('SELECT * FROM settings LIMIT 1') || { fuel_price: 108, currency: 'BDT', default_bike_id: 1, theme: 'dark' };
};

export const updateSettings = (fuelPrice, currency, defaultBikeId, theme) => {
  getDb().runSync(
    'UPDATE settings SET fuel_price = ?, currency = ?, default_bike_id = ?, theme = ?',
    [fuelPrice, currency, defaultBikeId || 1, theme || 'dark']
  );
};

export const getTheme = () => (getSettings().theme || 'dark');
export const setTheme = (theme) => getDb().runSync('UPDATE settings SET theme = ?', [theme]);

// ─── Bikes ────────────────────────────────────────────────────────────────────

export const getBikes = () => getDb().getAllSync('SELECT * FROM bikes ORDER BY created_at ASC');

export const addBike = (bikeName, tankCapacity, notes) => {
  const result = getDb().runSync(
    'INSERT INTO bikes (bike_name, tank_capacity, notes) VALUES (?, ?, ?)',
    [bikeName, tankCapacity, notes || '']
  );
  return result.lastInsertRowId;
};

export const deleteBike = (id) => {
  const db = getDb();
  db.runSync('DELETE FROM bikes WHERE id = ?', [id]);
  db.runSync('DELETE FROM fuel_logs WHERE bike_id = ?', [id]);
  db.runSync('DELETE FROM expenses WHERE bike_id = ?', [id]);
  db.runSync('DELETE FROM service_reminders WHERE bike_id = ?', [id]);
  db.runSync('DELETE FROM trips WHERE bike_id = ?', [id]);
};

export const setDefaultBike = (bikeId) => getDb().runSync('UPDATE settings SET default_bike_id = ?', [bikeId]);

export const getDefaultBikeId = () => (getSettings().default_bike_id || 1);

// ─── Fuel Logs ────────────────────────────────────────────────────────────────

export const addFuelLog = ({ bikeId, date, litres, pricePerLitre, totalCost, odometer, stationName, notes, rideTag }) => {
  const result = getDb().runSync(
    `INSERT INTO fuel_logs (bike_id, date, litres, price_per_litre, total_cost, odometer, station_name, notes, ride_tag)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [bikeId || 1, date, litres, pricePerLitre, totalCost, odometer, stationName || '', notes || '', rideTag || 'personal']
  );
  return result.lastInsertRowId;
};

export const updateFuelLog = ({ id, date, litres, pricePerLitre, totalCost, odometer, stationName, notes, rideTag }) => {
  getDb().runSync(
    `UPDATE fuel_logs SET date=?, litres=?, price_per_litre=?, total_cost=?, odometer=?, station_name=?, notes=?, ride_tag=? WHERE id=?`,
    [date, litres, pricePerLitre, totalCost, odometer, stationName || '', notes || '', rideTag || 'personal', id]
  );
};

export const getFuelLogById = (id) => getDb().getFirstSync('SELECT * FROM fuel_logs WHERE id = ?', [id]) || null;

export const getFuelLogs = (bikeId = 1, limit = 100) => {
  return getDb().getAllSync(
    'SELECT * FROM fuel_logs WHERE bike_id = ? ORDER BY date DESC, created_at DESC LIMIT ?',
    [bikeId, limit]
  );
};

export const getLastFuelLog = (bikeId = 1) => {
  return getDb().getFirstSync(
    'SELECT * FROM fuel_logs WHERE bike_id = ? ORDER BY odometer DESC LIMIT 1',
    [bikeId]
  ) || null;
};

export const getLastOdometer = (bikeId = 1) => {
  const row = getDb().getFirstSync(
    'SELECT odometer FROM fuel_logs WHERE bike_id = ? ORDER BY odometer DESC LIMIT 1',
    [bikeId]
  );
  return row?.odometer || 0;
};

export const deleteFuelLog = (id) => getDb().runSync('DELETE FROM fuel_logs WHERE id = ?', [id]);

// ─── Station Mileage Tracking ─────────────────────────────────────────────────

export const getStationStats = (bikeId = 1) => {
  const db = getDb();
  const logs = db.getAllSync(
    `SELECT * FROM fuel_logs WHERE bike_id = ? AND station_name != '' ORDER BY odometer ASC`,
    [bikeId]
  );
  const stationMap = {};
  for (let i = 1; i < logs.length; i++) {
    const prev = logs[i - 1];
    const curr = logs[i];
    const dist = curr.odometer - prev.odometer;
    const mileage = curr.litres > 0 ? dist / curr.litres : 0;
    if (mileage > 5 && mileage < 120) {
      const name = curr.station_name;
      if (!stationMap[name]) stationMap[name] = { name, fills: 0, totalMileage: 0, avgMileage: 0 };
      stationMap[name].fills++;
      stationMap[name].totalMileage += mileage;
    }
  }
  return Object.values(stationMap).map(s => ({
    ...s,
    avgMileage: s.fills > 0 ? s.totalMileage / s.fills : 0,
  })).sort((a, b) => b.avgMileage - a.avgMileage);
};

// ─── Expenses ─────────────────────────────────────────────────────────────────

export const addExpense = ({ bikeId, date, category, cost, notes, rideTag }) => {
  const result = getDb().runSync(
    'INSERT INTO expenses (bike_id, date, category, cost, notes, ride_tag) VALUES (?, ?, ?, ?, ?, ?)',
    [bikeId || 1, date, category, cost, notes || '', rideTag || 'personal']
  );
  return result.lastInsertRowId;
};

export const updateExpense = ({ id, date, category, cost, notes, rideTag }) => {
  getDb().runSync(
    `UPDATE expenses SET date=?, category=?, cost=?, notes=?, ride_tag=? WHERE id=?`,
    [date, category, cost, notes || '', rideTag || 'personal', id]
  );
};

export const getExpenseById = (id) => getDb().getFirstSync('SELECT * FROM expenses WHERE id = ?', [id]) || null;

export const getExpenses = (bikeId = 1, limit = 100) => {
  return getDb().getAllSync(
    'SELECT * FROM expenses WHERE bike_id = ? ORDER BY date DESC, created_at DESC LIMIT ?',
    [bikeId, limit]
  );
};

export const deleteExpense = (id) => getDb().runSync('DELETE FROM expenses WHERE id = ?', [id]);

// ─── Service Reminders ────────────────────────────────────────────────────────

export const getServiceReminders = (bikeId = 1) => {
  return getDb().getAllSync(
    'SELECT * FROM service_reminders WHERE bike_id = ? ORDER BY created_at ASC',
    [bikeId]
  );
};

export const addServiceReminder = ({ bikeId, title, intervalKm, lastServiceKm, notes }) => {
  const result = getDb().runSync(
    'INSERT INTO service_reminders (bike_id, title, interval_km, last_service_km, notes) VALUES (?, ?, ?, ?, ?)',
    [bikeId || 1, title, intervalKm, lastServiceKm || 0, notes || '']
  );
  return result.lastInsertRowId;
};

export const updateReminderServiceKm = (id, newKm) => {
  getDb().runSync('UPDATE service_reminders SET last_service_km = ? WHERE id = ?', [newKm, id]);
};

export const deleteServiceReminder = (id) => getDb().runSync('DELETE FROM service_reminders WHERE id = ?', [id]);

// ─── Trips ────────────────────────────────────────────────────────────────────

export const addTrip = ({ bikeId, title, date, startOdometer, notes, rideTag }) => {
  const result = getDb().runSync(
    `INSERT INTO trips (bike_id, title, date, start_odometer, notes, ride_tag, status) VALUES (?, ?, ?, ?, ?, ?, 'active')`,
    [bikeId || 1, title, date, startOdometer, notes || '', rideTag || 'personal']
  );
  return result.lastInsertRowId;
};

export const endTrip = (id, endOdometer) => {
  getDb().runSync(
    `UPDATE trips SET end_odometer = ?, status = 'completed' WHERE id = ?`,
    [endOdometer, id]
  );
};

export const getTrips = (bikeId = 1, limit = 100) => {
  return getDb().getAllSync(
    'SELECT * FROM trips WHERE bike_id = ? ORDER BY created_at DESC LIMIT ?',
    [bikeId, limit]
  );
};

export const getActiveTrip = (bikeId = 1) => {
  return getDb().getFirstSync(
    `SELECT * FROM trips WHERE bike_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
    [bikeId]
  ) || null;
};

export const deleteTrip = (id) => getDb().runSync('DELETE FROM trips WHERE id = ?', [id]);

// ─── Monthly Stats ────────────────────────────────────────────────────────────

export const getMonthlyStats = (bikeId = 1, year, month) => {
  const db = getDb();
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;

  const fuel = db.getFirstSync(
    `SELECT SUM(litres) as total_litres, SUM(total_cost) as total_fuel_cost,
            MIN(odometer) as min_odo, MAX(odometer) as max_odo
     FROM fuel_logs WHERE bike_id = ? AND date LIKE ?`,
    [bikeId, `${monthStr}%`]
  ) || {};

  const expense = db.getFirstSync(
    `SELECT SUM(cost) as total_maintenance FROM expenses WHERE bike_id = ? AND date LIKE ?`,
    [bikeId, `${monthStr}%`]
  ) || {};

  const totalFuelCost = fuel.total_fuel_cost || 0;
  const totalMaintenance = expense.total_maintenance || 0;
  const totalLitres = fuel.total_litres || 0;
  const distance = (fuel.max_odo && fuel.min_odo) ? (fuel.max_odo - fuel.min_odo) : 0;
  const mileage = totalLitres > 0 && distance > 0 ? distance / totalLitres : 0;
  const costPerKm = distance > 0 ? (totalFuelCost + totalMaintenance) / distance : 0;

  return { totalFuelCost, totalMaintenance, totalCost: totalFuelCost + totalMaintenance, totalLitres, distance, mileage, costPerKm };
};

// ─── Tag Stats ────────────────────────────────────────────────────────────────

export const getTagStats = (bikeId = 1, year, month) => {
  const db = getDb();
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;

  const fuelByTag = db.getAllSync(
    `SELECT ride_tag, SUM(total_cost) as cost, SUM(litres) as litres
     FROM fuel_logs WHERE bike_id = ? AND date LIKE ?
     GROUP BY ride_tag`,
    [bikeId, `${monthStr}%`]
  );
  const expByTag = db.getAllSync(
    `SELECT ride_tag, SUM(cost) as cost
     FROM expenses WHERE bike_id = ? AND date LIKE ?
     GROUP BY ride_tag`,
    [bikeId, `${monthStr}%`]
  );

  const tags = {};
  for (const row of fuelByTag) {
    if (!tags[row.ride_tag]) tags[row.ride_tag] = { tag: row.ride_tag, fuelCost: 0, expCost: 0, litres: 0 };
    tags[row.ride_tag].fuelCost += row.cost || 0;
    tags[row.ride_tag].litres += row.litres || 0;
  }
  for (const row of expByTag) {
    if (!tags[row.ride_tag]) tags[row.ride_tag] = { tag: row.ride_tag, fuelCost: 0, expCost: 0, litres: 0 };
    tags[row.ride_tag].expCost += row.cost || 0;
  }
  return Object.values(tags).map(t => ({ ...t, totalCost: t.fuelCost + t.expCost }));
};

// ─── Export CSV ───────────────────────────────────────────────────────────────

export const getAllDataForExport = (bikeId = 1) => {
  const db = getDb();
  const fuelLogs = db.getAllSync('SELECT * FROM fuel_logs WHERE bike_id = ? ORDER BY date DESC', [bikeId]);
  const expenses = db.getAllSync('SELECT * FROM expenses WHERE bike_id = ? ORDER BY date DESC', [bikeId]);
  return { fuelLogs, expenses };
};
