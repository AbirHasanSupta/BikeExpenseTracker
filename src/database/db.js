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
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  db.execSync(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fuel_price REAL DEFAULT 108,
      currency TEXT DEFAULT 'BDT',
      default_bike_id INTEGER DEFAULT 1
    );
  `);

  const bikeCount = db.getFirstSync('SELECT COUNT(*) as cnt FROM bikes');
  if (bikeCount.cnt === 0) {
    db.runSync('INSERT INTO bikes (bike_name, tank_capacity) VALUES (?, ?)', ['My Motorcycle', 12]);
  }
  const settingsCount = db.getFirstSync('SELECT COUNT(*) as cnt FROM settings');
  if (settingsCount.cnt === 0) {
    db.runSync('INSERT INTO settings (fuel_price, currency, default_bike_id) VALUES (?, ?, ?)', [108, 'BDT', 1]);
  }
};

export const getSettings = () => {
  return getDb().getFirstSync('SELECT * FROM settings LIMIT 1') || { fuel_price: 108, currency: 'BDT', default_bike_id: 1 };
};

export const updateSettings = (fuelPrice, currency) => {
  getDb().runSync('UPDATE settings SET fuel_price = ?, currency = ?', [fuelPrice, currency]);
};

export const getBikes = () => {
  return getDb().getAllSync('SELECT * FROM bikes ORDER BY created_at DESC');
};

export const addBike = (bikeName, tankCapacity, notes) => {
  const result = getDb().runSync(
    'INSERT INTO bikes (bike_name, tank_capacity, notes) VALUES (?, ?, ?)',
    [bikeName, tankCapacity, notes || '']
  );
  return result.lastInsertRowId;
};

export const addFuelLog = ({ bikeId, date, litres, pricePerLitre, totalCost, odometer, stationName, notes }) => {
  const result = getDb().runSync(
    `INSERT INTO fuel_logs (bike_id, date, litres, price_per_litre, total_cost, odometer, station_name, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [bikeId || 1, date, litres, pricePerLitre, totalCost, odometer, stationName || '', notes || '']
  );
  return result.lastInsertRowId;
};

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

export const deleteFuelLog = (id) => {
  getDb().runSync('DELETE FROM fuel_logs WHERE id = ?', [id]);
};

export const addExpense = ({ bikeId, date, category, cost, notes }) => {
  const result = getDb().runSync(
    'INSERT INTO expenses (bike_id, date, category, cost, notes) VALUES (?, ?, ?, ?, ?)',
    [bikeId || 1, date, category, cost, notes || '']
  );
  return result.lastInsertRowId;
};

export const getExpenses = (bikeId = 1, limit = 100) => {
  return getDb().getAllSync(
    'SELECT * FROM expenses WHERE bike_id = ? ORDER BY date DESC, created_at DESC LIMIT ?',
    [bikeId, limit]
  );
};

export const deleteExpense = (id) => {
  getDb().runSync('DELETE FROM expenses WHERE id = ?', [id]);
};

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
