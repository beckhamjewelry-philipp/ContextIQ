#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');

// KnowledgeEntry structure:
// {
//   id: string;
//   content: string;
//   tags: string[];
//   metadata: object;
//   createdAt: Date;
//   updatedAt: Date;
//   source?: string;
//   context?: string;
// }

class CopilotMemoryServer {

  constructor() {
    this.storageDir = path.join(os.homedir(), '.copilot-memory');
    this.server = new Server(
      {
        name: 'copilot-memory-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'store_knowledge',
            description: 'Store knowledge in memory when user says "remember" this information',
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
                }
              },
              required: ['content']
            }
          },
          {
            name: 'retrieve_knowledge',
            description: 'Retrieve knowledge from memory when user asks to find or recall information',
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
                }
              },
              required: ['query']
            }
          },
          {
            name: 'list_knowledge',
            description: 'List stored knowledge or get memory statistics',
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
                }
              }
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
            return await this.storeKnowledge(args);
          case 'retrieve_knowledge':
            return await this.retrieveKnowledge(args);
          case 'list_knowledge':
            return await this.listKnowledge(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error: any) {
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

  private async ensureStorageDir() {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  private getProjectDatabasePath(): string {
    // Use current working directory name as project identifier
    const cwd = process.cwd();
    const projectName = path.basename(cwd);
    return path.join(this.storageDir, `${projectName}.json`);
  }

  private async loadDatabase(): Promise<Map<string, KnowledgeEntry>> {
    const dbPath = this.getProjectDatabasePath();
    
    try {
      const data = await fs.readFile(dbPath, 'utf8');
      const entries = JSON.parse(data);
      const map = new Map<string, KnowledgeEntry>();
      
      for (const entry of entries) {
        // Convert date strings back to Date objects
        entry.createdAt = new Date(entry.createdAt);
        entry.updatedAt = new Date(entry.updatedAt);
        map.set(entry.id, entry);
      }
      
      return map;
    } catch (error) {
      // Return empty map if file doesn't exist
      return new Map();
    }
  }

  private async saveDatabase(entries: Map<string, KnowledgeEntry>): Promise<void> {
    await this.ensureStorageDir();
    const dbPath = this.getProjectDatabasePath();
    const data = Array.from(entries.values());
    await fs.writeFile(dbPath, JSON.stringify(data, null, 2));
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  private async storeKnowledge(args: any) {
    const { content, tags = [], context = 'copilot-chat' } = args;

    if (!content || typeof content !== 'string') {
      throw new Error('Content is required and must be a string');
    }

    const entries = await this.loadDatabase();
    const now = new Date();
    
    const entry: KnowledgeEntry = {
      id: this.generateId(),
      content: content.trim(),
      tags: Array.isArray(tags) ? tags : [tags].filter(Boolean),
      metadata: {
        source: 'copilot-chat',
        timestamp: now.toISOString(),
        project: path.basename(process.cwd())
      },
      createdAt: now,
      updatedAt: now,
      source: 'copilot-chat',
      context: context
    };

    entries.set(entry.id, entry);
    await this.saveDatabase(entries);

    const preview = content.length > 100 ? content.substring(0, 100) + '...' : content;
    return {
      content: [{
        type: 'text',
        text: `✅ Successfully stored knowledge!\n\n**Content:** ${preview}\n**Tags:** ${tags.join(', ') || 'none'}\n**Project:** ${path.basename(process.cwd())}`
      }]
    };
  }

  private async retrieveKnowledge(args: any) {
    const { query, tags = [], limit = 5 } = args;

    if (!query || typeof query !== 'string') {
      throw new Error('Query is required and must be a string');
    }

    const entries = await this.loadDatabase();
    const searchTerm = query.toLowerCase();
    
    let results = Array.from(entries.values()).filter(entry => {
      const matchesContent = entry.content.toLowerCase().includes(searchTerm);
      const matchesTags = entry.tags.some(tag => tag.toLowerCase().includes(searchTerm));
      const matchesContext = entry.context?.toLowerCase().includes(searchTerm) || false;
      
      return matchesContent || matchesTags || matchesContext;
    });

    // Filter by tags if specified
    if (Array.isArray(tags) && tags.length > 0) {
      results = results.filter(entry => 
        tags.some(tag => entry.tags.includes(tag))
      );
    }

    // Sort by most recent
    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply limit
    results = results.slice(0, Math.min(limit, 20));

    if (results.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `🔍 No knowledge found for query: "${query}"`
        }]
      };
    }

    const formattedResults = results.map((entry, index) => {
      const tagsStr = entry.tags.length > 0 ? ` [${entry.tags.join(', ')}]` : '';
      const date = entry.createdAt.toLocaleDateString();
      const preview = entry.content.length > 300 ? entry.content.substring(0, 300) + '...' : entry.content;
      
      return `**${index + 1}. ${entry.context || 'Knowledge'}**${tagsStr} _(${date})_\n${preview}`;
    }).join('\n\n---\n\n');

    return {
      content: [{
        type: 'text',
        text: `🧠 Found ${results.length} knowledge entries for "${query}":\n\n${formattedResults}`
      }]
    };
  }

  private async listKnowledge(args: any) {
    const { limit = 10, tags = [] } = args;
    
    const entries = await this.loadDatabase();
    let results = Array.from(entries.values());

    // Filter by tags if specified
    if (Array.isArray(tags) && tags.length > 0) {
      results = results.filter(entry => 
        tags.some(tag => entry.tags.includes(tag))
      );
    }

    // Sort by most recent
    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const projectName = path.basename(process.cwd());
    let response = `📊 **Memory Statistics for "${projectName}":**\n`;
    response += `- Total entries: ${entries.size}\n`;
    response += `- Filtered entries: ${results.length}\n\n`;

    if (results.length > 0) {
      const displayResults = results.slice(0, Math.min(limit, 20));
      response += `**Recent Knowledge (${displayResults.length} of ${results.length}):**\n\n`;
      
      displayResults.forEach((entry, index) => {
        const tagsStr = entry.tags.length > 0 ? ` [${entry.tags.join(', ')}]` : '';
        const date = entry.createdAt.toLocaleDateString();
        const preview = entry.content.substring(0, 150) + (entry.content.length > 150 ? '...' : '');
        response += `${index + 1}. **${entry.context || 'Knowledge'}**${tagsStr} _(${date})_\n   ${preview}\n\n`;
      });
    } else {
      response += `No knowledge entries found${tags.length > 0 ? ` with tags: ${tags.join(', ')}` : ''}.`;
    }

    return {
      content: [{
        type: 'text',
        text: response
      }]
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

// Start the server
const server = new CopilotMemoryServer();
server.run().catch(console.error);