import { StorageBackend, KnowledgeEntry, SearchQuery, ConflictResolution } from '../types/index.js';
import { LocalStorageBackend } from './LocalStorageBackend.js';
import { ServerStorageBackend, ServerStorageConfig } from './ServerStorageBackend.js';

export class HybridStorageBackend implements StorageBackend {
  private localBackend: LocalStorageBackend;
  private serverBackend: ServerStorageBackend;
  private preferLocal: boolean;

  constructor(
    localDataDir: string,
    serverConfig: ServerStorageConfig,
    preferLocal = true,
    projectPath?: string
  ) {
    this.localBackend = new LocalStorageBackend(localDataDir, projectPath);
    this.serverBackend = new ServerStorageBackend(serverConfig);
    this.preferLocal = preferLocal;
  }

  async initialize(): Promise<void> {
    await this.localBackend.initialize();
    try {
      await this.serverBackend.initialize();
    } catch (error) {
      console.warn('Server storage unavailable, falling back to local only:', error);
    }
  }

  async store(entry: KnowledgeEntry): Promise<void> {
    // Always store locally first
    await this.localBackend.store(entry);
    
    // Try to sync to server
    try {
      await this.serverBackend.store(entry);
    } catch (error) {
      console.warn('Failed to sync to server:', error);
    }
  }

  async retrieve(query: SearchQuery): Promise<KnowledgeEntry[]> {
    if (this.preferLocal) {
      try {
        const localResults = await this.localBackend.retrieve(query);
        if (localResults.length > 0) {
          return localResults;
        }
      } catch (error) {
        console.warn('Local retrieval failed:', error);
      }
    }

    // Try server if local failed or prefer server
    try {
      const serverResults = await this.serverBackend.retrieve(query);
      
      // Merge with local if we got server results
      if (!this.preferLocal) {
        const localResults = await this.localBackend.retrieve(query);
        const merged = this.mergeResults(serverResults, localResults, query.limit);
        return merged;
      }
      
      return serverResults;
    } catch (error) {
      console.warn('Server retrieval failed:', error);
      return await this.localBackend.retrieve(query);
    }
  }

  async update(id: string, updates: Partial<KnowledgeEntry>): Promise<void> {
    await this.localBackend.update(id, updates);
    
    try {
      await this.serverBackend.update(id, updates);
    } catch (error) {
      console.warn('Failed to update on server:', error);
    }
  }

  async delete(id: string): Promise<void> {
    await this.localBackend.delete(id);
    
    try {
      await this.serverBackend.delete(id);
    } catch (error) {
      console.warn('Failed to delete from server:', error);
    }
  }

  async getById(id: string): Promise<KnowledgeEntry | null> {
    // Try local first
    const localEntry = await this.localBackend.getById(id);
    if (localEntry) {
      return localEntry;
    }

    // Try server
    try {
      const serverEntry = await this.serverBackend.getById(id);
      if (serverEntry) {
        // Cache locally
        await this.localBackend.store(serverEntry);
        return serverEntry;
      }
    } catch (error) {
      console.warn('Server get failed:', error);
    }

    return null;
  }

  async detectConflicts(entry: KnowledgeEntry): Promise<ConflictResolution[]> {
    const localConflicts = await this.localBackend.detectConflicts(entry);
    
    try {
      const serverConflicts = await this.serverBackend.detectConflicts(entry);
      return [...localConflicts, ...serverConflicts];
    } catch (error) {
      console.warn('Server conflict detection failed:', error);
      return localConflicts;
    }
  }

  async close(): Promise<void> {
    await this.localBackend.close();
    await this.serverBackend.close();
  }

  private mergeResults(
    results1: KnowledgeEntry[], 
    results2: KnowledgeEntry[], 
    limit: number
  ): KnowledgeEntry[] {
    const seen = new Set<string>();
    const merged: KnowledgeEntry[] = [];

    for (const entry of [...results1, ...results2]) {
      if (!seen.has(entry.id) && merged.length < limit) {
        seen.add(entry.id);
        merged.push(entry);
      }
    }

    return merged;
  }
}