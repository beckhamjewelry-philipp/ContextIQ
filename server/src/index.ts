#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Config, ConfigSchema, StorageBackend } from './types/index.js';
import { createStorageBackend } from './storage/index.js';
import { StoreKnowledgeTool, RetrieveKnowledgeTool, ManageKnowledgeTool } from './tools/index.js';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import { config } from 'dotenv';

// Load environment variables
config();

class CopilotMemoryMCPServer {
  private server: Server;
  private storage: StorageBackend | null = null;
  private tools: Map<string, any> = new Map();

  constructor() {
    this.server = new Server({
      name: 'copilot-memory-mcp',
      version: '1.0.0',
    }, {
      capabilities: {
        tools: {},
      },
    });

    this.setupHandlers();
  }

  private async loadConfig(): Promise<Config> {
    const configPaths = [
      process.env.COPILOT_MEMORY_CONFIG,
      path.join(process.cwd(), 'copilot-memory.config.json'),
      path.join(os.homedir(), '.copilot-memory', 'config.json'),
    ].filter(Boolean);

    let configData = null;

    for (const configPath of configPaths) {
      try {
        const content = await fs.readFile(configPath!, 'utf-8');
        configData = JSON.parse(content);
        break;
      } catch (error) {
        // Continue to next path
      }
    }

    if (!configData) {
      // Default configuration
      const defaultDataDir = path.join(os.homedir(), '.copilot-memory');
      await fs.mkdir(defaultDataDir, { recursive: true });

      configData = {
        storage: {
          type: 'local',
          local: {
            dataDir: defaultDataDir
          }
        },
        logging: {
          level: 'info'
        }
      };

      // Save default config
      const configPath = path.join(defaultDataDir, 'config.json');
      await fs.writeFile(configPath, JSON.stringify(configData, null, 2));
    }

    return ConfigSchema.parse(configData);
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: Array.from(this.tools.values()).map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const tool = this.tools.get(name);

      if (!tool) {
        throw new Error(`Unknown tool: ${name}`);
      }

      try {
        const result = await tool.execute(args || {});
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        throw new Error(`Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });
  }

  async initialize(): Promise<void> {
    const config = await this.loadConfig();
    
    // Get current project path (workspace directory)
    const projectPath = process.env.COPILOT_MEMORY_PROJECT_PATH || process.cwd();
    
    // Initialize storage with project-specific database
    this.storage = createStorageBackend(config.storage, projectPath);
    await this.storage.initialize();

    // Initialize tools
    this.tools.set('store-knowledge', new StoreKnowledgeTool(this.storage));
    this.tools.set('retrieve-knowledge', new RetrieveKnowledgeTool(this.storage));
    this.tools.set('manage-knowledge', new ManageKnowledgeTool(this.storage));
  }

  async run(): Promise<void> {
    await this.initialize();

    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    // Graceful shutdown
    const cleanup = async () => {
      if (this.storage) {
        await this.storage.close();
      }
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  }
}

// Run server if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new CopilotMemoryMCPServer();
  server.run().catch((error) => {
    console.error('Failed to run server:', error);
    process.exit(1);
  });
}

export { CopilotMemoryMCPServer };