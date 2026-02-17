/**
 * SQLite Database Provider
 *
 * Local file-based database for single-instance deployments
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const fs = require('fs');
const DatabaseProvider = require('./DatabaseProvider');
const { initializeCustomerSchema } = require('../customerSchema');

class SQLiteProvider extends DatabaseProvider {
  constructor(options = {}) {
    super();
    this.dbPath = options.dbPath || path.join(os.homedir(), '.copilot-memory', 'ContextIQ.db');
    this.db = null;
    this.inTransaction = false;
  }

  async connect() {
    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Open database
    this.db = new Database(this.dbPath);

    // Performance optimizations
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = -64000'); // 64MB cache
    this.db.pragma('temp_store = MEMORY');
    this.db.pragma('mmap_size = 30000000000'); // 30GB mmap

    console.log(`[SQLite] Connected to database: ${this.dbPath}`);
    return this;
  }

  async disconnect() {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('[SQLite] Disconnected');
    }
  }

  isConnected() {
    return this.db !== null;
  }

  execute(sql, params = []) {
    if (!this.db) throw new Error('Database not connected');

    const stmt = this.db.prepare(sql);
    return stmt.run(...params);
  }

  query(sql, params = []) {
    if (!this.db) throw new Error('Database not connected');

    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }

  queryOne(sql, params = []) {
    if (!this.db) throw new Error('Database not connected');

    const stmt = this.db.prepare(sql);
    return stmt.get(...params);
  }

  async beginTransaction() {
    if (!this.db) throw new Error('Database not connected');
    this.db.exec('BEGIN TRANSACTION');
    this.inTransaction = true;
  }

  async commit() {
    if (!this.db) throw new Error('Database not connected');
    this.db.exec('COMMIT');
    this.inTransaction = false;
  }

  async rollback() {
    if (!this.db) throw new Error('Database not connected');
    this.db.exec('ROLLBACK');
    this.inTransaction = false;
  }

  prepare(sql) {
    if (!this.db) throw new Error('Database not connected');
    return this.db.prepare(sql);
  }

  async initializeSchema() {
    if (!this.db) throw new Error('Database not connected');

    console.log('[SQLite] Initializing schema...');

    // Create knowledge tables (existing ContextIQ schema)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        tags TEXT,
        metadata TEXT,
        source TEXT,
        context TEXT,
        related_files TEXT,
        related_symbols TEXT,
        active_file TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
        content, tags, context, related_files, related_symbols, active_file,
        content='knowledge', content_rowid='rowid'
      );

      CREATE TRIGGER IF NOT EXISTS knowledge_fts_insert AFTER INSERT ON knowledge BEGIN
        INSERT INTO knowledge_fts(rowid, content, tags, context, related_files, related_symbols, active_file)
        VALUES (new.rowid, new.content, new.tags, new.context, new.related_files, new.related_symbols, new.active_file);
      END;

      CREATE TABLE IF NOT EXISTS rules (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT,
        priority INTEGER DEFAULT 0,
        enabled INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // Create customer tables
    initializeCustomerSchema(this.db);

    console.log('[SQLite] Schema initialized');
  }

  async runMigrations() {
    // SQLite migrations handled inline during schema init
    console.log('[SQLite] No migrations to run');
  }
}

module.exports = SQLiteProvider;
