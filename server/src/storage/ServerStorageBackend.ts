import { StorageBackend, KnowledgeEntry, SearchQuery, ConflictResolution } from '../types/index.js';
import fetch from 'node-fetch';

export interface ServerStorageConfig {
  url: string;
  apiKey?: string;
  timeout: number;
}

export class ServerStorageBackend implements StorageBackend {
  private config: ServerStorageConfig;

  constructor(config: ServerStorageConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Test connection to server
    try {
      const response = await this.makeRequest('/health', 'GET');
      if (!response.ok) {
        throw new Error(`Server not accessible: ${response.status}`);
      }
    } catch (error) {
      throw new Error(`Failed to initialize server storage: ${error}`);
    }
  }

  async store(entry: KnowledgeEntry): Promise<void> {
    const response = await this.makeRequest('/knowledge', 'POST', entry);
    if (!response.ok) {
      throw new Error(`Failed to store entry: ${response.statusText}`);
    }
  }

  async retrieve(query: SearchQuery): Promise<KnowledgeEntry[]> {
    const response = await this.makeRequest('/knowledge/search', 'POST', query);
    if (!response.ok) {
      throw new Error(`Failed to retrieve entries: ${response.statusText}`);
    }
    return await response.json() as KnowledgeEntry[];
  }

  async update(id: string, updates: Partial<KnowledgeEntry>): Promise<void> {
    const response = await this.makeRequest(`/knowledge/${id}`, 'PATCH', updates);
    if (!response.ok) {
      throw new Error(`Failed to update entry: ${response.statusText}`);
    }
  }

  async delete(id: string): Promise<void> {
    const response = await this.makeRequest(`/knowledge/${id}`, 'DELETE');
    if (!response.ok) {
      throw new Error(`Failed to delete entry: ${response.statusText}`);
    }
  }

  async getById(id: string): Promise<KnowledgeEntry | null> {
    const response = await this.makeRequest(`/knowledge/${id}`, 'GET');
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`Failed to get entry: ${response.statusText}`);
    }
    return await response.json() as KnowledgeEntry;
  }

  async detectConflicts(entry: KnowledgeEntry): Promise<ConflictResolution[]> {
    const response = await this.makeRequest('/knowledge/conflicts', 'POST', entry);
    if (!response.ok) {
      throw new Error(`Failed to detect conflicts: ${response.statusText}`);
    }
    return await response.json() as ConflictResolution[];
  }

  async close(): Promise<void> {
    // No cleanup needed for HTTP client
  }

  private async makeRequest(
    endpoint: string, 
    method: string, 
    body?: any
  ): Promise<Response> {
    const url = `${this.config.url}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });
      return response;
    } finally {
      clearTimeout(timeout);
    }
  }
}