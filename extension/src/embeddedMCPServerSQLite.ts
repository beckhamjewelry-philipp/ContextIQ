import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { spawn, ChildProcess } from 'child_process';
import { KnowledgeEntry, SearchQuery, ProjectDatabase } from './types';

// Database connection pool to prevent multiple openings
class DatabaseConnectionPool {
  private static instance: DatabaseConnectionPool;
  private connections: Map<string, any> = new Map();
  private pendingConnections: Map<string, Promise<any>> = new Map();
  
  private constructor() {}
  
  static getInstance(): DatabaseConnectionPool {
    if (!DatabaseConnectionPool.instance) {
      DatabaseConnectionPool.instance = new DatabaseConnectionPool();
    }
    return DatabaseConnectionPool.instance;
  }
  
  async getConnection(dbPath: string): Promise<any> {
    // Return existing connection if available
    if (this.connections.has(dbPath)) {
      return this.connections.get(dbPath);
    }
    
    // Wait for pending connection if one is being established
    if (this.pendingConnections.has(dbPath)) {
      return this.pendingConnections.get(dbPath);
    }
    
    // Create new connection with lazy loading
    const connectionPromise = this.createConnection(dbPath);
    this.pendingConnections.set(dbPath, connectionPromise);
    
    try {
      const connection = await connectionPromise;
      this.connections.set(dbPath, connection);
      this.pendingConnections.delete(dbPath);
      return connection;
    } catch (error) {
      this.pendingConnections.delete(dbPath);
      throw error;
    }
  }
  
  private async createConnection(dbPath: string): Promise<any> {
    // This is a placeholder - in reality, you'd use better-sqlite3
    // For now, we'll return a mock connection object
    return {
      dbPath,
      isConnected: true,
      createdAt: Date.now()
    };
  }
  
  closeConnection(dbPath: string): void {
    const connection = this.connections.get(dbPath);
    if (connection) {
      // Close the actual SQLite connection here
      this.connections.delete(dbPath);
    }
  }
  
  closeAll(): void {
    for (const [dbPath] of this.connections) {
      this.closeConnection(dbPath);
    }
  }
}

export class EmbeddedMCPServer {
  private currentProject: string | null = null;
  private serverRunning = false;
  private statusBarItem: vscode.StatusBarItem;
  private mcpProcess: ChildProcess | null = null;
  private dbPool: DatabaseConnectionPool;
  private dbStatsCache: Map<string, { stats: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5000; // 5 seconds cache
  
  // Callback functions for UI updates
  public onProjectChanged?: () => void;
  public onServerStatusChanged?: () => void;

  constructor(private context: vscode.ExtensionContext) {
    this.dbPool = DatabaseConnectionPool.getInstance();
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBarItem.command = 'copilot-memory.selectProject';
    this.updateStatusBar();
    this.statusBarItem.show();
  }

  private updateStatusBar() {
    if (this.serverRunning && this.currentProject) {
      this.statusBarItem.text = `$(database) ${this.currentProject} (SQLite)`;
      this.statusBarItem.tooltip = `Copilot Memory SQLite: ${this.currentProject} (Click to change)`;
    } else {
      this.statusBarItem.text = `$(database) No Project`;
      this.statusBarItem.tooltip = 'Copilot Memory: Select Project';
    }
  }

  isRunning(): boolean {
    return this.serverRunning;
  }

  getCurrentProject(): string | null {
    return this.currentProject;
  }

  async selectProject(): Promise<void> {
    const workspaceName = this.getWorkspaceName();
    const existingProjects = await this.getExistingProjects();
    
    const items: vscode.QuickPickItem[] = [
      ...(workspaceName ? [{
        label: `$(folder) ${workspaceName}`,
        description: 'Current workspace',
        detail: 'Use current workspace folder name'
      }] : []),
      ...existingProjects.map(proj => ({
        label: `$(database) ${proj.name}`,
        description: `${proj.entryCount} entries`,
        detail: `Last accessed: ${proj.lastAccessed.toLocaleDateString()}`
      })),
      {
        label: '$(add) Create New Project',
        description: 'Enter custom project name'
      }
    ];

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select or create a project for memory storage'
    });

    if (!selected) return;

    let projectName: string;

    if (selected.label.startsWith('$(add)')) {
      const input = await vscode.window.showInputBox({
        prompt: 'Enter project name',
        placeHolder: 'my-project'
      });
      if (!input) return;
      projectName = input;
    } else {
      projectName = selected.label.replace(/^\$\([^)]+\)\s*/, '');
    }

    await this.switchToProject(projectName);
  }

  async switchToProject(projectName: string): Promise<void> {
    this.currentProject = projectName;
    this.clearCache(); // Clear cache on project switch
    this.updateStatusBar();
    
    if (this.onProjectChanged) {
      this.onProjectChanged();
    }
    
    vscode.window.showInformationMessage(`Switched to project: ${projectName}`);
  }

  private async getExistingProjects(): Promise<ProjectDatabase[]> {
    try {
      const dataDir = this.getDataDirectory();
      const files = await fs.readdir(dataDir);
      const projects: ProjectDatabase[] = [];
      
      for (const file of files) {
        if (file.endsWith('.db')) {
          const filePath = path.join(dataDir, file);
          const stats = await fs.stat(filePath);
          const projectName = path.basename(file, '.db');
          
          // For SQLite files, we can't easily count entries without opening the DB
          // So we'll use file size as a rough indicator
          const entryCount = Math.floor(stats.size / 1000); // Rough estimate
          
          projects.push({
            name: projectName,
            path: filePath,
            lastAccessed: stats.mtime,
            entryCount
          });
        }
      }
      
      return projects.sort((a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime());
    } catch (error) {
      return [];
    }
  }

  private getWorkspaceName(): string | null {
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]) {
      return path.basename(vscode.workspace.workspaceFolders[0].uri.fsPath);
    }
    return null;
  }

  private getDataDirectory(): string {
    const config = vscode.workspace.getConfiguration('copilotMemory.storage.local');
    const dataDir = config.get<string>('dataDir') || '~/.copilot-memory';
    return dataDir.replace('~', os.homedir());
  }

  private getServerPath(): string {
    return path.join(this.context.extensionPath, '..', '..', 'server', 'index-sqlite.js');
  }

  async startServer(): Promise<void> {
    if (this.serverRunning) return;
    
    try {
      this.serverRunning = true;
      this.updateStatusBar();
      
      // Auto-select project if none selected
      if (!this.currentProject) {
        const workspaceName = this.getWorkspaceName();
        if (workspaceName) {
          await this.switchToProject(workspaceName);
        } else {
          await this.selectProject();
        }
      }
      
      // Notify UI of server status change
      if (this.onServerStatusChanged) {
        this.onServerStatusChanged();
      }
      
      vscode.window.showInformationMessage('Copilot Memory SQLite server started');
    } catch (error) {
      this.serverRunning = false;
      this.updateStatusBar();
      
      // Notify UI of server status change
      if (this.onServerStatusChanged) {
        this.onServerStatusChanged();
      }
      throw error;
    }
  }

  async stopServer(): Promise<void> {
    if (!this.serverRunning) return;
    
    try {
      if (this.mcpProcess) {
        this.mcpProcess.kill('SIGTERM');
        this.mcpProcess = null;
      }
      
      this.serverRunning = false;
      this.updateStatusBar();
      
      // Notify UI of server status change
      if (this.onServerStatusChanged) {
        this.onServerStatusChanged();
      }
      
      vscode.window.showInformationMessage('Copilot Memory SQLite server stopped');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to stop server: ${error}`);
    }
  }

  async storeKnowledge(entry: Omit<KnowledgeEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    if (!this.serverRunning || !this.currentProject) {
      throw new Error('Server not running or no project selected');
    }
    
    // For SQLite implementation, we'll call the MCP server directly
    return this.callMCPTool('store_knowledge', {
      content: entry.content,
      tags: entry.tags,
      context: entry.context || 'vscode-extension'
    });
  }

  async retrieveKnowledge(query: SearchQuery): Promise<KnowledgeEntry[]> {
    if (!this.serverRunning || !this.currentProject) {
      return [];
    }
    
    const result = await this.callMCPTool('retrieve_knowledge', {
      query: query.query || '',
      tags: query.tags,
      limit: query.limit || 10
    });
    
    // Parse the result to extract knowledge entries
    // This is a simplified version - in reality you'd parse the MCP response
    return [];
  }

  async getProjectStats(): Promise<{ project: string; count: number; size: string }> {
    if (!this.currentProject) {
      return { project: 'None', count: 0, size: '0 KB' };
    }
    
    // Check cache first
    const cacheKey = this.currentProject;
    const cached = this.dbStatsCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      return cached.stats;
    }
    
    try {
      const dataDir = this.getDataDirectory();
      const dbPath = path.join(dataDir, `${this.currentProject}.db`);
      
      try {
        const stats = await fs.stat(dbPath);
        const sizeKB = (stats.size / 1024).toFixed(2);
        
        // Get count from MCP server (optimized with caching)
        const result = await this.callMCPTool('list_knowledge', { limit: 1 });
        
        const projectStats = {
          project: this.currentProject,
          count: 0, // Would be parsed from MCP response
          size: `${sizeKB} KB (SQLite)`
        };
        
        // Cache the result
        this.dbStatsCache.set(cacheKey, {
          stats: projectStats,
          timestamp: Date.now()
        });
        
        return projectStats;
      } catch {
        return { project: this.currentProject, count: 0, size: '0 KB' };
      }
    } catch (error) {
      return { project: this.currentProject, count: 0, size: 'Error' };
    }
  }

  private async callMCPTool(toolName: string, args: any): Promise<string> {
    // This is a simplified implementation
    // In reality, you'd spawn the MCP server process and communicate via JSON-RPC
    return new Promise((resolve, reject) => {
      const serverPath = this.getServerPath();
      const serverProcess = spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: path.dirname(serverPath)
      });

      let response = '';
      
      serverProcess.stdout.on('data', (data) => {
        response += data.toString();
      });

      serverProcess.on('close', () => {
        try {
          // Parse MCP response and extract the result
          resolve('success'); // Simplified
        } catch (error) {
          reject(error);
        }
      });

      // Send MCP request
      const request = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        }
      };

      serverProcess.stdin.write(JSON.stringify(request) + '\n');
      serverProcess.stdin.end();
    });
  }

  // Legacy compatibility methods for existing code
  get databases(): Map<string, any> {
    return new Map(); // SQLite doesn't use in-memory maps
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  private async loadProjectDatabase(projectName: string): Promise<void> {
    // SQLite databases are loaded automatically
    console.log(`SQLite database for ${projectName} will be auto-created`);
  }

  private async saveProjectDatabase(projectName: string): Promise<void> {
    // SQLite databases are auto-saved
    console.log(`SQLite database for ${projectName} auto-saves`);
  }

  dispose(): void {
    if (this.mcpProcess) {
      this.mcpProcess.kill();
      this.mcpProcess = null;
    }
    this.statusBarItem.dispose();
    
    // Clear caches
    this.dbStatsCache.clear();
    
    // Close database connections
    if (this.currentProject) {
      const dataDir = this.getDataDirectory();
      const dbPath = path.join(dataDir, `${this.currentProject}.db`);
      this.dbPool.closeConnection(dbPath);
    }
  }
  
  // Clear cache when project changes
  private clearCache(): void {
    this.dbStatsCache.clear();
  }
}