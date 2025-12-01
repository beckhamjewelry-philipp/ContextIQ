export { LocalStorageBackend } from './LocalStorageBackend.js';
export { ServerStorageBackend } from './ServerStorageBackend.js';
export { HybridStorageBackend } from './HybridStorageBackend.js';

import { StorageBackend, StorageConfig } from '../types/index.js';
import { LocalStorageBackend } from './LocalStorageBackend.js';
import { ServerStorageBackend } from './ServerStorageBackend.js';
import { HybridStorageBackend } from './HybridStorageBackend.js';

export function createStorageBackend(config: StorageConfig, projectPath?: string): StorageBackend {
  switch (config.type) {
    case 'local':
      if (!config.local) {
        throw new Error('Local storage configuration required');
      }
      return new LocalStorageBackend(config.local.dataDir, projectPath);

    case 'server':
      if (!config.server) {
        throw new Error('Server storage configuration required');
      }
      return new ServerStorageBackend({
        url: config.server.url,
        apiKey: config.server.apiKey,
        timeout: config.server.timeout
      });

    case 'both':
      if (!config.local || !config.server) {
        throw new Error('Both local and server storage configurations required');
      }
      return new HybridStorageBackend(
        config.local.dataDir,
        {
          url: config.server.url,
          apiKey: config.server.apiKey,
          timeout: config.server.timeout
        },
        true,
        projectPath
      );

    default:
      throw new Error(`Unknown storage type: ${(config as any).type}`);
  }
}