#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { initializeCustomerSchema } = require('./customerSchema');
const NATSSubscriberService = require('./natsSubscriber');
const CustomerContextBuilder = require('./customerContextBuilder');

class CopilotMemoryServer {
  constructor() {
    this.storageDir = path.join(os.homedir(), '.copilot-memory');
    this.ensureStorageDir();

    // Multi-scope: maintain separate DB connections for each scope
    this.dbs = {
      project: null,
      user: null,
      global: null
    };

    this.statements = {
      project: null,
      user: null,
      global: null
    };

    // NATS subscriber service for customer events
    this.natsService = null;

    // Customer context builder
    this.customerContextBuilder = null;

    this.server = new Server(
      {
        name: 'copilot-memory-mcp',
        version: '2.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  ensureStorageDir() {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  getProjectDatabasePath() {
    const cwd = process.cwd();
    const projectName = path.basename(cwd);
    return path.join(this.storageDir, `${projectName}.db`);
  }

  getUserDatabasePath() {
    return path.join(this.storageDir, 'user.db');
  }

  getGlobalDatabasePath() {
    return path.join(this.storageDir, 'global.db');
  }

  getScopeDatabasePath(scope) {
    switch (scope) {
      case 'user':
        return this.getUserDatabasePath();
      case 'global':
        return this.getGlobalDatabasePath();
      case 'project':
      default:
        return this.getProjectDatabasePath();
    }
  }

  initializeDatabase(scope = 'project') {
    // Skip if already initialized for this scope
    if (this.dbs[scope] && this.statements[scope]) {
      return;
    }
    
    try {
      const dbPath = this.getScopeDatabasePath(scope);
      
      // Open database with WAL mode for better concurrency
      const db = new Database(dbPath);
      db.pragma('journal_mode = WAL');
      db.pragma('synchronous = NORMAL');
      db.pragma('cache_size = -64000'); // 64MB cache
      db.pragma('temp_store = MEMORY');
      db.pragma('mmap_size = 30000000000'); // 30GB mmap
      
      // Run migrations FIRST to upgrade existing databases
      // This ensures columns exist before we create FTS tables/triggers
      this.runMigrations(db, scope);
      
      // Create knowledge table with proper indexing
      // Note: If table exists, this is a no-op; migrations already handled columns
      db.exec(`
        CREATE TABLE IF NOT EXISTS knowledge (
          id TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          tags TEXT, -- JSON array as string
          metadata TEXT, -- JSON object as string
          source TEXT,
          context TEXT,
          related_files TEXT, -- JSON array of related file paths
          related_symbols TEXT, -- JSON array of related symbols {name, kind, file}
          active_file TEXT, -- The file that was active when knowledge was stored
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        
        CREATE INDEX IF NOT EXISTS idx_content_fts ON knowledge(content);
        CREATE INDEX IF NOT EXISTS idx_tags ON knowledge(tags);
        CREATE INDEX IF NOT EXISTS idx_source ON knowledge(source);
        CREATE INDEX IF NOT EXISTS idx_context ON knowledge(context);
        CREATE INDEX IF NOT EXISTS idx_created_at ON knowledge(created_at);
        
        CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
          content, tags, context, related_files, related_symbols, active_file,
          content='knowledge', content_rowid='rowid'
        );
        
        CREATE TRIGGER IF NOT EXISTS knowledge_fts_insert AFTER INSERT ON knowledge BEGIN
          INSERT INTO knowledge_fts(rowid, content, tags, context, related_files, related_symbols, active_file) 
          VALUES (new.rowid, new.content, new.tags, new.context, new.related_files, new.related_symbols, new.active_file);
        END;
        
        CREATE TRIGGER IF NOT EXISTS knowledge_fts_delete AFTER DELETE ON knowledge BEGIN
          INSERT INTO knowledge_fts(knowledge_fts, rowid, content, tags, context, related_files, related_symbols, active_file) 
          VALUES('delete', old.rowid, old.content, old.tags, old.context, old.related_files, old.related_symbols, old.active_file);
        END;
        
        CREATE TRIGGER IF NOT EXISTS knowledge_fts_update AFTER UPDATE ON knowledge BEGIN
          INSERT INTO knowledge_fts(knowledge_fts, rowid, content, tags, context, related_files, related_symbols, active_file) 
          VALUES('delete', old.rowid, old.content, old.tags, old.context, old.related_files, old.related_symbols, old.active_file);
          INSERT INTO knowledge_fts(rowid, content, tags, context, related_files, related_symbols, active_file) 
          VALUES (new.rowid, new.content, new.tags, new.context, new.related_files, new.related_symbols, new.active_file);
        END;
        
        -- Create rules table (in all scopes, but typically used in global)
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
        
        CREATE INDEX IF NOT EXISTS idx_rules_enabled ON rules(enabled);
        CREATE INDEX IF NOT EXISTS idx_rules_priority ON rules(priority DESC);
        CREATE INDEX IF NOT EXISTS idx_rules_category ON rules(category);
      `);

      // Code indexing tables (PROJECT scope only, but schema exists in all for simplicity)
      db.exec(`
        -- Files table (stores file metadata)
        CREATE TABLE IF NOT EXISTS files (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          relative_path TEXT UNIQUE NOT NULL,
          absolute_path TEXT NOT NULL,
          language_id TEXT NOT NULL,
          content_hash TEXT NOT NULL,
          line_count INTEGER DEFAULT 0,
          size_bytes INTEGER DEFAULT 0,
          mtime_ms INTEGER NOT NULL,
          indexed_at INTEGER NOT NULL,
          is_deleted INTEGER DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_files_path ON files(relative_path);
        CREATE INDEX IF NOT EXISTS idx_files_language ON files(language_id);
        CREATE INDEX IF NOT EXISTS idx_files_hash ON files(content_hash);
        CREATE INDEX IF NOT EXISTS idx_files_deleted ON files(is_deleted);

        -- Symbols table (stores parsed symbols)
        CREATE TABLE IF NOT EXISTS symbols (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          file_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          kind INTEGER NOT NULL,
          container_name TEXT,
          start_line INTEGER NOT NULL,
          start_column INTEGER NOT NULL,
          end_line INTEGER NOT NULL,
          end_column INTEGER NOT NULL,
          is_exported INTEGER DEFAULT 0,
          signature TEXT,
          doc_comment TEXT,
          FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_id);
        CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
        CREATE INDEX IF NOT EXISTS idx_symbols_kind ON symbols(kind);
        CREATE INDEX IF NOT EXISTS idx_symbols_exported ON symbols(is_exported);

        -- Full-text search for symbol names
        CREATE VIRTUAL TABLE IF NOT EXISTS symbols_fts USING fts5(
          name, container_name, signature, doc_comment,
          content='symbols', content_rowid='id'
        );

        -- Triggers to keep FTS in sync
        CREATE TRIGGER IF NOT EXISTS symbols_fts_insert AFTER INSERT ON symbols BEGIN
          INSERT INTO symbols_fts(rowid, name, container_name, signature, doc_comment)
          VALUES (new.id, new.name, new.container_name, new.signature, new.doc_comment);
        END;

        CREATE TRIGGER IF NOT EXISTS symbols_fts_delete AFTER DELETE ON symbols BEGIN
          INSERT INTO symbols_fts(symbols_fts, rowid, name, container_name, signature, doc_comment)
          VALUES('delete', old.id, old.name, old.container_name, old.signature, old.doc_comment);
        END;

        CREATE TRIGGER IF NOT EXISTS symbols_fts_update AFTER UPDATE ON symbols BEGIN
          INSERT INTO symbols_fts(symbols_fts, rowid, name, container_name, signature, doc_comment)
          VALUES('delete', old.id, old.name, old.container_name, old.signature, old.doc_comment);
          INSERT INTO symbols_fts(rowid, name, container_name, signature, doc_comment)
          VALUES (new.id, new.name, new.container_name, new.signature, new.doc_comment);
        END;

        -- Imports table (stores import relationships)
        CREATE TABLE IF NOT EXISTS imports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          file_id INTEGER NOT NULL,
          import_path TEXT NOT NULL,
          import_type TEXT NOT NULL,
          is_local INTEGER DEFAULT 0,
          line_number INTEGER NOT NULL,
          resolved_file_id INTEGER,
          FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
          FOREIGN KEY (resolved_file_id) REFERENCES files(id) ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_imports_file ON imports(file_id);
        CREATE INDEX IF NOT EXISTS idx_imports_path ON imports(import_path);
        CREATE INDEX IF NOT EXISTS idx_imports_resolved ON imports(resolved_file_id);
      `);

      // Initialize customer profile tables (PROJECT scope only for now)
      if (scope === 'project') {
        initializeCustomerSchema(db);
      }

      // Prepare statements for this scope
      this.statements[scope] = {
        // Knowledge statements
        insert: db.prepare(`
          INSERT INTO knowledge (id, content, tags, metadata, source, context, related_files, related_symbols, active_file, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `),
        
        searchFts: db.prepare(`
          SELECT k.* FROM knowledge k
          JOIN knowledge_fts fts ON k.rowid = fts.rowid
          WHERE knowledge_fts MATCH ?
          ORDER BY rank
          LIMIT ?
        `),
        
        searchLike: db.prepare(`
          SELECT * FROM knowledge 
          WHERE content LIKE ? OR tags LIKE ? OR context LIKE ?
          ORDER BY updated_at DESC
          LIMIT ?
        `),
        
        getAll: db.prepare(`
          SELECT * FROM knowledge 
          ORDER BY updated_at DESC 
          LIMIT ?
        `),
        
        count: db.prepare(`SELECT COUNT(*) as count FROM knowledge`),
        
        getByTags: db.prepare(`
          SELECT * FROM knowledge 
          WHERE tags LIKE ?
          ORDER BY updated_at DESC 
          LIMIT ?
        `),

        vacuum: db.prepare(`VACUUM`),
        analyze: db.prepare(`ANALYZE`),
        
        // Rules statements
        insertRule: db.prepare(`
          INSERT INTO rules (id, title, content, category, priority, enabled, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `),
        
        updateRule: db.prepare(`
          UPDATE rules 
          SET title = ?, content = ?, category = ?, priority = ?, enabled = ?, updated_at = ?
          WHERE id = ?
        `),
        
        deleteRule: db.prepare(`DELETE FROM rules WHERE id = ?`),
        
        getRuleById: db.prepare(`SELECT * FROM rules WHERE id = ?`),
        
        getAllRules: db.prepare(`
          SELECT * FROM rules 
          WHERE enabled = 1
          ORDER BY priority DESC, created_at ASC
        `),
        
        getAllRulesIncludingDisabled: db.prepare(`
          SELECT * FROM rules 
          ORDER BY priority DESC, created_at ASC
        `),
        
        getRulesByCategory: db.prepare(`
          SELECT * FROM rules 
          WHERE enabled = 1 AND category = ?
          ORDER BY priority DESC, created_at ASC
        `),
        
        countRules: db.prepare(`SELECT COUNT(*) as count FROM rules WHERE enabled = 1`),

        // Code indexing statements
        insertFile: db.prepare(`
          INSERT INTO files (relative_path, absolute_path, language_id, content_hash, line_count, size_bytes, mtime_ms, indexed_at, is_deleted)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
          ON CONFLICT(relative_path) DO UPDATE SET
            absolute_path = excluded.absolute_path,
            language_id = excluded.language_id,
            content_hash = excluded.content_hash,
            line_count = excluded.line_count,
            size_bytes = excluded.size_bytes,
            mtime_ms = excluded.mtime_ms,
            indexed_at = excluded.indexed_at,
            is_deleted = 0
        `),

        getFileByPath: db.prepare(`SELECT * FROM files WHERE relative_path = ? AND is_deleted = 0`),
        
        getFileByHash: db.prepare(`SELECT * FROM files WHERE content_hash = ? AND is_deleted = 0`),
        
        markFileDeleted: db.prepare(`UPDATE files SET is_deleted = 1 WHERE relative_path = ?`),
        
        deleteFileSymbols: db.prepare(`DELETE FROM symbols WHERE file_id = ?`),
        
        deleteFileImports: db.prepare(`DELETE FROM imports WHERE file_id = ?`),

        insertSymbol: db.prepare(`
          INSERT INTO symbols (file_id, name, kind, container_name, start_line, start_column, end_line, end_column, is_exported, signature, doc_comment)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `),

        insertImport: db.prepare(`
          INSERT INTO imports (file_id, import_path, import_type, is_local, line_number, resolved_file_id)
          VALUES (?, ?, ?, ?, ?, ?)
        `),

        searchSymbolsFts: db.prepare(`
          SELECT s.*, f.relative_path, f.language_id 
          FROM symbols s
          JOIN symbols_fts fts ON s.id = fts.rowid
          JOIN files f ON s.file_id = f.id
          WHERE symbols_fts MATCH ? AND f.is_deleted = 0
          ORDER BY rank
          LIMIT ?
        `),

        searchSymbolsLike: db.prepare(`
          SELECT s.*, f.relative_path, f.language_id 
          FROM symbols s
          JOIN files f ON s.file_id = f.id
          WHERE s.name LIKE ? AND f.is_deleted = 0
          ORDER BY s.name
          LIMIT ?
        `),

        searchSymbolsByKind: db.prepare(`
          SELECT s.*, f.relative_path, f.language_id 
          FROM symbols s
          JOIN files f ON s.file_id = f.id
          WHERE s.name LIKE ? AND s.kind IN (SELECT value FROM json_each(?)) AND f.is_deleted = 0
          ORDER BY s.name
          LIMIT ?
        `),

        getFileSymbols: db.prepare(`
          SELECT * FROM symbols WHERE file_id = ? ORDER BY start_line
        `),

        getFileImports: db.prepare(`
          SELECT * FROM imports WHERE file_id = ? ORDER BY line_number
        `),

        findImporters: db.prepare(`
          SELECT DISTINCT f.relative_path, f.language_id, i.import_path, i.line_number
          FROM imports i
          JOIN files f ON i.file_id = f.id
          WHERE i.import_path LIKE ? AND f.is_deleted = 0
          LIMIT ?
        `),

        findSymbolUsages: db.prepare(`
          SELECT DISTINCT f.relative_path, f.language_id, s.name, s.kind, s.start_line
          FROM symbols s
          JOIN files f ON s.file_id = f.id
          WHERE s.name = ? AND f.is_deleted = 0
          LIMIT ?
        `),

        getIndexStats: db.prepare(`
          SELECT 
            (SELECT COUNT(*) FROM files WHERE is_deleted = 0) as total_files,
            (SELECT COUNT(*) FROM symbols) as total_symbols,
            (SELECT COUNT(*) FROM imports) as total_imports
        `),

        getLanguageBreakdown: db.prepare(`
          SELECT language_id, COUNT(*) as file_count, SUM(line_count) as total_lines
          FROM files WHERE is_deleted = 0
          GROUP BY language_id
          ORDER BY file_count DESC
        `),

        getAllFiles: db.prepare(`
          SELECT relative_path, content_hash, mtime_ms FROM files WHERE is_deleted = 0
        `),

        cleanupDeletedFiles: db.prepare(`
          DELETE FROM files WHERE is_deleted = 1
        `)
      };

      this.dbs[scope] = db;
      console.log(`Database initialized for ${scope} scope: ${dbPath}`);
    } catch (error) {
      console.error(`Failed to initialize ${scope} database:`, error);
      throw error;
    }
  }

  runMigrations(db, scope) {
    // Run migrations to ensure database schema is up to date
    // This handles upgrading existing databases to new schema versions
    try {
      // Check if knowledge table exists first
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='knowledge'").get();
      if (!tables) {
        // No knowledge table yet, skip migrations - schema creation will handle it
        return;
      }

      const tableInfo = db.pragma('table_info(knowledge)');
      const columnNames = tableInfo.map(col => col.name);
      
      // Migration 1: Add related_files, related_symbols, active_file columns
      const columnsToAdd = [
        { name: 'related_files', type: 'TEXT' },
        { name: 'related_symbols', type: 'TEXT' },
        { name: 'active_file', type: 'TEXT' }
      ];
      
      for (const col of columnsToAdd) {
        if (!columnNames.includes(col.name)) {
          console.log(`[${scope}] Migration: Adding ${col.name} column...`);
          try {
            db.exec(`ALTER TABLE knowledge ADD COLUMN ${col.name} ${col.type}`);
          } catch (e) {
            // Column might already exist in some edge cases
            console.log(`[${scope}] Column ${col.name} may already exist: ${e.message}`);
          }
        }
      }
      
      // Migration 2: Check and rebuild FTS5 table if schema changed
      // We need to check if FTS table exists and has the right columns
      let needsFtsRebuild = false;
      
      try {
        // Check if FTS table exists
        const ftsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='knowledge_fts'").get();
        if (!ftsTable) {
          needsFtsRebuild = true;
        } else {
          // Try to query with new columns - if it fails, we need to rebuild
          try {
            db.prepare('SELECT related_files, related_symbols, active_file FROM knowledge_fts LIMIT 0').get();
          } catch (e) {
            needsFtsRebuild = true;
          }
        }
      } catch (e) {
        needsFtsRebuild = true;
      }
      
      if (needsFtsRebuild) {
        console.log(`[${scope}] Migration: Rebuilding FTS5 index with new columns...`);
        
        // Drop old triggers and FTS table (safe even if they don't exist)
        db.exec(`
          DROP TRIGGER IF EXISTS knowledge_fts_insert;
          DROP TRIGGER IF EXISTS knowledge_fts_delete;
          DROP TRIGGER IF EXISTS knowledge_fts_update;
          DROP TABLE IF EXISTS knowledge_fts;
        `);
        
        // Recreate FTS table with all columns
        db.exec(`
          CREATE VIRTUAL TABLE knowledge_fts USING fts5(
            content, tags, context, related_files, related_symbols, active_file,
            content='knowledge', content_rowid='rowid'
          );
          
          CREATE TRIGGER knowledge_fts_insert AFTER INSERT ON knowledge BEGIN
            INSERT INTO knowledge_fts(rowid, content, tags, context, related_files, related_symbols, active_file) 
            VALUES (new.rowid, new.content, new.tags, new.context, new.related_files, new.related_symbols, new.active_file);
          END;
          
          CREATE TRIGGER knowledge_fts_delete AFTER DELETE ON knowledge BEGIN
            INSERT INTO knowledge_fts(knowledge_fts, rowid, content, tags, context, related_files, related_symbols, active_file) 
            VALUES('delete', old.rowid, old.content, old.tags, old.context, old.related_files, old.related_symbols, old.active_file);
          END;
          
          CREATE TRIGGER knowledge_fts_update AFTER UPDATE ON knowledge BEGIN
            INSERT INTO knowledge_fts(knowledge_fts, rowid, content, tags, context, related_files, related_symbols, active_file) 
            VALUES('delete', old.rowid, old.content, old.tags, old.context, old.related_files, old.related_symbols, old.active_file);
            INSERT INTO knowledge_fts(rowid, content, tags, context, related_files, related_symbols, active_file) 
            VALUES (new.rowid, new.content, new.tags, new.context, new.related_files, new.related_symbols, new.active_file);
          END;
        `);
        
        // Rebuild FTS index from existing knowledge data
        const existingCount = db.prepare('SELECT COUNT(*) as count FROM knowledge').get().count;
        if (existingCount > 0) {
          console.log(`[${scope}] Rebuilding FTS index for ${existingCount} existing entries...`);
          db.exec(`
            INSERT INTO knowledge_fts(rowid, content, tags, context, related_files, related_symbols, active_file)
            SELECT rowid, content, tags, context, 
                   COALESCE(related_files, ''), 
                   COALESCE(related_symbols, ''), 
                   COALESCE(active_file, '') 
            FROM knowledge;
          `);
        }
        
        console.log(`[${scope}] FTS5 index rebuilt successfully`);
      }
      
    } catch (error) {
      console.error(`[${scope}] Migration error:`, error.message);
      // Log full error for debugging but don't crash
      console.error(error.stack);
    }
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'store_knowledge',
            description: 'Store knowledge in SQLite database when user says "remember" this information',
            inputSchema: {
              type: 'object',
              properties: {
                content: {
                  type: 'string',
                  description: 'The content to remember'
                },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Tags to categorize the knowledge (optional)'
                },
                context: {
                  type: 'string',
                  description: 'Context or category for the knowledge (optional)'
                },
                scope: {
                  type: 'string',
                  enum: ['project', 'user', 'global'],
                  description: 'Storage scope: project (default), user, or global'
                },
                related_files: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Related file paths discovered from content (auto-populated by context enricher)'
                },
                related_symbols: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      kind: { type: 'number' },
                      file: { type: 'string' }
                    }
                  },
                  description: 'Related symbols discovered from content (auto-populated by context enricher)'
                },
                active_file: {
                  type: 'string',
                  description: 'The file that was active when knowledge was stored'
                }
              },
              required: ['content']
            }
          },
          {
            name: 'store-knowledge',
            description: 'Store knowledge in SQLite database when user says "remember" this information (alias for store_knowledge).',
            inputSchema: {
              type: 'object',
              properties: {
                content: {
                  type: 'string',
                  description: 'The content to remember'
                },
                messages: {
                  type: 'string',
                  description: 'Alternate field used by older clients'
                },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Tags to categorize the knowledge (optional)'
                },
                context: {
                  type: 'string',
                  description: 'Context or category for the knowledge (optional)'
                },
                scope: {
                  type: 'string',
                  enum: ['project', 'user', 'global'],
                  description: 'Storage scope: project (default), user, or global'
                }
              },
              required: ['content']
            }
          },
          {
            name: 'retrieve_knowledge',
            description: 'Retrieve knowledge from SQLite database with full-text search. Returns related files and symbols for context-aware results.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query to find relevant knowledge'
                },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Filter by specific tags (optional)'
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of results to return (default: 5)'
                },
                useFullText: {
                  type: 'boolean',
                  description: 'Use full-text search (true) or LIKE search (false). Default: true'
                },
                scope: {
                  type: 'string',
                  enum: ['project', 'user', 'global', 'all'],
                  description: 'Search scope: project, user, global, or all (default: all)'
                },
                include_related: {
                  type: 'boolean',
                  description: 'Include related files and symbols in results (default: true)'
                }
              },
              required: ['query']
            }
          },
          {
            name: 'retrieve-knowledge',
            description: 'Retrieve knowledge from SQLite database (alias for retrieve_knowledge).',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query to find relevant knowledge'
                },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Filter by specific tags (optional)'
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of results to return (default: 5)'
                },
                useFullText: {
                  type: 'boolean',
                  description: 'Use full-text search (true) or LIKE search (false). Default: true'
                },
                scope: {
                  type: 'string',
                  enum: ['project', 'user', 'global', 'all'],
                  description: 'Search scope: project, user, global, or all (default: all)'
                },
                include_related: {
                  type: 'boolean',
                  description: 'Include related files and symbols in results (default: true)'
                }
              },
              required: ['query']
            }
          },
          {
            name: 'list-knowledge',
            description: 'List stored knowledge with advanced filtering and statistics (alias for list_knowledge).',
            inputSchema: {
              type: 'object',
              properties: {
                limit: {
                  type: 'number',
                  description: 'Maximum number of entries to return (default: 10)'
                },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Filter by specific tags (optional)'
                },
                optimize: {
                  type: 'boolean',
                  description: 'Run database optimization (VACUUM and ANALYZE). Default: false'
                },
                scope: {
                  type: 'string',
                  enum: ['project', 'user', 'global', 'all'],
                  description: 'List scope: project, user, global, or all (default: all)'
                }
              }
            }
          },
          {
            name: 'list_knowledge',
            description: 'List stored knowledge with advanced filtering and statistics',
            inputSchema: {
              type: 'object',
              properties: {
                limit: {
                  type: 'number',
                  description: 'Maximum number of entries to return (default: 10)'
                },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Filter by specific tags (optional)'
                },
                optimize: {
                  type: 'boolean',
                  description: 'Run database optimization (VACUUM and ANALYZE). Default: false'
                },
                scope: {
                  type: 'string',
                  enum: ['project', 'user', 'global', 'all'],
                  description: 'List scope: project, user, global, or all (default: all)'
                }
              }
            }
          },
          {
            name: 'store_rule',
            description: 'Store a coding rule/guideline. Use when user says "save as rule"',
            inputSchema: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'Short title for the rule'
                },
                content: {
                  type: 'string',
                  description: 'The rule content/guideline'
                },
                category: {
                  type: 'string',
                  description: 'Category (e.g., "code-style", "architecture", "testing", "general")'
                },
                priority: {
                  type: 'number',
                  description: 'Priority (0-10, higher = more important). Default: 5'
                },
                scope: {
                  type: 'string',
                  enum: ['project', 'user', 'global'],
                  description: 'Storage scope: project, user, or global (default: global)'
                }
              },
              required: ['title', 'content']
            }
          },
          {
            name: 'retrieve_rules',
            description: 'Retrieve all active rules. MUST be called at start of every chat',
            inputSchema: {
              type: 'object',
              properties: {
                category: {
                  type: 'string',
                  description: 'Filter by category (optional)'
                },
                scope: {
                  type: 'string',
                  enum: ['project', 'user', 'global', 'all'],
                  description: 'Retrieve scope: project, user, global, or all (default: all)'
                }
              }
            }
          },
          {
            name: 'update_rule',
            description: 'Update an existing rule by ID',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'Rule ID to update'
                },
                title: {
                  type: 'string',
                  description: 'New title (optional)'
                },
                content: {
                  type: 'string',
                  description: 'New content (optional)'
                },
                category: {
                  type: 'string',
                  description: 'New category (optional)'
                },
                priority: {
                  type: 'number',
                  description: 'New priority (optional)'
                },
                enabled: {
                  type: 'boolean',
                  description: 'Enable/disable rule (optional)'
                },
                scope: {
                  type: 'string',
                  enum: ['project', 'user', 'global'],
                  description: 'Scope where rule is stored (default: global)'
                }
              },
              required: ['id']
            }
          },
          {
            name: 'delete_rule',
            description: 'Delete a rule by ID',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'Rule ID to delete'
                },
                scope: {
                  type: 'string',
                  enum: ['project', 'user', 'global'],
                  description: 'Scope where rule is stored (default: global)'
                }
              },
              required: ['id']
            }
          },
          {
            name: 'list_rules',
            description: 'List all rules with their details (ID, title, category, priority)',
            inputSchema: {
              type: 'object',
              properties: {
                includeDisabled: {
                  type: 'boolean',
                  description: 'Include disabled rules. Default: false'
                },
                scope: {
                  type: 'string',
                  enum: ['project', 'user', 'global', 'all'],
                  description: 'List scope: project, user, global, or all (default: all)'
                }
              }
            }
          },
          // Code Indexing Tools (PROJECT scope only)
          {
            name: 'index_file',
            description: 'Index a single file to extract symbols and imports. Use after file changes.',
            inputSchema: {
              type: 'object',
              properties: {
                filePath: {
                  type: 'string',
                  description: 'Absolute path to the file to index'
                },
                relativePath: {
                  type: 'string',
                  description: 'Relative path from workspace root'
                },
                content: {
                  type: 'string',
                  description: 'File content (optional, will read from disk if not provided)'
                },
                force: {
                  type: 'boolean',
                  description: 'Re-index even if content hash unchanged. Default: false'
                }
              },
              required: ['filePath', 'relativePath']
            }
          },
          {
            name: 'index_workspace',
            description: 'Index all files in workspace. Returns statistics about indexed files.',
            inputSchema: {
              type: 'object',
              properties: {
                files: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      filePath: { type: 'string' },
                      relativePath: { type: 'string' }
                    }
                  },
                  description: 'Array of files to index with absolute and relative paths'
                },
                incremental: {
                  type: 'boolean',
                  description: 'Skip unchanged files based on content hash. Default: true'
                }
              },
              required: ['files']
            }
          },
          {
            name: 'search_symbols',
            description: 'Search for symbols (functions, classes, variables) across indexed files',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query for symbol names'
                },
                kinds: {
                  type: 'array',
                  items: { type: 'number' },
                  description: 'Filter by SymbolKind (5=Class, 6=Method, 12=Function, 13=Variable, etc.)'
                },
                exportedOnly: {
                  type: 'boolean',
                  description: 'Only return exported symbols. Default: false'
                },
                limit: {
                  type: 'number',
                  description: 'Maximum results to return. Default: 20'
                }
              },
              required: ['query']
            }
          },
          {
            name: 'get_file_symbols',
            description: 'Get all symbols and imports for a specific file',
            inputSchema: {
              type: 'object',
              properties: {
                filePath: {
                  type: 'string',
                  description: 'Relative path to the file'
                },
                includeImports: {
                  type: 'boolean',
                  description: 'Include import statements. Default: true'
                }
              },
              required: ['filePath']
            }
          },
          {
            name: 'find_references',
            description: 'Find files that import a module or use a symbol',
            inputSchema: {
              type: 'object',
              properties: {
                symbolName: {
                  type: 'string',
                  description: 'Symbol name to find usages of'
                },
                modulePath: {
                  type: 'string',
                  description: 'Module path to find importers of'
                },
                limit: {
                  type: 'number',
                  description: 'Maximum results. Default: 50'
                }
              }
            }
          },
          {
            name: 'get_index_stats',
            description: 'Get code index statistics (file count, symbol count, language breakdown)',
            inputSchema: {
              type: 'object',
              properties: {
                includeLanguageBreakdown: {
                  type: 'boolean',
                  description: 'Include per-language statistics. Default: true'
                }
              }
            }
          },
          // ==================== CUSTOMER MANAGEMENT TOOLS ====================
          {
            name: 'get_customer_context',
            description: 'Get comprehensive customer context for AI engagement. Retrieves complete customer profile with events, purchases, work orders, and important notes.',
            inputSchema: {
              type: 'object',
              properties: {
                customer_id: {
                  type: 'string',
                  description: 'Customer ID'
                },
                email: {
                  type: 'string',
                  description: 'Customer email (alternative to customer_id)'
                },
                include_events: {
                  type: 'boolean',
                  description: 'Include event timeline. Default: true'
                },
                include_purchases: {
                  type: 'boolean',
                  description: 'Include purchase history. Default: true'
                },
                include_work_orders: {
                  type: 'boolean',
                  description: 'Include work orders. Default: true'
                },
                include_knowledge: {
                  type: 'boolean',
                  description: 'Include customer knowledge/notes. Default: true'
                },
                events_limit: {
                  type: 'number',
                  description: 'Maximum events to retrieve. Default: 20'
                },
                purchases_limit: {
                  type: 'number',
                  description: 'Maximum purchases to retrieve. Default: 10'
                }
              }
            }
          },
          {
            name: 'search_customers',
            description: 'Search for customers by name, email, company, or tags using full-text search',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query'
                },
                limit: {
                  type: 'number',
                  description: 'Maximum results to return. Default: 10'
                }
              },
              required: ['query']
            }
          },
          {
            name: 'get_customer_timeline',
            description: 'Get chronological timeline of all customer interactions and events',
            inputSchema: {
              type: 'object',
              properties: {
                customer_id: {
                  type: 'string',
                  description: 'Customer ID'
                },
                event_types: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Filter by event types (optional)'
                },
                limit: {
                  type: 'number',
                  description: 'Maximum events to return. Default: 50'
                }
              },
              required: ['customer_id']
            }
          },
          {
            name: 'create_customer_profile',
            description: 'Create a new customer profile',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'Customer ID (optional, auto-generated if not provided)'
                },
                name: {
                  type: 'string',
                  description: 'Customer name'
                },
                email: {
                  type: 'string',
                  description: 'Customer email'
                },
                phone: {
                  type: 'string',
                  description: 'Customer phone number'
                },
                company: {
                  type: 'string',
                  description: 'Customer company'
                },
                status: {
                  type: 'string',
                  enum: ['active', 'inactive', 'vip', 'at-risk'],
                  description: 'Customer status. Default: active'
                },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Customer tags for categorization'
                },
                custom_fields: {
                  type: 'object',
                  description: 'Custom fields as key-value pairs'
                }
              },
              required: ['name']
            }
          },
          {
            name: 'update_customer_profile',
            description: 'Update an existing customer profile',
            inputSchema: {
              type: 'object',
              properties: {
                customer_id: {
                  type: 'string',
                  description: 'Customer ID to update'
                },
                name: {
                  type: 'string',
                  description: 'Updated name'
                },
                email: {
                  type: 'string',
                  description: 'Updated email'
                },
                phone: {
                  type: 'string',
                  description: 'Updated phone'
                },
                company: {
                  type: 'string',
                  description: 'Updated company'
                },
                status: {
                  type: 'string',
                  enum: ['active', 'inactive', 'vip', 'at-risk'],
                  description: 'Updated status'
                },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Updated tags'
                },
                custom_fields: {
                  type: 'object',
                  description: 'Updated custom fields'
                }
              },
              required: ['customer_id']
            }
          },
          {
            name: 'add_customer_note',
            description: 'Add an important note or observation about a customer',
            inputSchema: {
              type: 'object',
              properties: {
                customer_id: {
                  type: 'string',
                  description: 'Customer ID'
                },
                content: {
                  type: 'string',
                  description: 'Note content'
                },
                category: {
                  type: 'string',
                  enum: ['preference', 'complaint', 'praise', 'technical', 'other'],
                  description: 'Note category'
                },
                importance: {
                  type: 'string',
                  enum: ['low', 'medium', 'high', 'critical'],
                  description: 'Note importance. Default: medium'
                },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Note tags'
                }
              },
              required: ['customer_id', 'content']
            }
          }
        ]
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'store_knowledge':
          case 'store-knowledge':
            return await this.storeKnowledge(args);
          case 'retrieve_knowledge':
          case 'retrieve-knowledge':
            return await this.retrieveKnowledge(args);
          case 'list_knowledge':
          case 'list-knowledge':
            return await this.listKnowledge(args);
          case 'store_rule':
            return await this.storeRule(args);
          case 'retrieve_rules':
            return await this.retrieveRules(args);
          case 'update_rule':
            return await this.updateRule(args);
          case 'delete_rule':
            return await this.deleteRule(args);
          case 'list_rules':
            return await this.listRules(args);
          // Code indexing tools (PROJECT scope only)
          case 'index_file':
            return await this.indexFile(args);
          case 'index_workspace':
            return await this.indexWorkspace(args);
          case 'search_symbols':
            return await this.searchSymbols(args);
          case 'get_file_symbols':
            return await this.getFileSymbols(args);
          case 'find_references':
            return await this.findReferences(args);
          case 'get_index_stats':
            return await this.getIndexStats(args);
          // Customer management tools
          case 'get_customer_context':
            return await this.getCustomerContext(args);
          case 'search_customers':
            return await this.searchCustomers(args);
          case 'get_customer_timeline':
            return await this.getCustomerTimeline(args);
          case 'create_customer_profile':
            return await this.createCustomerProfile(args);
          case 'update_customer_profile':
            return await this.updateCustomerProfile(args);
          case 'add_customer_note':
            return await this.addCustomerNote(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ],
          isError: true
        };
      }
    });
  }

  async storeKnowledge(args) {
    const scope = args.scope || 'project';
    this.initializeDatabase(scope);

    const content = (args.content || args.messages || '').trim();
    if (!content) {
      throw new Error('content is required');
    }
    
    const id = this.generateId();
    const timestamp = Math.floor(Date.now() / 1000);
    const tags = args.tags ? JSON.stringify(args.tags) : null;
    const metadata = args.metadata ? JSON.stringify(args.metadata) : null;
    
    // Auto-enrich content with context if not explicitly provided
    let relatedFiles = args.related_files;
    let relatedSymbols = args.related_symbols;
    let activeFile = args.active_file || null;
    
    // Only auto-enrich for project scope (where code index exists)
    if (scope === 'project' && (!relatedFiles || !relatedSymbols)) {
      try {
        const enricher = this.getContextEnricher();
        const enriched = enricher.enrich(args.content, {
          includeSymbols: !relatedSymbols,
          includeRelatedFiles: !relatedFiles,
          activeFile: activeFile
        });
        
        if (!relatedFiles && enriched.relatedFiles.length > 0) {
          relatedFiles = enriched.relatedFiles;
        }
        if (!relatedSymbols && enriched.relatedSymbols.length > 0) {
          relatedSymbols = enriched.relatedSymbols;
        }
      } catch (e) {
        // Enrichment is optional, continue without it
        console.log('Context enrichment skipped:', e.message);
      }
    }
    
    const relatedFilesJson = relatedFiles ? JSON.stringify(relatedFiles) : null;
    const relatedSymbolsJson = relatedSymbols ? JSON.stringify(relatedSymbols) : null;

    this.statements[scope].insert.run(
      id,
      content,
      tags,
      metadata,
      args.source || null,
      args.context || null,
      relatedFilesJson,
      relatedSymbolsJson,
      activeFile,
      timestamp,
      timestamp
    );

    // Build response message
    let responseText = `✅ Stored in ${scope.toUpperCase()} scope with ID: ${id}`;
    if (relatedFilesJson) {
      const fileList = Array.isArray(relatedFiles) ? relatedFiles : JSON.parse(relatedFilesJson);
      responseText += `\n📁 Related files: ${fileList.length}`;
    }
    if (relatedSymbolsJson) {
      const symbolList = Array.isArray(relatedSymbols) ? relatedSymbols : JSON.parse(relatedSymbolsJson);
      responseText += `\n🔗 Related symbols: ${symbolList.length}`;
    }
    if (activeFile) {
      responseText += `\n📍 Active file: ${activeFile}`;
    }

    return {
      content: [
        {
          type: 'text',
          text: responseText
        }
      ]
    };
  }

  async retrieveKnowledge(args) {
    const scope = args.scope || 'all';
    const limit = args.limit || 5;
    const useFullText = args.useFullText !== false;
    const includeRelatedContext = args.include_related !== false;

    const query = typeof args.query === 'string' ? args.query.trim() : '';

    let results = [];

    // Determine which scopes to search
    const scopesToSearch = scope === 'all' 
      ? ['project', 'user', 'global']
      : [scope];

    for (const s of scopesToSearch) {
      this.initializeDatabase(s);
      
      let rows;
      if (!query) {
        rows = this.statements[s].getAll.all(limit);
      } else if (useFullText) {
        rows = this.statements[s].searchFts.all(query, limit);
      } else {
        const likeQuery = `%${query}%`;
        rows = this.statements[s].searchLike.all(likeQuery, likeQuery, likeQuery, limit);
      }

      // Add scope information to each result
      results.push(...rows.map(row => ({
        ...row,
        scope: s,
        tags: row.tags ? JSON.parse(row.tags) : [],
        related_files: row.related_files ? JSON.parse(row.related_files) : [],
        related_symbols: row.related_symbols ? JSON.parse(row.related_symbols) : []
      })));
    }

    // Sort by relevance (you could add BM25 scoring here)
    results.sort((a, b) => b.updated_at - a.updated_at);
    results = results.slice(0, limit);

    const mapped = results.map(row => ({
      id: row.id,
      content: row.content,
      tags: row.tags || [],
      source: row.source || null,
      context: row.context || null,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      scope: row.scope,
      related_files: includeRelatedContext ? (row.related_files || []) : [],
      related_symbols: includeRelatedContext ? (row.related_symbols || []) : [],
      active_file: row.active_file || null,
      createdAt: row.created_at ? new Date(row.created_at * 1000).toISOString() : null,
      updatedAt: row.updated_at ? new Date(row.updated_at * 1000).toISOString() : null
    }));

    const payload = {
      query,
      total: mapped.length,
      results: mapped
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(payload)
        }
      ]
    };
  }

  async listKnowledge(args) {
    const scope = args.scope || 'all';
    const limit = args.limit || 10;

    const scopesToList = scope === 'all'
      ? ['project', 'user', 'global']
      : [scope];

    let allEntries = [];
    let statsText = '📊 Multi-Scope Knowledge:\n\n';

    for (const s of scopesToList) {
      this.initializeDatabase(s);
      
      const count = this.statements[s].count.get().count;
      const entries = this.statements[s].getAll.all(limit);
      
      const dbPath = this.getScopeDatabasePath(s);
      const stats = fs.statSync(dbPath);
      const sizeKB = (stats.size / 1024).toFixed(2);

      statsText += `🔸 ${s.toUpperCase()}:\n`;
      statsText += `   Total entries: ${count}\n`;
      statsText += `   Database size: ${sizeKB} KB\n\n`;

      allEntries.push(...entries.map(e => ({ ...e, scope: s })));
    }

    if (args.optimize) {
      for (const s of scopesToList) {
        this.statements[s].vacuum.run();
        this.statements[s].analyze.run();
      }
      statsText += '✅ Database optimization completed\n\n';
    }

    const totalCount = allEntries.length;
    statsText += `Grand Total: ${totalCount} entries shown`;

    const mapped = allEntries.map(row => ({
      id: row.id,
      content: row.content,
      tags: row.tags ? JSON.parse(row.tags) : [],
      source: row.source || null,
      context: row.context || null,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      scope: row.scope,
      related_files: row.related_files ? JSON.parse(row.related_files) : [],
      related_symbols: row.related_symbols ? JSON.parse(row.related_symbols) : [],
      active_file: row.active_file || null,
      createdAt: row.created_at ? new Date(row.created_at * 1000).toISOString() : null,
      updatedAt: row.updated_at ? new Date(row.updated_at * 1000).toISOString() : null
    }));

    const payload = {
      scope,
      total: totalCount,
      statsText,
      results: mapped
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(payload)
        }
      ]
    };
  }

  async storeRule(args) {
    const scope = args.scope || 'global';
    this.initializeDatabase(scope);
    
    const id = this.generateId();
    const timestamp = Math.floor(Date.now() / 1000);
    const priority = args.priority || 5;
    const category = args.category || 'general';

    this.statements[scope].insertRule.run(
      id,
      args.title,
      args.content,
      category,
      priority,
      1, // enabled
      timestamp,
      timestamp
    );

    return {
      content: [
        {
          type: 'text',
          text: `✅ Rule stored in ${scope.toUpperCase()} scope with ID: ${id}\n📋 ${args.title}\n⭐ Priority: ${priority} | Category: ${category}`
        }
      ]
    };
  }

  async retrieveRules(args) {
    const scope = args.scope || 'all';
    const category = args.category;

    const scopesToSearch = scope === 'all'
      ? ['project', 'user', 'global']
      : [scope];

    let allRules = [];

    for (const s of scopesToSearch) {
      this.initializeDatabase(s);
      
      let rows;
      if (category) {
        rows = this.statements[s].getRulesByCategory.all(category);
      } else {
        rows = this.statements[s].getAllRules.all();
      }

      allRules.push(...rows.map(r => ({ ...r, scope: s })));
    }

    // Sort by priority (highest first), then by created_at
    allRules.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.created_at - b.created_at;
    });

    if (allRules.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: '📋 No active rules found'
          }
        ]
      };
    }

    const formatted = allRules.map(rule => {
      const stars = '⭐'.repeat(Math.min(rule.priority, 10));
      return `[${rule.scope.toUpperCase()}] ${stars} ${rule.title}\n   ${rule.content}\n   Category: ${rule.category || 'general'}`;
    }).join('\n\n');

    return {
      content: [
        {
          type: 'text',
          text: `📋 Retrieved ${allRules.length} rules:\n\n${formatted}`
        }
      ]
    };
  }

  async updateRule(args) {
    const scope = args.scope || 'global';
    this.initializeDatabase(scope);
    
    const existing = this.statements[scope].getRuleById.get(args.id);
    if (!existing) {
      throw new Error(`Rule ${args.id} not found in ${scope} scope`);
    }

    const title = args.title !== undefined ? args.title : existing.title;
    const content = args.content !== undefined ? args.content : existing.content;
    const category = args.category !== undefined ? args.category : existing.category;
    const priority = args.priority !== undefined ? args.priority : existing.priority;
    const enabled = args.enabled !== undefined ? (args.enabled ? 1 : 0) : existing.enabled;
    const timestamp = Math.floor(Date.now() / 1000);

    this.statements[scope].updateRule.run(
      title,
      content,
      category,
      priority,
      enabled,
      timestamp,
      args.id
    );

    return {
      content: [
        {
          type: 'text',
          text: `✅ Rule updated in ${scope.toUpperCase()} scope: ${args.id}`
        }
      ]
    };
  }

  async deleteRule(args) {
    const scope = args.scope || 'global';
    this.initializeDatabase(scope);
    
    const result = this.statements[scope].deleteRule.run(args.id);
    
    if (result.changes === 0) {
      throw new Error(`Rule ${args.id} not found in ${scope} scope`);
    }

    return {
      content: [
        {
          type: 'text',
          text: `✅ Rule deleted from ${scope.toUpperCase()} scope: ${args.id}`
        }
      ]
    };
  }

  async listRules(args) {
    const scope = args.scope || 'all';
    const includeDisabled = args.includeDisabled || false;

    const scopesToSearch = scope === 'all'
      ? ['project', 'user', 'global']
      : [scope];

    let allRules = [];

    for (const s of scopesToSearch) {
      this.initializeDatabase(s);
      
      const rows = includeDisabled
        ? this.statements[s].getAllRulesIncludingDisabled.all()
        : this.statements[s].getAllRules.all();

      allRules.push(...rows.map(r => ({ ...r, scope: s })));
    }

    if (allRules.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: '📋 No rules found'
          }
        ]
      };
    }

    const formatted = allRules.map(rule => {
      const status = rule.enabled ? '✅' : '❌';
      const stars = '⭐'.repeat(Math.min(rule.priority, 10));
      return `${status} [${rule.scope.toUpperCase()}] ${rule.id}\n   ${stars} ${rule.title}\n   Category: ${rule.category || 'general'} | Priority: ${rule.priority}`;
    }).join('\n\n');

    return {
      content: [
        {
          type: 'text',
          text: `📋 Found ${allRules.length} rules:\n\n${formatted}`
        }
      ]
    };
  }

  // ==================== CODE INDEXING METHODS ====================
  
  // Import the symbol parser
  getSymbolParser() {
    if (!this._symbolParser) {
      const { SymbolParser } = require('./symbolParser');
      this._symbolParser = new SymbolParser();
    }
    return this._symbolParser;
  }

  // Get context enricher for smart knowledge storage
  getContextEnricher() {
    if (!this._contextEnricher) {
      const { ContextEnricher } = require('./contextEnricher');
      this._contextEnricher = new ContextEnricher((scope) => {
        this.initializeDatabase(scope);
        return this.statements[scope];
      });
    }
    return this._contextEnricher;
  }

  async indexFile(args) {
    // Code indexing is PROJECT scope only
    this.initializeDatabase('project');
    const stmts = this.statements.project;
    const parser = this.getSymbolParser();
    
    const { filePath, relativePath, content, force } = args;
    
    // Check if file needs re-indexing (hash comparison)
    if (!force) {
      const existing = stmts.getFileByPath.get(relativePath);
      if (existing) {
        const currentHash = content 
          ? parser.generateHash(content)
          : parser.generateHash(require('fs').readFileSync(filePath, 'utf8'));
        
        if (existing.content_hash === currentHash) {
          return {
            content: [{ type: 'text', text: `⏭️ Skipped (unchanged): ${relativePath}` }]
          };
        }
      }
    }
    
    // Parse the file
    const parsed = parser.parseFile(filePath, content);
    if (!parsed) {
      return {
        content: [{ type: 'text', text: `⚠️ Could not parse: ${relativePath}` }]
      };
    }
    
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Use transaction for atomicity
    const db = this.dbs.project;
    const transaction = db.transaction(() => {
      // Insert/update file record
      stmts.insertFile.run(
        relativePath,
        filePath,
        parsed.languageId,
        parsed.contentHash,
        parsed.lineCount,
        parsed.size,
        parsed.mtimeMs,
        timestamp
      );
      
      // Get the file ID
      const file = stmts.getFileByPath.get(relativePath);
      const fileId = file.id;
      
      // Clear existing symbols and imports for this file
      stmts.deleteFileSymbols.run(fileId);
      stmts.deleteFileImports.run(fileId);
      
      // Insert symbols
      for (const sym of parsed.symbols) {
        stmts.insertSymbol.run(
          fileId,
          sym.name,
          sym.kind,
          sym.containerName || null,
          sym.startLine,
          sym.startColumn || 0,
          sym.endLine || sym.startLine,
          sym.endColumn || 0,
          sym.isExported ? 1 : 0,
          sym.signature || null,
          sym.docComment || null
        );
      }
      
      // Insert imports
      for (const imp of parsed.imports) {
        stmts.insertImport.run(
          fileId,
          imp.importPath,
          imp.importType,
          imp.isLocal ? 1 : 0,
          imp.lineNumber,
          null // resolved_file_id - can be resolved later
        );
      }
    });
    
    transaction();
    
    return {
      content: [{
        type: 'text',
        text: `✅ Indexed: ${relativePath}\n   📊 ${parsed.symbols.length} symbols, ${parsed.imports.length} imports`
      }]
    };
  }

  async indexWorkspace(args) {
    this.initializeDatabase('project');
    const stmts = this.statements.project;
    const parser = this.getSymbolParser();
    
    const { files, incremental = true } = args;
    
    let indexed = 0, skipped = 0, failed = 0;
    const errors = [];
    
    // Get existing file hashes for incremental mode
    let existingHashes = {};
    if (incremental) {
      const allFiles = stmts.getAllFiles.all();
      for (const f of allFiles) {
        existingHashes[f.relative_path] = f.content_hash;
      }
    }
    
    const db = this.dbs.project;
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Process files in batches
    const batchSize = 50;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      
      const transaction = db.transaction(() => {
        for (const { filePath, relativePath } of batch) {
          try {
            // Parse file
            const parsed = parser.parseFile(filePath);
            if (!parsed) {
              failed++;
              continue;
            }
            
            // Check hash for incremental
            if (incremental && existingHashes[relativePath] === parsed.contentHash) {
              skipped++;
              continue;
            }
            
            // Insert/update file
            stmts.insertFile.run(
              relativePath,
              filePath,
              parsed.languageId,
              parsed.contentHash,
              parsed.lineCount,
              parsed.size,
              parsed.mtimeMs,
              timestamp
            );
            
            const file = stmts.getFileByPath.get(relativePath);
            const fileId = file.id;
            
            // Clear and re-insert symbols/imports
            stmts.deleteFileSymbols.run(fileId);
            stmts.deleteFileImports.run(fileId);
            
            for (const sym of parsed.symbols) {
              stmts.insertSymbol.run(
                fileId, sym.name, sym.kind, sym.containerName || null,
                sym.startLine, sym.startColumn || 0, sym.endLine || sym.startLine, sym.endColumn || 0,
                sym.isExported ? 1 : 0, sym.signature || null, sym.docComment || null
              );
            }
            
            for (const imp of parsed.imports) {
              stmts.insertImport.run(
                fileId, imp.importPath, imp.importType, imp.isLocal ? 1 : 0, imp.lineNumber, null
              );
            }
            
            indexed++;
          } catch (err) {
            failed++;
            errors.push(`${relativePath}: ${err.message}`);
          }
        }
      });
      
      transaction();
    }
    
    // Cleanup deleted files
    stmts.cleanupDeletedFiles.run();
    
    const summary = `📊 Workspace Indexing Complete:
   ✅ Indexed: ${indexed} files
   ⏭️ Skipped: ${skipped} files (unchanged)
   ❌ Failed: ${failed} files`;
    
    return {
      content: [{
        type: 'text',
        text: errors.length > 0 
          ? `${summary}\n\n⚠️ Errors:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n... and ${errors.length - 5} more` : ''}`
          : summary
      }]
    };
  }

  async searchSymbols(args) {
    this.initializeDatabase('project');
    const stmts = this.statements.project;
    
    const { query, kinds, exportedOnly = false, limit = 20 } = args;
    
    let results;
    
    if (kinds && kinds.length > 0) {
      // Search with kind filter
      results = stmts.searchSymbolsByKind.all(`%${query}%`, JSON.stringify(kinds), limit);
    } else {
      // Try FTS first, fall back to LIKE
      try {
        results = stmts.searchSymbolsFts.all(query, limit);
      } catch {
        results = stmts.searchSymbolsLike.all(`%${query}%`, limit);
      }
    }
    
    // Filter exported only if requested
    if (exportedOnly) {
      results = results.filter(r => r.is_exported === 1);
    }
    
    if (results.length === 0) {
      return {
        content: [{ type: 'text', text: `🔍 No symbols found matching "${query}"` }]
      };
    }
    
    const kindNames = {
      5: 'Class', 6: 'Method', 11: 'Interface', 12: 'Function',
      13: 'Variable', 14: 'Constant', 22: 'Struct', 9: 'Enum'
    };
    
    const formatted = results.map(r => {
      const kind = kindNames[r.kind] || `Kind:${r.kind}`;
      const exported = r.is_exported ? '📤' : '';
      return `${exported}${kind} ${r.name} → ${r.relative_path}:${r.start_line}`;
    }).join('\n');
    
    return {
      content: [{
        type: 'text',
        text: `🔍 Found ${results.length} symbols:\n\n${formatted}`
      }]
    };
  }

  async getFileSymbols(args) {
    this.initializeDatabase('project');
    const stmts = this.statements.project;
    
    const { filePath, includeImports = true } = args;
    
    const file = stmts.getFileByPath.get(filePath);
    if (!file) {
      return {
        content: [{ type: 'text', text: `❌ File not indexed: ${filePath}` }]
      };
    }
    
    const symbols = stmts.getFileSymbols.all(file.id);
    const imports = includeImports ? stmts.getFileImports.all(file.id) : [];
    
    const kindNames = {
      5: 'Class', 6: 'Method', 11: 'Interface', 12: 'Function',
      13: 'Variable', 14: 'Constant', 22: 'Struct', 9: 'Enum'
    };
    
    let output = `📄 ${filePath} (${file.language_id})\n\n`;
    
    if (imports.length > 0) {
      output += `📥 Imports (${imports.length}):\n`;
      output += imports.map(i => `   ${i.import_path} [${i.import_type}]`).join('\n');
      output += '\n\n';
    }
    
    output += `📊 Symbols (${symbols.length}):\n`;
    output += symbols.map(s => {
      const kind = kindNames[s.kind] || `Kind:${s.kind}`;
      const exported = s.is_exported ? '📤 ' : '   ';
      const container = s.container_name ? `${s.container_name}.` : '';
      return `${exported}${kind} ${container}${s.name} (line ${s.start_line})`;
    }).join('\n');
    
    return {
      content: [{ type: 'text', text: output }]
    };
  }

  async findReferences(args) {
    this.initializeDatabase('project');
    const stmts = this.statements.project;
    
    const { symbolName, modulePath, limit = 50 } = args;
    
    if (!symbolName && !modulePath) {
      return {
        content: [{ type: 'text', text: '❌ Provide either symbolName or modulePath' }]
      };
    }
    
    let results = [];
    
    if (modulePath) {
      // Find files that import this module
      results = stmts.findImporters.all(`%${modulePath}%`, limit);
      
      if (results.length === 0) {
        return {
          content: [{ type: 'text', text: `🔍 No files import "${modulePath}"` }]
        };
      }
      
      const formatted = results.map(r => 
        `📄 ${r.relative_path}:${r.line_number} → imports "${r.import_path}"`
      ).join('\n');
      
      return {
        content: [{
          type: 'text',
          text: `📥 Found ${results.length} files importing "${modulePath}":\n\n${formatted}`
        }]
      };
    }
    
    if (symbolName) {
      // Find symbol usages
      results = stmts.findSymbolUsages.all(symbolName, limit);
      
      if (results.length === 0) {
        return {
          content: [{ type: 'text', text: `🔍 No definitions found for "${symbolName}"` }]
        };
      }
      
      const kindNames = {
        5: 'Class', 6: 'Method', 11: 'Interface', 12: 'Function',
        13: 'Variable', 14: 'Constant', 22: 'Struct', 9: 'Enum'
      };
      
      const formatted = results.map(r => {
        const kind = kindNames[r.kind] || `Kind:${r.kind}`;
        return `${kind} ${r.name} → ${r.relative_path}:${r.start_line}`;
      }).join('\n');
      
      return {
        content: [{
          type: 'text',
          text: `🔍 Found ${results.length} definitions of "${symbolName}":\n\n${formatted}`
        }]
      };
    }
  }

  async getIndexStats(args) {
    this.initializeDatabase('project');
    const stmts = this.statements.project;
    
    const { includeLanguageBreakdown = true } = args;
    
    const stats = stmts.getIndexStats.get();
    
    let output = `📊 Code Index Statistics:
   📁 Files: ${stats.total_files}
   🔤 Symbols: ${stats.total_symbols}
   📥 Imports: ${stats.total_imports}`;
    
    if (includeLanguageBreakdown) {
      const breakdown = stmts.getLanguageBreakdown.all();
      
      if (breakdown.length > 0) {
        output += '\n\n📈 Language Breakdown:';
        for (const lang of breakdown) {
          output += `\n   ${lang.language_id}: ${lang.file_count} files, ${lang.total_lines || 0} lines`;
        }
      }
    }
    
    return {
      content: [{ type: 'text', text: output }]
    };
  }

  generateId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  // ==================== CUSTOMER MANAGEMENT METHODS ====================

  ensureCustomerContextBuilder() {
    if (!this.customerContextBuilder) {
      this.initializeDatabase('project'); // Ensure customer tables exist
      this.customerContextBuilder = new CustomerContextBuilder(this.dbs.project);
    }
  }

  async getCustomerContext(args) {
    this.ensureCustomerContextBuilder();

    const identifier = args.customer_id || args.email;
    if (!identifier) {
      throw new Error('Either customer_id or email is required');
    }

    try {
      const context = await this.customerContextBuilder.buildCustomerContext(identifier, {
        includeEvents: args.include_events !== false,
        includePurchases: args.include_purchases !== false,
        includeWorkOrders: args.include_work_orders !== false,
        includeKnowledge: args.include_knowledge !== false,
        eventsLimit: args.events_limit || 20,
        purchasesLimit: args.purchases_limit || 10
      });

      return {
        content: [
          {
            type: 'text',
            text: `# Customer Context: ${context.customer.name}\n\n${context.ai_context_summary}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }

  async searchCustomers(args) {
    this.ensureCustomerContextBuilder();

    try {
      const results = this.customerContextBuilder.searchCustomers(args.query, args.limit || 10);

      if (results.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `🔍 No customers found matching "${args.query}"`
            }
          ]
        };
      }

      const formatted = results.map(c =>
        `👤 ${c.name} (${c.email || 'No email'})\n   ID: ${c.id} | Status: ${c.status} | LTV: $${c.lifetime_value}`
      ).join('\n\n');

      return {
        content: [
          {
            type: 'text',
            text: `🔍 Found ${results.length} customers:\n\n${formatted}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }

  async getCustomerTimeline(args) {
    this.ensureCustomerContextBuilder();

    try {
      const timeline = this.customerContextBuilder.getCustomerTimeline(args.customer_id, {
        limit: args.limit || 50,
        eventTypes: args.event_types
      });

      if (timeline.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `📅 No events found for customer ${args.customer_id}`
            }
          ]
        };
      }

      const formatted = timeline.map(e => {
        const date = new Date(e.event_date * 1000).toLocaleDateString();
        return `📅 ${date} - [${e.event_type}] ${e.title}\n   ${e.description || 'No description'}`;
      }).join('\n\n');

      return {
        content: [
          {
            type: 'text',
            text: `📅 Customer Timeline (${timeline.length} events):\n\n${formatted}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }

  async createCustomerProfile(args) {
    this.initializeDatabase('project');

    try {
      const id = args.id || this.generateId();
      const now = Math.floor(Date.now() / 1000);

      const stmt = this.dbs.project.prepare(`
        INSERT INTO customers (id, name, email, phone, company, status, customer_since, lifetime_value, tags, custom_fields, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        args.name,
        args.email || null,
        args.phone || null,
        args.company || null,
        args.status || 'active',
        now,
        0, // initial lifetime_value
        JSON.stringify(args.tags || []),
        JSON.stringify(args.custom_fields || {}),
        now,
        now
      );

      return {
        content: [
          {
            type: 'text',
            text: `✅ Customer profile created successfully!\n\nID: ${id}\nName: ${args.name}\nEmail: ${args.email || 'N/A'}\nStatus: ${args.status || 'active'}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error creating customer: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }

  async updateCustomerProfile(args) {
    this.initializeDatabase('project');

    try {
      // Get existing customer
      const existing = this.dbs.project.prepare('SELECT * FROM customers WHERE id = ?').get(args.customer_id);
      if (!existing) {
        throw new Error(`Customer not found: ${args.customer_id}`);
      }

      const now = Math.floor(Date.now() / 1000);
      const updates = [];
      const params = [];

      if (args.name !== undefined) {
        updates.push('name = ?');
        params.push(args.name);
      }
      if (args.email !== undefined) {
        updates.push('email = ?');
        params.push(args.email);
      }
      if (args.phone !== undefined) {
        updates.push('phone = ?');
        params.push(args.phone);
      }
      if (args.company !== undefined) {
        updates.push('company = ?');
        params.push(args.company);
      }
      if (args.status !== undefined) {
        updates.push('status = ?');
        params.push(args.status);
      }
      if (args.tags !== undefined) {
        updates.push('tags = ?');
        params.push(JSON.stringify(args.tags));
      }
      if (args.custom_fields !== undefined) {
        updates.push('custom_fields = ?');
        params.push(JSON.stringify(args.custom_fields));
      }

      updates.push('updated_at = ?');
      params.push(now);
      params.push(args.customer_id);

      const stmt = this.dbs.project.prepare(`
        UPDATE customers
        SET ${updates.join(', ')}
        WHERE id = ?
      `);

      stmt.run(...params);

      return {
        content: [
          {
            type: 'text',
            text: `✅ Customer profile updated successfully!\n\nID: ${args.customer_id}\nUpdated fields: ${Object.keys(args).filter(k => k !== 'customer_id').join(', ')}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error updating customer: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }

  async addCustomerNote(args) {
    this.initializeDatabase('project');

    try {
      const id = this.generateId();
      const now = Math.floor(Date.now() / 1000);

      const stmt = this.dbs.project.prepare(`
        INSERT INTO customer_knowledge (id, customer_id, content, category, importance, tags, source, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        args.customer_id,
        args.content,
        args.category || 'other',
        args.importance || 'medium',
        JSON.stringify(args.tags || []),
        'manual',
        now,
        now
      );

      return {
        content: [
          {
            type: 'text',
            text: `✅ Customer note added successfully!\n\nCustomer: ${args.customer_id}\nCategory: ${args.category || 'other'}\nImportance: ${args.importance || 'medium'}\n\n${args.content}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error adding note: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Copilot Memory MCP Server (Multi-Scope) running on stdio');

    // Start NATS subscriber if configured
    await this.startNATSService();
  }

  async startNATSService() {
    // Check if NATS is enabled via environment variable
    const natsEnabled = process.env.NATS_ENABLED === 'true' || process.env.NATS_ENABLED === '1';

    if (!natsEnabled) {
      console.error('[NATS] NATS service is disabled. Set NATS_ENABLED=true to enable.');
      return;
    }

    try {
      // Initialize project database to ensure customer tables exist
      this.initializeDatabase('project');

      // Get NATS configuration from environment
      const natsConfig = {
        servers: process.env.NATS_SERVERS || 'nats://localhost:4222',
        subjects: process.env.NATS_SUBJECTS ? process.env.NATS_SUBJECTS.split(',') : ['customer.events.>'],
        queueGroup: process.env.NATS_QUEUE_GROUP || 'contextiq-service',
        eventProcessor: {
          summarizeThreshold: parseInt(process.env.NATS_SUMMARIZE_THRESHOLD || '500'),
          autoCreateCustomer: process.env.NATS_AUTO_CREATE_CUSTOMER !== 'false'
        }
      };

      console.error('[NATS] Starting NATS subscriber service...');
      console.error('[NATS] Configuration:', JSON.stringify(natsConfig, null, 2));

      this.natsService = new NATSSubscriberService(this.dbs.project, natsConfig);
      await this.natsService.start();

      console.error('[NATS] Service started successfully');
    } catch (error) {
      console.error('[NATS] Failed to start NATS service:', error);
      console.error('[NATS] Continuing without NATS integration...');
    }
  }

  async stopNATSService() {
    if (this.natsService) {
      console.error('[NATS] Stopping NATS service...');
      await this.natsService.stop();
      this.natsService = null;
    }
  }
}

const server = new CopilotMemoryServer();
server.run().catch(console.error);
