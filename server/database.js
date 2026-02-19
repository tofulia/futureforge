const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database.db');
const db = new sqlite3.Database(dbPath);

// Initialize database tables
db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        matric TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        ic TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        email TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Registrations table
    db.run(`CREATE TABLE IF NOT EXISTS registrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        name TEXT NOT NULL,
        matric TEXT NOT NULL,
        ic TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(userId) REFERENCES users(id)
    )`);

    // Calculations table
    db.run(`CREATE TABLE IF NOT EXISTS calculations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        kehadiran INTEGER NOT NULL,
        penilaian INTEGER NOT NULL,
        penglibatan INTEGER NOT NULL,
        pencapaian INTEGER NOT NULL,
        jawatan INTEGER NOT NULL,
        bonus INTEGER NOT NULL,
        total INTEGER NOT NULL,
        finalPercent REAL NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(userId) REFERENCES users(id)
    )`);

    console.log('✅ Database initialized successfully!');
});

module.exports = db;
