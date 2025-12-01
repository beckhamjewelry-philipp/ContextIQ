import { z } from 'zod';

// Configuration schemas
export const StorageConfigSchema = z.object({
  type: z.enum(['local', 'server', 'both']),
  local: z.object({
    dataDir: z.string(),
    dbPath: z.string().optional()
  }).optional(),
  server: z.object({
    url: z.string().url(),
    apiKey: z.string().optional(),
    timeout: z.number().default(10000)
  }).optional()
});

export const ServerConfigSchema = z.object({
  port: z.number().default(3000),
  host: z.string().default('localhost'),
  corsOrigins: z.array(z.string()).default(['*']),
  rateLimit: z.object({
    windowMs: z.number().default(900000), // 15 minutes
    maxRequests: z.number().default(100)
  }).default({})
});

export const ConfigSchema = z.object({
  storage: StorageConfigSchema,
  server: ServerConfigSchema.optional(),
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    file: z.string().optional()
  }).default({})
});

// Knowledge entry schemas
export const KnowledgeEntrySchema = z.object({
  id: z.string().uuid(),
  content: z.string(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.date(),
  updatedAt: z.date(),
  source: z.string().optional(), // copilot, agent name, etc.
  context: z.string().optional(), // workspace, project context
  embedding: z.array(z.number()).optional() // for semantic search
});

export const SearchQuerySchema = z.object({
  query: z.string(),
  limit: z.number().min(1).max(100).default(10),
  tags: z.array(z.string()).optional(),
  source: z.string().optional(),
  context: z.string().optional(),
  minScore: z.number().min(0).max(1).optional()
});

export const ConflictResolutionSchema = z.object({
  id: z.string().uuid(),
  conflictingEntries: z.array(z.string().uuid()),
  resolution: z.enum(['merge', 'replace', 'keep_both']),
  mergedContent: z.string().optional(),
  resolvedBy: z.string().optional(),
  resolvedAt: z.date()
});

// Type exports
export type StorageConfig = z.infer<typeof StorageConfigSchema>;
export type ServerConfig = z.infer<typeof ServerConfigSchema>;
export type Config = z.infer<typeof ConfigSchema>;
export type KnowledgeEntry = z.infer<typeof KnowledgeEntrySchema>;
export type SearchQuery = z.infer<typeof SearchQuerySchema>;
export type ConflictResolution = z.infer<typeof ConflictResolutionSchema>;

// Storage backend interface
export interface StorageBackend {
  initialize(): Promise<void>;
  store(entry: KnowledgeEntry): Promise<void>;
  retrieve(query: SearchQuery): Promise<KnowledgeEntry[]>;
  update(id: string, entry: Partial<KnowledgeEntry>): Promise<void>;
  delete(id: string): Promise<void>;
  getById(id: string): Promise<KnowledgeEntry | null>;
  detectConflicts(entry: KnowledgeEntry): Promise<ConflictResolution[]>;
  close(): Promise<void>;
}

// MCP Tool interfaces
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute(args: Record<string, unknown>): Promise<unknown>;
}

export interface MCPError {
  code: number;
  message: string;
  data?: unknown;
}

// Search result interface
export interface SearchResult {
  entry: KnowledgeEntry;
  score: number;
  highlights?: string[];
}