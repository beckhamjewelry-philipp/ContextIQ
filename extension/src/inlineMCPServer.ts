import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

/**
 * Inline MCP Server with Direct SQLite Access
 * 
 * This implementation eliminates the need for spawning separate Node.js processes
 * by handling MCP protocol directly within the extension and using better-sqlite3
 * for synchronous, high-performance database operations.
 * 
 * Performance benefits:
 * - No IPC overhead
 * - No process spawning delay
 * - Direct memory access to SQLite
 * - Synchronous operations (faster than async when appropriate)
 * - Connection pooling built-in
 */

// We'll use better-sqlite3 which is synchronous and much faster
let Database: any;
try {
  Database = require('better-sqlite3');
} catch (error) {
  console.error('better-sqlite3 not found. Installing...');
  // Will be installed via package.json
}

interface MCPRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface KnowledgeEntry {
  id: string;
  content: string;
  tags: string[];
  metadata?: any;
  source: string;
  context?: string;
  created_at: number;
  updated_at: number;
}

/**
 * Singleton Database Connection Pool
 * Reuses connections and maintains them in memory for ultra-fast access
 */
class SQLiteConnectionPool {
  private static instance: SQLiteConnectionPool;
  private connections = new Map<string, any>();
  
  private constructor() {}
  
  static getInstance(): SQLiteConnectionPool {
    if (!SQLiteConnectionPool.instance) {
      SQLiteConnectionPool.instance = new SQLiteConnectionPool();
    }
    return SQLiteConnectionPool.instance;
  }
  
  getConnection(dbPath: string): any {
    // Return existing connection if available
    if (this.connections.has(dbPath)) {
      return this.connections.get(dbPath);
    }
    
    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Create new connection with optimal settings
    const db = new Database(dbPath);
    
    // Enable WAL mode for better concurrency
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL'); // Faster than FULL, safe with WAL
    db.pragma('cache_size = -64000'); // 64MB cache
    db.pragma('temp_store = MEMORY');
    db.pragma('mmap_size = 30000000000'); // 30GB memory-mapped I/O
    db.pragma('page_size = 4096'); // Optimal page size
    
    // Initialize schema
    this.initializeSchema(db);
    
    // Cache the connection
    this.connections.set(dbPath, db);
    
    return db;
  }
  
  private initializeSchema(db: any): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        tags TEXT, -- JSON array as string
        metadata TEXT, -- JSON object as string
        source TEXT,
        context TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      
      -- Indexes for fast lookups
      CREATE INDEX IF NOT EXISTS idx_tags ON knowledge(tags);
      CREATE INDEX IF NOT EXISTS idx_context ON knowledge(context);
      CREATE INDEX IF NOT EXISTS idx_created_at ON knowledge(created_at);
      
      -- FTS5 for full-text search (much faster than LIKE)
      CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
        content, tags, context, 
        content='knowledge', 
        content_rowid='rowid'
      );
      
      -- Triggers to keep FTS in sync
      CREATE TRIGGER IF NOT EXISTS knowledge_fts_insert AFTER INSERT ON knowledge BEGIN
        INSERT INTO knowledge_fts(rowid, content, tags, context) 
        VALUES (new.rowid, new.content, new.tags, new.context);
      END;
      
      CREATE TRIGGER IF NOT EXISTS knowledge_fts_delete AFTER DELETE ON knowledge BEGIN
        INSERT INTO knowledge_fts(knowledge_fts, rowid, content, tags, context) 
        VALUES('delete', old.rowid, old.content, old.tags, old.context);
      END;
      
      CREATE TRIGGER IF NOT EXISTS knowledge_fts_update AFTER UPDATE ON knowledge BEGIN
        INSERT INTO knowledge_fts(knowledge_fts, rowid, content, tags, context) 
        VALUES('delete', old.rowid, old.content, old.tags, old.context);
        INSERT INTO knowledge_fts(rowid, content, tags, context) 
        VALUES (new.rowid, new.content, new.tags, new.context);
      END;
    `);
  }
  
  closeConnection(dbPath: string): void {
    const db = this.connections.get(dbPath);
    if (db) {
      try {
        // Checkpoint WAL before closing
        db.pragma('wal_checkpoint(TRUNCATE)');
        db.close();
      } catch (error) {
        console.error('Error closing database:', error);
      }
      this.connections.delete(dbPath);
    }
  }
  
  closeAll(): void {
    for (const [dbPath] of this.connections) {
      this.closeConnection(dbPath);
    }
  }
}

/**
 * Inline MCP Server
 * Handles MCP protocol directly without spawning processes
 */
export class InlineMCPServer {
  private pool: SQLiteConnectionPool;
  private currentProject: string | null = null;
  private dataDir: string;
  private statementsCache = new Map<string, any>();
  
  constructor(private context: vscode.ExtensionContext) {
    this.pool = SQLiteConnectionPool.getInstance();
    
    // Get data directory from config
    const config = vscode.workspace.getConfiguration('copilotMemory.storage.local');
    this.dataDir = (config.get<string>('dataDir') || '~/.copilot-memory').replace('~', os.homedir());
    
    // Auto-select project based on workspace
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]) {
      this.currentProject = path.basename(vscode.workspace.workspaceFolders[0].uri.fsPath);
    }
  }
  
  /**
   * Get the database path for current project
   */
  private getDBPath(): string {
    if (!this.currentProject) {
      throw new Error('No project selected');
    }
    return path.join(this.dataDir, `${this.currentProject}.db`);
  }
  
  /**
   * Get database connection with prepared statements cached
   */
  private getDB(): any {
    const dbPath = this.getDBPath();
    return this.pool.getConnection(dbPath);
  }
  
  /**
   * Get or create cached prepared statement
   */
  private getStatement(db: any, name: string, sql: string): any {
    const cacheKey = `${this.getDBPath()}_${name}`;
    
    if (this.statementsCache.has(cacheKey)) {
      return this.statementsCache.get(cacheKey);
    }
    
    const stmt = db.prepare(sql);
    this.statementsCache.set(cacheKey, stmt);
    return stmt;
  }
  
  /**
   * Handle MCP request directly (no JSON-RPC needed)
   */
  async handleToolCall(toolName: string, args: any): Promise<any> {
    try {
      switch (toolName) {
        case 'store_knowledge':
          return await this.storeKnowledge(args);
        case 'retrieve_knowledge':
          return await this.retrieveKnowledge(args);
        case 'list_knowledge':
          return await this.listKnowledge(args);
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `❌ Error: ${error.message}`
        }],
        isError: true
      };
    }
  }
  
  /**
   * Store knowledge (OPTIMIZED)
   */
  private async storeKnowledge(args: any): Promise<any> {
    const { content, tags = [], context = 'copilot-chat' } = args;
    
    if (!content || typeof content !== 'string') {
      throw new Error('Content is required and must be a string');
    }
    
    const db = this.getDB();
    const id = this.generateId();
    const now = Date.now();
    const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : [tags].filter(Boolean));
    const metadata = JSON.stringify({
      source: 'copilot-chat',
      timestamp: new Date(now).toISOString(),
      project: this.currentProject
    });
    
    // Use prepared statement for speed
    const stmt = this.getStatement(db, 'insert', `
      INSERT INTO knowledge (id, content, tags, metadata, source, context, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, content.trim(), tagsJson, metadata, 'copilot-chat', context, now, now);
    
    const preview = content.length > 100 ? content.substring(0, 100) + '...' : content;
    return {
      content: [{
        type: 'text',
        text: `✅ Stored in SQLite (Direct)\n\n**Content:** ${preview}\n**Tags:** ${tags.join(', ') || 'none'}\n**Project:** ${this.currentProject}\n**ID:** ${id}`
      }]
    };
  }
  
  /**
   * Retrieve knowledge (OPTIMIZED with FTS5)
   */
  private async retrieveKnowledge(args: any): Promise<any> {
    const { query, tags = [], limit = 5 } = args;
    
    if (!query || typeof query !== 'string') {
      throw new Error('Query is required');
    }
    
    const db = this.getDB();
    const searchLimit = Math.min(limit, 20);
    
    // Use FTS5 for fast full-text search
    const stmt = this.getStatement(db, 'searchFts', `
      SELECT k.* FROM knowledge k
      JOIN knowledge_fts fts ON k.rowid = fts.rowid
      WHERE knowledge_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `);
    
    let results = stmt.all(query, searchLimit);
    
    // Filter by tags if specified
    if (Array.isArray(tags) && tags.length > 0) {
      results = results.filter((row: any) => {
        const entryTags = JSON.parse(row.tags || '[]');
        return tags.some(tag => entryTags.includes(tag));
      });
    }
    
    if (results.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `🔍 No knowledge found for: "${query}"`
        }]
      };
    }
    
    const formattedResults = results.map((row: any, index: number) => {
      const entryTags = JSON.parse(row.tags || '[]');
      const tagsStr = entryTags.length > 0 ? ` [${entryTags.join(', ')}]` : '';
      const date = new Date(row.created_at).toLocaleDateString();
      const preview = row.content.length > 300 ? row.content.substring(0, 300) + '...' : row.content;
      
      return `**${index + 1}. ${row.context || 'Knowledge'}**${tagsStr} _(${date})_\n${preview}`;
    }).join('\n\n---\n\n');
    
    return {
      content: [{
        type: 'text',
        text: `🧠 Found ${results.length} entries (FTS5):\n\n${formattedResults}`
      }]
    };
  }
  
  /**
   * List knowledge (OPTIMIZED)
   */
  private async listKnowledge(args: any): Promise<any> {
    const { limit = 10, tags = [], optimize = false } = args;
    
    const db = this.getDB();
    
    // Run optimization if requested
    if (optimize) {
      db.pragma('optimize');
      db.pragma('wal_checkpoint(TRUNCATE)');
    }
    
    // Get count
    const countStmt = this.getStatement(db, 'count', 'SELECT COUNT(*) as count FROM knowledge');
    const countResult = countStmt.get();
    const totalCount = countResult.count;
    
    // Get entries
    let results: any[];
    const searchLimit = Math.min(limit, 50);
    
    if (Array.isArray(tags) && tags.length > 0) {
      const stmt = this.getStatement(db, 'getByTags', `
        SELECT * FROM knowledge 
        WHERE tags LIKE ?
        ORDER BY updated_at DESC 
        LIMIT ?
      `);
      const tagQuery = `%${tags.join('%')}%`;
      results = stmt.all(tagQuery, searchLimit);
    } else {
      const stmt = this.getStatement(db, 'getAll', `
        SELECT * FROM knowledge 
        ORDER BY updated_at DESC 
        LIMIT ?
      `);
      results = stmt.all(searchLimit);
    }
    
    // Get database stats
    const dbPath = this.getDBPath();
    const dbStats = fs.statSync(dbPath);
    const dbSize = (dbStats.size / 1024).toFixed(2);
    
    let response = `📊 **SQLite Direct - "${this.currentProject}":**\n`;
    response += `- Total entries: ${totalCount}\n`;
    response += `- Database size: ${dbSize} KB\n`;
    response += `- Mode: WAL (optimized)\n`;
    if (optimize) response += `- ✅ Optimized\n`;
    response += `\n`;
    
    if (results.length > 0) {
      response += `**Recent Knowledge (${results.length}):**\n\n`;
      
      results.forEach((row: any, index: number) => {
        const entryTags = JSON.parse(row.tags || '[]');
        const tagsStr = entryTags.length > 0 ? ` [${entryTags.join(', ')}]` : '';
        const date = new Date(row.created_at).toLocaleDateString();
        const preview = row.content.substring(0, 150) + (row.content.length > 150 ? '...' : '');
        response += `${index + 1}. **${row.context || 'Knowledge'}**${tagsStr} _(${date})_\n   ${preview}\n\n`;
      });
    } else {
      response += `No entries found.`;
    }
    
    return {
      content: [{
        type: 'text',
        text: response
      }]
    };
  }
  
  /**
   * Switch to different project
   */
  async switchProject(projectName: string): Promise<void> {
    // Clear statement cache when switching projects
    this.statementsCache.clear();
    
    this.currentProject = projectName;
    
    // Warm up the connection
    try {
      this.getDB();
    } catch (error) {
      console.error('Error warming up database:', error);
    }
  }
  
  /**
   * Get current project name
   */
  getCurrentProject(): string | null {
    return this.currentProject;
  }
  
  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }
  
  /**
   * Get statistics for current project
   */
  async getStats(): Promise<{ project: string; count: number; size: string }> {
    if (!this.currentProject) {
      return { project: 'None', count: 0, size: '0 KB' };
    }
    
    try {
      const db = this.getDB();
      const countStmt = this.getStatement(db, 'count', 'SELECT COUNT(*) as count FROM knowledge');
      const result = countStmt.get();
      
      const dbPath = this.getDBPath();
      const stats = fs.statSync(dbPath);
      const sizeKB = (stats.size / 1024).toFixed(2);
      
      return {
        project: this.currentProject,
        count: result.count,
        size: `${sizeKB} KB`
      };
    } catch (error) {
      return { project: this.currentProject, count: 0, size: 'Error' };
    }
  }
  
  /**
   * List all available projects
   */
  async listProjects(): Promise<Array<{ name: string; path: string; size: number; count: number }>> {
    const projects: Array<{ name: string; path: string; size: number; count: number }> = [];
    
    try {
      if (!fs.existsSync(this.dataDir)) {
        return projects;
      }
      
      const files = fs.readdirSync(this.dataDir);
      
      for (const file of files) {
        if (file.endsWith('.db')) {
          const filePath = path.join(this.dataDir, file);
          const stats = fs.statSync(filePath);
          const projectName = path.basename(file, '.db');
          
          // Get count by opening database
          try {
            const db = this.pool.getConnection(filePath);
            const stmt = db.prepare('SELECT COUNT(*) as count FROM knowledge');
            const result = stmt.get();
            
            projects.push({
              name: projectName,
              path: filePath,
              size: stats.size,
              count: result.count
            });
          } catch (error) {
            projects.push({
              name: projectName,
              path: filePath,
              size: stats.size,
              count: 0
            });
          }
        }
      }
    } catch (error) {
      console.error('Error listing projects:', error);
    }
    
    return projects;
  }
  
  /**
   * Cleanup
   */
  dispose(): void {
    this.statementsCache.clear();
    this.pool.closeAll();
  }
}
