#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');
const fs = require('fs');

class CopilotMemoryServer {
  constructor() {
    this.storageDir = path.join(os.homedir(), '.copilot-memory');
    this.ensureStorageDir();
    this.databases = {}; // Store multiple database connections
    this.dbInitialized = {};
    
    this.server = new Server(
      {
        name: 'copilot-memory-mcp-sqlite',
        version: '2.0.0',
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

  getDatabasePath(scope = 'project') {
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

  async initializeDatabase(scope = 'project') {
    if (this.dbInitialized[scope]) return this.databases[scope];
    
    return new Promise((resolve, reject) => {
      const dbPath = this.getDatabasePath(scope);
      console.log(`Initializing SQLite database [${scope}]: ${dbPath}`);
      
      const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('Database creation error:', err);
          reject(err);
          return;
        }

        // Create knowledge table with proper indexing
        db.serialize(() => {
          db.run(`
            CREATE TABLE IF NOT EXISTS knowledge (
              id TEXT PRIMARY KEY,
              content TEXT NOT NULL,
              tags TEXT,
              metadata TEXT,
              source TEXT,
              context TEXT,
              scope TEXT DEFAULT 'project',
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL
            )
          `, (err) => {
            if (err) {
              console.error('Table creation error:', err);
              reject(err);
              return;
            }
            
            console.log(`✅ Knowledge table created [${scope}]`);

            // Create FTS5 virtual table for full-text search
            db.run(`
              CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
                id UNINDEXED,
                content,
                tags,
                context,
                content='knowledge',
                content_rowid='rowid'
              )
            `, (err) => {
              if (err) {
                console.error('FTS5 table creation error:', err);
              } else {
                console.log(`✅ FTS5 full-text search enabled [${scope}]`);
              }
            });

            // Create triggers to keep FTS in sync
            db.run(`
              CREATE TRIGGER IF NOT EXISTS knowledge_ai AFTER INSERT ON knowledge BEGIN
                INSERT INTO knowledge_fts(rowid, id, content, tags, context)
                VALUES (new.rowid, new.id, new.content, new.tags, new.context);
              END
            `);

            db.run(`
              CREATE TRIGGER IF NOT EXISTS knowledge_ad AFTER DELETE ON knowledge BEGIN
                DELETE FROM knowledge_fts WHERE rowid = old.rowid;
              END
            `);

            db.run(`
              CREATE TRIGGER IF NOT EXISTS knowledge_au AFTER UPDATE ON knowledge BEGIN
                UPDATE knowledge_fts SET content = new.content, tags = new.tags, context = new.context
                WHERE rowid = new.rowid;
              END
            `);

            db.run(`CREATE INDEX IF NOT EXISTS idx_created_at ON knowledge(created_at)`, (err) => {
              if (err) console.error('Index creation error:', err);
            });
            db.run(`CREATE INDEX IF NOT EXISTS idx_updated_at ON knowledge(updated_at)`, (err) => {
              if (err) console.error('Index creation error:', err);
            });
            db.run(`CREATE INDEX IF NOT EXISTS idx_scope ON knowledge(scope)`, (err) => {
              if (err) console.error('Index creation error:', err);
            });

            console.log(`✅ SQLite database initialized with FTS5 [${scope}]: ${path.basename(dbPath)}`);
            this.databases[scope] = db;
            this.dbInitialized[scope] = true;
            resolve(db);
          });
        });
      });
    });
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'store_knowledge',
            description: 'Store knowledge in SQLite database when user says "remember" this information. Supports project, user, and global scopes.',
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
                  description: 'Scope: "project" (current project only), "user" (across all projects for user), "global" (shared across all users). Default: project',
                  default: 'project'
                }
              },
              required: ['content']
            }
          },
          {
            name: 'retrieve_knowledge',
            description: 'Retrieve knowledge from SQLite database with indexed search. Can search across project, user, or global scopes.',
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
                scope: {
                  type: 'string',
                  enum: ['project', 'user', 'global', 'all'],
                  description: 'Scope: "project", "user", "global", or "all" to search everywhere. Default: all',
                  default: 'all'
                }
              },
              required: ['query']
            }
          },
          {
            name: 'list_knowledge',
            description: 'List stored knowledge with statistics from SQLite database. Can list from specific scope or all scopes.',
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
                scope: {
                  type: 'string',
                  enum: ['project', 'user', 'global', 'all'],
                  description: 'Scope: "project", "user", "global", or "all". Default: all',
                  default: 'all'
                },
                vacuum: {
                  type: 'boolean',
                  description: 'Run VACUUM to optimize database. Default: false'
                }
              }
            }
          }
        ]
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      // Ensure database is initialized for the scope
      const scope = args.scope || 'project';
      if (!this.dbInitialized[scope]) {
        await this.initializeDatabase(scope);
      }

      try {
        switch (name) {
          case 'store_knowledge':
            return await this.storeKnowledge(args);
          case 'retrieve_knowledge':
            return await this.retrieveKnowledge(args);
          case 'list_knowledge':
            return await this.listKnowledge(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error: ${error.message}`
          }],
          isError: true
        };
      }
    });
  }

  generateId() {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  async storeKnowledge(args) {
    const { content, tags = [], context = 'copilot-chat', scope = 'project' } = args;

    if (!content || typeof content !== 'string') {
      throw new Error('Content is required and must be a string');
    }

    // Ensure the scope database is initialized
    if (!this.dbInitialized[scope]) {
      await this.initializeDatabase(scope);
    }

    const db = this.databases[scope];

    return new Promise((resolve, reject) => {
      const id = this.generateId();
      const now = Date.now();
      const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : [tags].filter(Boolean));
      const metadata = JSON.stringify({
        source: 'copilot-chat',
        timestamp: new Date(now).toISOString(),
        project: path.basename(process.cwd()),
        scope: scope
      });

      const stmt = db.prepare(`
        INSERT INTO knowledge (id, content, tags, metadata, source, context, scope, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run([id, content.trim(), tagsJson, metadata, 'copilot-chat', context, scope, now, now], function(err) {
        if (err) {
          reject(new Error(`Failed to store knowledge: ${err.message}`));
          return;
        }

        const preview = content.length > 100 ? content.substring(0, 100) + '...' : content;
        const scopeLabel = scope === 'project' ? path.basename(process.cwd()) : scope.toUpperCase();
        resolve({
          content: [{
            type: 'text',
            text: `✅ Successfully stored knowledge in SQLite!\n\n**Content:** ${preview}\n**Tags:** ${tags.join(', ') || 'none'}\n**Scope:** ${scopeLabel}\n**ID:** ${id}`
          }]
        });
      });

      stmt.finalize();
    });
  }

  async retrieveKnowledge(args) {
    const { query, tags = [], limit = 5, scope = 'all' } = args;

    if (!query || typeof query !== 'string') {
      throw new Error('Query is required and must be a string');
    }

    // Determine which scopes to search
    const scopesToSearch = scope === 'all' ? ['project', 'user', 'global'] : [scope];
    
    // Initialize all required databases
    for (const s of scopesToSearch) {
      if (!this.dbInitialized[s]) {
        await this.initializeDatabase(s);
      }
    }

    // Search across all specified scopes
    const allResults = [];
    
    for (const s of scopesToSearch) {
      const db = this.databases[s];
      const results = await this.searchInDatabase(db, query, tags, limit, s);
      allResults.push(...results);
    }

    if (allResults.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `🔍 No knowledge found for query: "${query}"\n\nTry using different keywords or check your stored knowledge with the list command.`
        }]
      };
    }

    // Sort all results by rank
    allResults.sort((a, b) => b.rank - a.rank);
    const topResults = allResults.slice(0, Math.min(limit, 20));

    const formattedResults = topResults.map((row, index) => {
      const tags = JSON.parse(row.tags || '[]');
      const tagsStr = tags.length > 0 ? ` [${tags.join(', ')}]` : '';
      const date = new Date(row.created_at).toLocaleDateString();
      const preview = row.content.length > 300 ? row.content.substring(0, 300) + '...' : row.content;
      const scopeLabel = row.scope === 'project' ? path.basename(process.cwd()) : row.scope.toUpperCase();
      
      return `**${index + 1}. ${row.context || 'Knowledge'}** [${scopeLabel}]${tagsStr} _(${date})_\n${preview}`;
    }).join('\n\n---\n\n');

    return {
      content: [{
        type: 'text',
        text: `🧠 Found ${topResults.length} knowledge entries for "${query}" across ${scopesToSearch.join(', ')} scope(s):\n\n${formattedResults}`
      }]
    };
  }

  // Helper method to search in a specific database
  async searchInDatabase(db, query, tags, limit, scope) {
    return new Promise((resolve, reject) => {
      // Prepare FTS5 query - handle multiple keywords
      const keywords = query.trim().split(/\s+/).filter(k => k.length > 0);
      const ftsQuery = keywords.map(k => `"${k.replace(/"/g, '""')}"`).join(' OR ');
      
      let sql = `
        SELECT 
          k.*,
          bm25(knowledge_fts) as rank
        FROM knowledge k
        INNER JOIN knowledge_fts ON k.rowid = knowledge_fts.rowid
        WHERE knowledge_fts MATCH ?
      `;
      
      let params = [ftsQuery];

      // Add tag filtering if specified
      if (Array.isArray(tags) && tags.length > 0) {
        const tagConditions = tags.map(() => 'k.tags LIKE ?').join(' OR ');
        sql += ` AND (${tagConditions})`;
        params.push(...tags.map(tag => `%${tag}%`));
      }

      // Order by relevance (BM25 ranking), then by date
      sql += ` ORDER BY rank, k.updated_at DESC LIMIT ?`;
      params.push(Math.min(limit, 20));

      db.all(sql, params, (err, rows) => {
        if (err) {
          // Fallback to LIKE search if FTS fails
          console.error(`FTS search error in ${scope}, falling back to LIKE:`, err.message);
          this.searchInDatabaseFallback(db, query, tags, limit, scope, resolve, reject);
          return;
        }

        resolve(rows);
      });
    });
  }

  // Fallback search using LIKE (in case FTS5 is not available or fails)
  async searchInDatabaseFallback(db, query, tags, limit, scope, resolve, reject) {
    const searchTerms = query.toLowerCase().split(/\s+/).filter(k => k.length > 0);
    const likeConditions = searchTerms.map(() => 
      '(LOWER(content) LIKE ? OR LOWER(tags) LIKE ? OR LOWER(context) LIKE ?)'
    ).join(' AND ');
    
    let sql = `SELECT * FROM knowledge WHERE ${likeConditions}`;
    let params = searchTerms.flatMap(term => {
      const searchTerm = `%${term}%`;
      return [searchTerm, searchTerm, searchTerm];
    });

    // Add tag filtering if specified
    if (Array.isArray(tags) && tags.length > 0) {
      const tagConditions = tags.map(() => 'tags LIKE ?').join(' OR ');
      sql += ` AND (${tagConditions})`;
      params.push(...tags.map(tag => `%${tag}%`));
    }

    sql += ` ORDER BY updated_at DESC LIMIT ?`;
    params.push(Math.min(limit, 20));

    db.all(sql, params, (err, rows) => {
      if (err) {
        resolve([]); // Return empty array on error
        return;
      }

      // Add fake rank for consistency
      const rankedRows = rows.map(row => ({ ...row, rank: 0 }));
      resolve(rankedRows);
    });
  }

  async listKnowledge(args) {
    const { limit = 10, tags = [], scope = 'all', vacuum = false } = args;
    
    // Determine which scopes to list
    const scopesToList = scope === 'all' ? ['project', 'user', 'global'] : [scope];
    
    // Initialize all required databases
    for (const s of scopesToList) {
      if (!this.dbInitialized[s]) {
        await this.initializeDatabase(s);
      }
    }

    // Collect results from all scopes
    const scopeResults = [];
    
    for (const s of scopesToList) {
      const db = this.databases[s];
      
      // Run VACUUM if requested
      if (vacuum) {
        await new Promise((resolve) => {
          db.run('VACUUM', (err) => {
            if (err) console.error(`VACUUM error in ${s}:`, err);
            resolve();
          });
        });
      }

      const result = await this.listFromDatabase(db, tags, limit, s);
      scopeResults.push(result);
    }

    // Format combined response
    let response = `📊 **SQLite Memory Database - Multi-Scope View:**\n\n`;
    
    for (const result of scopeResults) {
      const scopeLabel = result.scope === 'project' ? `Project: ${path.basename(process.cwd())}` : result.scope.toUpperCase();
      response += `� **${scopeLabel}:**\n`;
      response += `   - Total entries: ${result.totalCount}\n`;
      response += `   - Database size: ${result.dbSize} KB\n`;
      response += `   - Filtered entries: ${result.rows.length}\n`;
      if (vacuum) response += `   - ✅ Optimized\n`;
      response += `\n`;

      if (result.rows.length > 0) {
        result.rows.forEach((row, index) => {
          const tags = JSON.parse(row.tags || '[]');
          const tagsStr = tags.length > 0 ? ` [${tags.join(', ')}]` : '';
          const date = new Date(row.created_at).toLocaleDateString();
          const preview = row.content.substring(0, 120) + (row.content.length > 120 ? '...' : '');
          response += `   ${index + 1}. **${row.context || 'Knowledge'}**${tagsStr} _(${date})_\n      ${preview}\n\n`;
        });
      }
      response += `\n`;
    }

    const totalEntries = scopeResults.reduce((sum, r) => sum + r.totalCount, 0);
    response += `**Grand Total:** ${totalEntries} entries across ${scopesToList.length} scope(s)`;

    return {
      content: [{
        type: 'text',
        text: response
      }]
    };
  }

  // Helper method to list from a specific database
  async listFromDatabase(db, tags, limit, scope) {
    return new Promise((resolve, reject) => {
      // Get total count
      db.get('SELECT COUNT(*) as count FROM knowledge', (err, countResult) => {
        if (err) {
          resolve({ scope, totalCount: 0, dbSize: '0', rows: [] });
          return;
        }

        const totalCount = countResult.count;
        let sql = 'SELECT * FROM knowledge';
        let params = [];

        // Add tag filtering if specified
        if (Array.isArray(tags) && tags.length > 0) {
          const tagConditions = tags.map(() => 'tags LIKE ?').join(' OR ');
          sql += ` WHERE (${tagConditions})`;
          params.push(...tags.map(tag => `%${tag}%`));
        }

        sql += ' ORDER BY updated_at DESC LIMIT ?';
        params.push(Math.min(limit, 50));

        db.all(sql, params, (err, rows) => {
          if (err) {
            resolve({ scope, totalCount, dbSize: '0', rows: [] });
            return;
          }

          const dbPath = this.getDatabasePath(scope);
          let dbSize = '0';
          
          try {
            const dbStats = fs.statSync(dbPath);
            dbSize = (dbStats.size / 1024).toFixed(2);
          } catch (e) {
            // Database file might not exist yet
          }

          resolve({ scope, totalCount, dbSize, rows });
        });
      });
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  shutdown() {
    // Close all open database connections
    for (const scope in this.databases) {
      if (this.databases[scope]) {
        this.databases[scope].close();
      }
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  if (global.server) {
    global.server.shutdown();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (global.server) {
    global.server.shutdown();
  }
  process.exit(0);
});

// Start the server
const server = new CopilotMemoryServer();
global.server = server;
server.run().catch(console.error);