import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import express from 'express';
import cors from 'cors';
import { KnowledgeEntry, SearchQuery } from '../../shared/src/types';

// Initialize Firebase Admin
admin.initializeApp();

// Create Express app
const app = express();

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());

// In-memory storage for demo (replace with Firestore in production)
const memoryStore = new Map<string, KnowledgeEntry>();

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Store knowledge endpoint
app.post('/knowledge', (req, res) => {
  try {
    const entry: KnowledgeEntry = {
      id: req.body.id || generateId(),
      content: req.body.messages || req.body.content,
      tags: req.body.tags || [],
      metadata: req.body.metadata || {},
      createdAt: new Date(),
      updatedAt: new Date(),
      source: req.body.source,
      context: req.body.context,
      embedding: req.body.embedding
    };

    memoryStore.set(entry.id, entry);

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

// Search knowledge endpoint
app.post('/knowledge/search', (req, res) => {
  try {
    const query: SearchQuery = req.body;
    const allEntries = Array.from(memoryStore.values());
    
    let results = allEntries;

    // Filter by source
    if (query.source) {
      results = results.filter(entry => entry.source === query.source);
    }

    // Filter by context
    if (query.context) {
      results = results.filter(entry => entry.context === query.context);
    }

    // Filter by tags
    if (query.tags && query.tags.length > 0) {
      results = results.filter(entry => 
        query.tags!.some(tag => entry.tags.includes(tag))
      );
    }

    // Simple text search
    if (query.query.trim()) {
      results = results.filter(entry =>
        entry.content.toLowerCase().includes(query.query.toLowerCase())
      );
    }

    // Sort by creation date (newest first)
    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Limit results
    const limit = query.limit || 10;
    results = results.slice(0, limit);

    res.status(200).json(results);
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
app.get('/knowledge/:id', (req, res) => {
  try {
    const entry = memoryStore.get(req.params.id);
    
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Knowledge entry not found'
      });
    }

    return res.status(200).json(entry);
  } catch (error) {
    console.error('Error getting knowledge:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get knowledge',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update knowledge
app.patch('/knowledge/:id', (req, res) => {
  try {
    const entry = memoryStore.get(req.params.id);
    
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Knowledge entry not found'
      });
    }

    const updates = req.body;
    const updatedEntry: KnowledgeEntry = {
      ...entry,
      ...updates,
      id: req.params.id, // Ensure ID doesn't change
      updatedAt: new Date()
    };

    memoryStore.set(req.params.id, updatedEntry);

    return res.status(200).json({
      success: true,
      message: 'Knowledge updated successfully'
    });
  } catch (error) {
    console.error('Error updating knowledge:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update knowledge',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Delete knowledge
app.delete('/knowledge/:id', (req, res) => {
  try {
    const existed = memoryStore.delete(req.params.id);
    
    if (!existed) {
      return res.status(404).json({
        success: false,
        message: 'Knowledge entry not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Knowledge deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting knowledge:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete knowledge',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Detect conflicts endpoint
app.post('/knowledge/conflicts', (req, res) => {
  try {
    const entry: KnowledgeEntry = req.body;
    const conflicts = [];

    // Simple conflict detection - check for similar content
    for (const [id, existingEntry] of memoryStore.entries()) {
      if (id !== entry.id && isSimilarContent(entry.content, existingEntry.content)) {
        conflicts.push({
          id: generateId(),
          conflictingEntries: [entry.id, id],
          resolution: 'keep_both',
          resolvedAt: new Date()
        });
      }
    }

    res.status(200).json(conflicts);
  } catch (error) {
    console.error('Error detecting conflicts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to detect conflicts',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Utility functions
function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function isSimilarContent(content1: string, content2: string, threshold = 0.8): boolean {
  const words1 = new Set(content1.toLowerCase().split(/\s+/));
  const words2 = new Set(content2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(word => words2.has(word)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size >= threshold;
}

// Export the API as a Firebase Function
export const api = functions.https.onRequest(app);