import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import Fuse from 'fuse.js';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['*'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Database setup
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'copilot-memory.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// Initialize database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS knowledge_entries (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    tags TEXT,
    metadata TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    source TEXT,
    context TEXT,
    embedding TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_knowledge_content ON knowledge_entries(content);
  CREATE INDEX IF NOT EXISTS idx_knowledge_tags ON knowledge_entries(tags);
  CREATE INDEX IF NOT EXISTS idx_knowledge_source ON knowledge_entries(source);
  CREATE INDEX IF NOT EXISTS idx_knowledge_context ON knowledge_entries(context);
  CREATE INDEX IF NOT EXISTS idx_knowledge_created ON knowledge_entries(created_at);
`);

// Helper functions
function rowToEntry(row: any) {
  return {
    id: row.id,
    content: row.content,
    tags: row.tags ? JSON.parse(row.tags) : [],
    metadata: row.metadata ? JSON.parse(row.metadata) : {},
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    source: row.source || undefined,
    context: row.context || undefined,
    embedding: row.embedding ? JSON.parse(row.embedding) : undefined
  };
}

function isSimilarContent(content1: string, content2: string, threshold = 0.8): boolean {
  const words1 = new Set(content1.toLowerCase().split(/\s+/));
  const words2 = new Set(content2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(word => words2.has(word)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size >= threshold;
}

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: 'connected',
    version: '1.0.0'
  });
});

// Store knowledge
app.post('/api/knowledge', (req, res) => {
  try {
    const { messages, content, tags = [], metadata = {}, source, context } = req.body;
    
    const entry = {
      id: uuidv4(),
      content: messages || content,
      tags: JSON.stringify(tags),
      metadata: JSON.stringify(metadata),
      created_at: Date.now(),
      updated_at: Date.now(),
      source: source || null,
      context: context || null,
      embedding: null
    };

    const stmt = db.prepare(`
      INSERT INTO knowledge_entries 
      (id, content, tags, metadata, created_at, updated_at, source, context, embedding)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      entry.id,
      entry.content,
      entry.tags,
      entry.metadata,
      entry.created_at,
      entry.updated_at,
      entry.source,
      entry.context,
      entry.embedding
    );

    res.status(201).json({
      success: true,
      id: entry.id,
      message: 'Knowledge stored successfully'
    });
  } catch (error) {
    console.error('Error storing knowledge:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to store knowledge',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Search knowledge
app.post('/api/knowledge/search', (req, res) => {
  try {
    const { query = '', limit = 10, tags, source, context, minScore } = req.body;

    let sql = 'SELECT * FROM knowledge_entries WHERE 1=1';
    const params: any[] = [];

    if (source) {
      sql += ' AND source = ?';
      params.push(source);
    }

    if (context) {
      sql += ' AND context = ?';
      params.push(context);
    }

    if (tags && tags.length > 0) {
      const tagConditions = tags.map(() => 'tags LIKE ?').join(' OR ');
      sql += ` AND (${tagConditions})`;
      tags.forEach((tag: string) => params.push(`%"${tag}"%`));
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const rows = db.prepare(sql).all(...params);
    let results = rows.map(rowToEntry);

    // Perform fuzzy search if query provided
    if (query.trim()) {
      const fuse = new Fuse(results, {
        keys: ['content'],
        threshold: minScore ? 1 - minScore : 0.3,
        includeScore: true
      });

      const searchResults = fuse.search(query);
      results = searchResults
        .filter(result => !minScore || (result.score && result.score <= (1 - minScore)))
        .map(result => result.item)
        .slice(0, limit);
    }

    res.json({
      results,
      count: results.length,
      query
    });
  } catch (error) {
    console.error('Error searching knowledge:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search knowledge',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get knowledge by ID
app.get('/api/knowledge/:id', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM knowledge_entries WHERE id = ?');
    const row = stmt.get(req.params.id);

    if (!row) {
      return res.status(404).json({
        success: false,
        message: 'Knowledge entry not found'
      });
    }

    res.json(rowToEntry(row));
  } catch (error) {
    console.error('Error getting knowledge:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get knowledge',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update knowledge
app.patch('/api/knowledge/:id', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM knowledge_entries WHERE id = ?');
    const existing = stmt.get(req.params.id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Knowledge entry not found'
      });
    }

    const updates = req.body;
    const updateFields = [];
    const updateParams = [];

    if (updates.content !== undefined) {
      updateFields.push('content = ?');
      updateParams.push(updates.content);
    }

    if (updates.tags !== undefined) {
      updateFields.push('tags = ?');
      updateParams.push(JSON.stringify(updates.tags));
    }

    if (updates.metadata !== undefined) {
      updateFields.push('metadata = ?');
      updateParams.push(JSON.stringify(updates.metadata));
    }

    if (updates.source !== undefined) {
      updateFields.push('source = ?');
      updateParams.push(updates.source);
    }

    if (updates.context !== undefined) {
      updateFields.push('context = ?');
      updateParams.push(updates.context);
    }

    updateFields.push('updated_at = ?');
    updateParams.push(Date.now());
    updateParams.push(req.params.id);

    const updateStmt = db.prepare(`
      UPDATE knowledge_entries 
      SET ${updateFields.join(', ')} 
      WHERE id = ?
    `);

    updateStmt.run(...updateParams);

    res.json({
      success: true,
      message: 'Knowledge updated successfully'
    });
  } catch (error) {
    console.error('Error updating knowledge:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update knowledge',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Delete knowledge
app.delete('/api/knowledge/:id', (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM knowledge_entries WHERE id = ?');
    const result = stmt.run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: 'Knowledge entry not found'
      });
    }

    res.json({
      success: true,
      message: 'Knowledge deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting knowledge:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete knowledge',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Detect conflicts
app.post('/api/knowledge/conflicts', (req, res) => {
  try {
    const { content, id } = req.body;
    const conflicts = [];

    const stmt = db.prepare('SELECT * FROM knowledge_entries WHERE id != ?');
    const entries = stmt.all(id || 'new-entry').map(rowToEntry);

    for (const entry of entries) {
      if (isSimilarContent(content, entry.content)) {
        conflicts.push({
          id: uuidv4(),
          conflictingEntries: [id || 'new-entry', entry.id],
          resolution: 'keep_both',
          resolvedAt: new Date().toISOString()
        });
      }
    }

    res.json(conflicts);
  } catch (error) {
    console.error('Error detecting conflicts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to detect conflicts',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get all knowledge (for export)
app.get('/api/knowledge', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 1000;
    const stmt = db.prepare('SELECT * FROM knowledge_entries ORDER BY created_at DESC LIMIT ?');
    const rows = stmt.all(limit);
    const results = rows.map(rowToEntry);

    const totalResult = db.prepare('SELECT COUNT(*) as count FROM knowledge_entries').get() as { count: number };
    
    res.json({
      results,
      count: results.length,
      total: totalResult.count
    });
  } catch (error) {
    console.error('Error getting all knowledge:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get knowledge',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Statistics endpoint
app.get('/api/stats', (req, res) => {
  try {
    const totalResult = db.prepare('SELECT COUNT(*) as count FROM knowledge_entries').get() as { count: number };
    const totalCount = totalResult.count;
    const sourceStats = db.prepare(`
      SELECT source, COUNT(*) as count 
      FROM knowledge_entries 
      WHERE source IS NOT NULL 
      GROUP BY source
    `).all();
    const contextStats = db.prepare(`
      SELECT context, COUNT(*) as count 
      FROM knowledge_entries 
      WHERE context IS NOT NULL 
      GROUP BY context
    `).all();

    res.json({
      total: totalCount,
      by_source: sourceStats,
      by_context: contextStats,
      database_size: fs.statSync(DB_PATH).size
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🧠 Copilot Memory API Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API docs: http://localhost:${PORT}/api/stats`);
  console.log(`💾 Database: ${DB_PATH}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  db.close();
  process.exit(0);
});

export default app;