export interface KnowledgeEntry {
  id: string;
  content: string;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  source?: string;
  context?: string;
  embedding?: number[];
}

export interface SearchQuery {
  query: string;
  limit?: number;
  tags?: string[];
  source?: string;
  context?: string;
  minScore?: number;
}

export interface SearchResult {
  entry: KnowledgeEntry;
  score: number;
  highlights?: string[];
}

export interface ConflictResolution {
  id: string;
  conflictingEntries: string[];
  resolution: 'merge' | 'replace' | 'keep_both';
  mergedContent?: string;
  resolvedBy?: string;
  resolvedAt: Date;
}

export interface StorageConfig {
  type: 'local' | 'server' | 'both';
  local?: {
    dataDir: string;
    dbPath?: string;
  };
  server?: {
    url: string;
    apiKey?: string;
    timeout: number;
  };
}

export interface ExtensionConfig {
  storage: StorageConfig;
  mcp: {
    serverPath?: string;
    autoStart: boolean;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    file?: string;
  };
}

export interface MCPToolRequest {
  name: string;
  arguments: Record<string, unknown>;
}

export interface MCPToolResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
}

export interface StoreKnowledgeRequest {
  messages: string;
  tags?: string[];
  source?: string;
  context?: string;
  metadata?: Record<string, unknown>;
}

export interface RetrieveKnowledgeRequest {
  query: string;
  limit?: number;
  tags?: string[];
  source?: string;
  context?: string;
  minScore?: number;
}

export interface ManageKnowledgeRequest {
  operation: 'get' | 'update' | 'delete';
  id: string;
  updates?: Record<string, unknown>;
}