import { MCPTool, KnowledgeEntry, StorageBackend, SearchQuery } from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

export class StoreKnowledgeTool implements MCPTool {
  name = 'store-knowledge';
  description = 'Store knowledge by extracting programming facts from human-AI interactions';

  inputSchema = {
    type: 'object',
    properties: {
      messages: {
        type: 'string',
        description: 'Content to store as knowledge'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional tags to categorize the knowledge'
      },
      source: {
        type: 'string',
        description: 'Source of the knowledge (e.g., copilot, agent name)'
      },
      context: {
        type: 'string',
        description: 'Context where this knowledge applies (e.g., workspace, project)'
      },
      metadata: {
        type: 'object',
        description: 'Additional metadata for the knowledge entry'
      }
    },
    required: ['messages'],
    additionalProperties: false
  };

  constructor(private storage: StorageBackend) {}

  async execute(args: Record<string, unknown>) {
    const input = z.object({
      messages: z.string(),
      tags: z.array(z.string()).optional(),
      source: z.string().optional(),
      context: z.string().optional(),
      metadata: z.record(z.unknown()).optional()
    }).parse(args);

    const entry: KnowledgeEntry = {
      id: uuidv4(),
      content: input.messages,
      tags: input.tags || [],
      metadata: input.metadata || {},
      createdAt: new Date(),
      updatedAt: new Date(),
      source: input.source,
      context: input.context
    };

    // Check for conflicts
    const conflicts = await this.storage.detectConflicts(entry);
    let conflictResolutionUrl = '';
    
    if (conflicts.length > 0) {
      conflictResolutionUrl = `vscode://copilot-memory-mcp.resolve-conflicts?id=${entry.id}&conflicts=${encodeURIComponent(JSON.stringify(conflicts.map(c => c.id)))}`;
    }

    await this.storage.store(entry);

    return {
      success: true,
      id: entry.id,
      message: 'Knowledge stored successfully',
      conflictResolutionUrl: conflictResolutionUrl || undefined
    };
  }
}

export class RetrieveKnowledgeTool implements MCPTool {
  name = 'retrieve-knowledge';
  description = 'Retrieve knowledge from memory system with intelligent query routing';

  inputSchema = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query'
      },
      limit: {
        type: 'number',
        default: 3,
        description: 'Maximum number of results to return'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by tags'
      },
      source: {
        type: 'string',
        description: 'Filter by source'
      },
      context: {
        type: 'string',
        description: 'Filter by context'
      },
      minScore: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Minimum similarity score'
      }
    },
    required: ['query'],
    additionalProperties: false
  };

  constructor(private storage: StorageBackend) {}

  async execute(args: Record<string, unknown>) {
    const query = z.object({
      query: z.string(),
      limit: z.number().min(1).max(100).default(3),
      tags: z.array(z.string()).optional(),
      source: z.string().optional(),
      context: z.string().optional(),
      minScore: z.number().min(0).max(1).optional()
    }).parse(args);

    const results = await this.storage.retrieve(query);
    
    // Check for conflicts in retrieved results
    const conflicts = [];
    for (const result of results) {
      const entryConflicts = await this.storage.detectConflicts(result);
      conflicts.push(...entryConflicts);
    }

    let conflictResolutionUrl = '';
    if (conflicts.length > 0) {
      const conflictIds = conflicts.map(c => c.id);
      conflictResolutionUrl = `vscode://copilot-memory-mcp.resolve-conflicts?conflicts=${encodeURIComponent(JSON.stringify(conflictIds))}`;
    }

    return {
      results: results.map(entry => ({
        id: entry.id,
        content: entry.content,
        tags: entry.tags,
        metadata: entry.metadata,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
        source: entry.source,
        context: entry.context
      })),
      count: results.length,
      conflictResolutionUrl: conflictResolutionUrl || undefined
    };
  }
}

export class ManageKnowledgeTool implements MCPTool {
  name = 'manage-knowledge';
  description = 'Manage knowledge entries (update, delete, get by ID)';

  inputSchema = {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['update', 'delete', 'get'],
        description: 'Operation to perform'
      },
      id: {
        type: 'string',
        description: 'ID of the knowledge entry'
      },
      updates: {
        type: 'object',
        description: 'Updates to apply (for update operation)'
      }
    },
    required: ['operation', 'id'],
    additionalProperties: false
  };

  constructor(private storage: StorageBackend) {}

  async execute(args: Record<string, unknown>) {
    const input = z.object({
      operation: z.enum(['update', 'delete', 'get']),
      id: z.string(),
      updates: z.record(z.unknown()).optional()
    }).parse(args);

    switch (input.operation) {
      case 'get':
        const entry = await this.storage.getById(input.id);
        if (!entry) {
          return { success: false, message: 'Entry not found' };
        }
        return {
          success: true,
          entry: {
            id: entry.id,
            content: entry.content,
            tags: entry.tags,
            metadata: entry.metadata,
            createdAt: entry.createdAt.toISOString(),
            updatedAt: entry.updatedAt.toISOString(),
            source: entry.source,
            context: entry.context
          }
        };

      case 'update':
        if (!input.updates) {
          return { success: false, message: 'Updates required for update operation' };
        }
        await this.storage.update(input.id, input.updates);
        return { success: true, message: 'Entry updated successfully' };

      case 'delete':
        await this.storage.delete(input.id);
        return { success: true, message: 'Entry deleted successfully' };

      default:
        return { success: false, message: 'Invalid operation' };
    }
  }
}