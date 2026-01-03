const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'vrmodels.db');
const db = new Database(dbPath);

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS pages (
    url TEXT PRIMARY KEY,
    title TEXT,
    description TEXT,
    tags TEXT,
    images TEXT,
    download_links TEXT,
    scraped_at DATETIME,
    status TEXT DEFAULT 'queued',
    last_error TEXT
  );

  CREATE TABLE IF NOT EXISTS crawl_queue (
    url TEXT PRIMARY KEY,
    priority INTEGER DEFAULT 0,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

module.exports = db;
