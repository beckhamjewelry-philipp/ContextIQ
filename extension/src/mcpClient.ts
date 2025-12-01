import * as vscode from 'vscode';
import { Client } from '@modelcontextprotocol/sdk/client/index';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { ConfigurationManager } from './configuration';

export interface KnowledgeEntry {
  id?: string;
  messages: string;
  tags?: string[];
  source?: string;
  context?: string;
  metadata?: Record<string, unknown>;
}

export interface SearchQuery {
  query: string;
  limit?: number;
  tags?: string[];
  source?: string;
  context?: string;
  minScore?: number;
}

export class MCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;

  constructor(private configManager: ConfigurationManager) {}

  async connect(): Promise<void> {
    if (this.client) {
      await this.disconnect();
    }

    const serverPath = this.configManager.getServerPath();
    if (!serverPath) {
      throw new Error('MCP server path not configured');
    }

    try {
      this.transport = new StdioClientTransport({
        command: serverPath,
        args: []
      });

      this.client = new Client({
        name: 'copilot-memory-extension',
        version: '1.0.0'
      }, {
        capabilities: {}
      });

      await this.client.connect(this.transport);
    } catch (error) {
      await this.disconnect();
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
  }

  async reconnect(): Promise<void> {
    await this.disconnect();
    await this.connect();
  }

  async storeKnowledge(entry: KnowledgeEntry): Promise<any> {
    if (!this.client) {
      throw new Error('MCP client not connected');
    }

    const result = await this.client.callTool({
      name: 'store-knowledge',
      arguments: entry as unknown as Record<string, unknown>
    });

    return result;
  }

  async retrieveKnowledge(query: SearchQuery): Promise<any[]> {
    if (!this.client) {
      throw new Error('MCP client not connected');
    }

    const result = await this.client.callTool({
      name: 'retrieve-knowledge',
      arguments: query as unknown as Record<string, unknown>
    });

    if (result.content && Array.isArray(result.content) && result.content[0] && 'text' in result.content[0]) {
      const parsed = JSON.parse((result.content[0] as any).text);
      return parsed.results || [];
    }

    return [];
  }

  async manageKnowledge(operation: 'get' | 'update' | 'delete', id: string, updates?: any): Promise<any> {
    if (!this.client) {
      throw new Error('MCP client not connected');
    }

    const result = await this.client.callTool({
      name: 'manage-knowledge',
      arguments: {
        operation,
        id,
        updates
      }
    });

    return result;
  }

  isConnected(): boolean {
    return this.client !== null;
  }
}