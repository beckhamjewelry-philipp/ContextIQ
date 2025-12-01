import { StorageBackend, KnowledgeEntry, SearchQuery, ConflictResolution, SearchResult } from '../types/index.js';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import Fuse from 'fuse.js';
import fs from 'fs/promises';
import path from 'path';

export class LocalStorageBackend implements StorageBackend {
  private db: Database.Database | null = null;
  private dataDir: string;
  private dbPath: string;
  private projectName: string;

  constructor(dataDir: string, projectPath?: string) {
    this.dataDir = dataDir;
    this.projectName = this.getProjectName(projectPath);
    this.dbPath = path.join(dataDir, `${this.projectName}.db`);
  }

  private getProjectName(projectPath?: string): string {
    if (projectPath) {
      // Extract project name from path
      const projectName = path.basename(projectPath);
      // Sanitize filename
      return projectName.replace(/[^a-zA-Z0-9-_]/g, '_');
    }
    
    // Try to detect from current working directory
    const cwd = process.cwd();
    const projectName = path.basename(cwd);
    return projectName.replace(/[^a-zA-Z0-9-_]/g, '_');
  }

  async initialize(): Promise<void> {
    // Create data directory if it doesn't exist
    await fs.mkdir(this.dataDir, { recursive: true });

    // Initialize SQLite database
    this.db = new Database(this.dbPath);

    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_entries (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        tags TEXT, -- JSON array
        metadata TEXT, -- JSON object
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        source TEXT,
        context TEXT,
        embedding TEXT -- JSON array for vector search
      );

      CREATE TABLE IF NOT EXISTS conflict_resolutions (
        id TEXT PRIMARY KEY,
        conflicting_entries TEXT NOT NULL, -- JSON array of UUIDs
        resolution TEXT NOT NULL,
        merged_content TEXT,
        resolved_by TEXT,
        resolved_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_knowledge_content ON knowledge_entries(content);
      CREATE INDEX IF NOT EXISTS idx_knowledge_tags ON knowledge_entries(tags);
      CREATE INDEX IF NOT EXISTS idx_knowledge_source ON knowledge_entries(source);
      CREATE INDEX IF NOT EXISTS idx_knowledge_context ON knowledge_entries(context);
      CREATE INDEX IF NOT EXISTS idx_knowledge_created ON knowledge_entries(created_at);
    `);
  }

  async store(entry: KnowledgeEntry): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO knowledge_entries 
      (id, content, tags, metadata, created_at, updated_at, source, context, embedding)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      entry.id,
      entry.content,
      JSON.stringify(entry.tags),
      JSON.stringify(entry.metadata),
      entry.createdAt.getTime(),
      entry.updatedAt.getTime(),
      entry.source || null,
      entry.context || null,
      entry.embedding ? JSON.stringify(entry.embedding) : null
    );
  }

  async retrieve(query: SearchQuery): Promise<KnowledgeEntry[]> {
    if (!this.db) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM knowledge_entries WHERE 1=1';
    const params: any[] = [];

    if (query.source) {
      sql += ' AND source = ?';
      params.push(query.source);
    }

    if (query.context) {
      sql += ' AND context = ?';
      params.push(query.context);
    }

    if (query.tags && query.tags.length > 0) {
      // Simple tag search - could be improved with better JSON querying
      const tagConditions = query.tags.map(() => 'tags LIKE ?').join(' OR ');
      sql += ` AND (${tagConditions})`;
      query.tags.forEach(tag => params.push(`%"${tag}"%`));
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(query.limit);

    const rows = this.db.prepare(sql).all(...params);
    const entries = rows.map(this.rowToEntry);

    // Perform fuzzy search on content if query text provided
    if (query.query.trim()) {
      const fuse = new Fuse(entries, {
        keys: ['content'],
        threshold: query.minScore ? 1 - query.minScore : 0.3,
        includeScore: true
      });

      const results = fuse.search(query.query);
      return results
        .filter((result: any) => !query.minScore || (result.score && result.score <= (1 - query.minScore)))
        .map((result: any) => result.item)
        .slice(0, query.limit);
    }

    return entries;
  }

  async update(id: string, updates: Partial<KnowledgeEntry>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const existing = await this.getById(id);
    if (!existing) throw new Error(`Entry with id ${id} not found`);

    const updated: KnowledgeEntry = {
      ...existing,
      ...updates,
      id, // Ensure ID doesn't change
      updatedAt: new Date()
    };

    await this.store(updated);
  }

  async delete(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('DELETE FROM knowledge_entries WHERE id = ?');
    stmt.run(id);
  }

  async getById(id: string): Promise<KnowledgeEntry | null> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM knowledge_entries WHERE id = ?');
    const row = stmt.get(id);

    return row ? this.rowToEntry(row) : null;
  }

  async detectConflicts(entry: KnowledgeEntry): Promise<ConflictResolution[]> {
    if (!this.db) throw new Error('Database not initialized');

    // Simple conflict detection based on similar content
    const similarEntries = await this.retrieve({
      query: entry.content.slice(0, 100), // Use first 100 chars
      limit: 5,
      minScore: 0.8,
      source: entry.source,
      context: entry.context
    });

    const conflicts: ConflictResolution[] = [];

    for (const similar of similarEntries) {
      if (similar.id !== entry.id && this.isSimilarContent(entry.content, similar.content)) {
        conflicts.push({
          id: uuidv4(),
          conflictingEntries: [entry.id, similar.id],
          resolution: 'keep_both', // Default resolution
          resolvedAt: new Date()
        });
      }
    }

    return conflicts;
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private rowToEntry(row: any): KnowledgeEntry {
    return {
      id: row.id,
      content: row.content,
      tags: row.tags ? JSON.parse(row.tags) : [],
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      source: row.source || undefined,
      context: row.context || undefined,
      embedding: row.embedding ? JSON.parse(row.embedding) : undefined
    };
  }

  private isSimilarContent(content1: string, content2: string, threshold = 0.8): boolean {
    // Simple similarity check - could be improved with better algorithms
    const words1 = new Set(content1.toLowerCase().split(/\s+/));
    const words2 = new Set(content2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size >= threshold;
  }
}