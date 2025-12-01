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

export interface ProjectDatabase {
  name: string;
  path: string;
  lastAccessed: Date;
  entryCount: number;
}