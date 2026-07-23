// Node 22+ built-in SQLite — zero native compilation required
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'italiano.db');
const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// Compatibility shim: add db.transaction() wrapper for simpler usage
db.transaction = (fn) => {
  return (...args) => {
    db.exec('BEGIN');
    try { fn(...args); db.exec('COMMIT'); }
    catch(e) { db.exec('ROLLBACK'); throw e; }
  };
};

module.exports = db;
