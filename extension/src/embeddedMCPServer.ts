import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { KnowledgeEntry, SearchQuery, ProjectDatabase } from './types';
import { ActiveFileTracker } from './activeFileTracker';

function buildNodePath(extraPaths: string[]): string | undefined {
  const existing = process.env.NODE_PATH ? process.env.NODE_PATH.split(path.delimiter) : [];
  const merged = Array.from(new Set([...extraPaths, ...existing].filter(Boolean)));
  return merged.length ? merged.join(path.delimiter) : undefined;
}

export class EmbeddedMCPServer {
  private currentProject: string | null = null;
  private databases: Map<string, any> = new Map(); // In-memory storage for now
  private serverRunning = false;
  private statusBarItem: vscode.StatusBarItem;
  private activeFileTracker: ActiveFileTracker | null = null;
  
  // Callback functions for UI updates
  public onProjectChanged?: () => void;
  public onServerStatusChanged?: () => void;

  constructor(private context: vscode.ExtensionContext) {
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBarItem.command = 'copilot-memory.selectProject';
    this.updateStatusBar();
    this.statusBarItem.show();
  }

  /**
   * Set the active file tracker for context enrichment
   */
  setActiveFileTracker(tracker: ActiveFileTracker): void {
    this.activeFileTracker = tracker;
  }

  /**
   * Get the currently active file path (relative to workspace)
   */
  getActiveFile(): string | null {
    return this.activeFileTracker?.getActiveFilePath() ?? null;
  }

  private updateStatusBar() {
    if (this.serverRunning && this.currentProject) {
      this.statusBarItem.text = `$(database) ${this.currentProject}`;
      this.statusBarItem.tooltip = `Copilot Memory: ${this.currentProject} (Click to change)`;
    } else {
      this.statusBarItem.text = `$(database) No Project`;
      this.statusBarItem.tooltip = 'Copilot Memory: Select Project';
    }
  }

  async selectProject(): Promise<void> {
    const existingProjects = await this.getExistingProjects();
    const workspaceName = this.getWorkspaceName();
    
    const quickPickItems: vscode.QuickPickItem[] = [];
    
    // Add current workspace as first option if detected
    if (workspaceName) {
      quickPickItems.push({
        label: `$(folder) ${workspaceName}`,
        description: 'Current workspace',
        detail: 'Auto-detected from current workspace'
      });
    }
    
    // Add existing projects
    existingProjects.forEach(project => {
      quickPickItems.push({
        label: `$(database) ${project.name}`,
        description: `${project.entryCount} memories`,
        detail: `Last accessed: ${project.lastAccessed.toLocaleDateString()}`
      });
    });
    
    // Add option to create new project
    quickPickItems.push({
      label: '$(plus) New Project',
      description: 'Create a new project database',
      detail: 'Enter a custom project name'
    });

    const selection = await vscode.window.showQuickPick(quickPickItems, {
      placeHolder: 'Select a project for Copilot memory storage',
      title: 'Copilot Memory - Project Selection'
    });

    if (!selection) return;

    let projectName: string;

    if (selection.label.includes('$(plus)')) {
      // Create new project
      const newName = await vscode.window.showInputBox({
        prompt: 'Enter project name',
        placeHolder: 'my-project',
        validateInput: (value: string) => {
          if (!value || value.trim().length === 0) {
            return 'Project name cannot be empty';
          }
          if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
            return 'Project name can only contain letters, numbers, hyphens, and underscores';
          }
          return null;
        }
      });
      
      if (!newName) return;
      projectName = newName.trim();
    } else {
      // Extract project name from selection
      projectName = selection.label.replace(/^\$\([^)]+\)\s*/, '');
    }

    await this.switchToProject(projectName);
  }

  private async switchToProject(projectName: string): Promise<void> {
    try {
      this.currentProject = projectName;
      
      // Initialize or load project database
      if (!this.databases.has(projectName)) {
        this.databases.set(projectName, new Map<string, KnowledgeEntry>());
        await this.loadProjectDatabase(projectName);
      }
      
      // Notify UI of project change
      if (this.onProjectChanged) {
        this.onProjectChanged();
      }
      
      if (!this.serverRunning) {
        await this.startServer();
      }
      
      this.updateStatusBar();
      
      vscode.window.showInformationMessage(
        `Switched to project: ${projectName}`,
        'View Memories'
      ).then((action: string | undefined) => {
        if (action === 'View Memories') {
          vscode.commands.executeCommand('copilot-memory.viewMemory');
        }
      });
      
      // Save current project preference
      await this.context.workspaceState.update('currentProject', projectName);
      
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to switch to project: ${error}`);
    }
  }

  private async loadProjectDatabase(projectName: string): Promise<void> {
    try {
      const dataDir = this.getDataDirectory();
      const dbFile = path.join(dataDir, `${projectName}.json`);
      
      try {
        const content = await fs.readFile(dbFile, 'utf-8');
        const data = JSON.parse(content);
        const projectDb = new Map<string, KnowledgeEntry>();
        
        for (const [id, entry] of Object.entries(data)) {
          projectDb.set(id, entry as KnowledgeEntry);
        }
        
        this.databases.set(projectName, projectDb);
      } catch (error) {
        // File doesn't exist, create new empty database
        this.databases.set(projectName, new Map<string, KnowledgeEntry>());
      }
    } catch (error) {
      console.error('Failed to load project database:', error);
      throw error;
    }
  }

  private async saveProjectDatabase(projectName: string): Promise<void> {
    try {
      const dataDir = this.getDataDirectory();
      await fs.mkdir(dataDir, { recursive: true });
      
      const dbFile = path.join(dataDir, `${projectName}.json`);
      const projectDb = this.databases.get(projectName);
      
      if (projectDb) {
        const data = Object.fromEntries(projectDb.entries());
        await fs.writeFile(dbFile, JSON.stringify(data, null, 2));
      }
    } catch (error) {
      console.error('Failed to save project database:', error);
    }
  }

  private async getExistingProjects(): Promise<ProjectDatabase[]> {
    try {
      const dataDir = this.getDataDirectory();
      const files = await fs.readdir(dataDir);
      const projects: ProjectDatabase[] = [];
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const projectName = file.replace('.json', '');
          const filePath = path.join(dataDir, file);
          const stats = await fs.stat(filePath);
          
          // Count entries by loading the file
          let entryCount = 0;
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            const data = JSON.parse(content);
            entryCount = Object.keys(data).length;
          } catch (error) {
            console.error(`Failed to read project file ${file}:`, error);
          }
          
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

  async startServer(): Promise<void> {
    if (this.serverRunning) return;
    
    try {
      this.serverRunning = true;
      this.updateStatusBar();
      
      // Notify UI of server status change
      if (this.onServerStatusChanged) {
        this.onServerStatusChanged();
      }
      
      // Auto-select project if none selected
      if (!this.currentProject) {
        const workspaceName = this.getWorkspaceName();
        if (workspaceName) {
          await this.switchToProject(workspaceName);
        } else {
          await this.selectProject();
        }
      }
      
      vscode.window.showInformationMessage('Copilot Memory server started');
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
      // Save all project databases
      for (const [projectName] of this.databases) {
        await this.saveProjectDatabase(projectName);
      }
      
      this.serverRunning = false;
      this.updateStatusBar();
      
      // Notify UI of server status change
      if (this.onServerStatusChanged) {
        this.onServerStatusChanged();
      }
      
      vscode.window.showInformationMessage('Copilot Memory server stopped');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to stop server: ${error}`);
    }
  }

  async storeKnowledge(entry: Omit<KnowledgeEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    if (!this.serverRunning || !this.currentProject) {
      throw new Error('Server not running or no project selected');
    }
    
    const projectDb = this.databases.get(this.currentProject);
    if (!projectDb) {
      throw new Error('Project database not initialized');
    }
    
    const knowledgeEntry: KnowledgeEntry = {
      id: this.generateId(),
      ...entry,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    projectDb.set(knowledgeEntry.id, knowledgeEntry);
    
    // Save to disk periodically (could be optimized)
    await this.saveProjectDatabase(this.currentProject);
    
    return knowledgeEntry.id;
  }

  async retrieveKnowledge(query: SearchQuery): Promise<KnowledgeEntry[]> {
    if (!this.serverRunning || !this.currentProject) {
      return [];
    }
    
    const projectDb = this.databases.get(this.currentProject);
    if (!projectDb) {
      return [];
    }
    
    let results = Array.from(projectDb.values());
    
    // Simple filtering
    if (query.query && query.query.trim()) {
      const searchTerm = query.query.toLowerCase();
      results = results.filter((entry: any) => 
        entry.content.toLowerCase().includes(searchTerm)
      );
    }
    
    if (query.tags && query.tags.length > 0) {
      results = results.filter((entry: any) =>
        query.tags!.some(tag => entry.tags.includes(tag))
      );
    }
    
    if (query.source) {
      results = results.filter((entry: any) => entry.source === query.source);
    }
    
    if (query.context) {
      results = results.filter((entry: any) => entry.context === query.context);
    }
    
    // Sort by creation date (newest first)
    results.sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime());
    
    return results.slice(0, query.limit || 50) as KnowledgeEntry[];
  }

  async getProjectStats(): Promise<{ project: string; count: number; size: string }> {
    if (!this.currentProject) {
      return { project: 'None', count: 0, size: '0 KB' };
    }
    
    const projectDb = this.databases.get(this.currentProject);
    const count = projectDb ? projectDb.size : 0;
    
    try {
      const dataDir = this.getDataDirectory();
      const dbFile = path.join(dataDir, `${this.currentProject}.json`);
      const stats = await fs.stat(dbFile);
      const size = `${(stats.size / 1024).toFixed(1)} KB`;
      
      return { project: this.currentProject, count, size };
    } catch (error) {
      return { project: this.currentProject, count, size: '0 KB' };
    }
  }

  getCurrentProject(): string | null {
    return this.currentProject;
  }

  isRunning(): boolean {
    return this.serverRunning;
  }

  private expandPath(filePath: string): string {
    if (filePath.startsWith('~/')) {
      return path.join(os.homedir(), filePath.slice(2));
    }
    return filePath;
  }

  private async resolveServerPath(): Promise<string> {
    const candidates: string[] = [];

    const config = vscode.workspace.getConfiguration('copilotMemory.mcp');
    const configuredPath = config.get<string>('serverPath');
    if (configuredPath) {
      candidates.push(this.expandPath(configuredPath));
    }

    const workspaceFolders = vscode.workspace.workspaceFolders || [];
    for (const folder of workspaceFolders) {
      const root = folder.uri.fsPath;
      candidates.push(path.join(root, 'server', 'index-sqlite.js'));
      candidates.push(path.join(root, 'server', 'dist', 'index-sqlite.js'));
    }

    candidates.push(
      path.join(this.context.extensionPath, 'server', 'index-sqlite.js'),
      path.join(this.context.extensionPath, 'server', 'dist', 'index-sqlite.js'),
      path.join(this.context.extensionPath, '..', '..', 'server', 'index-sqlite.js'),
      path.join(this.context.extensionPath, '..', '..', 'server', 'dist', 'index-sqlite.js')
    );

    for (const candidate of candidates) {
      try {
        await fs.stat(candidate);
        return candidate;
      } catch {
        // Try next candidate
      }
    }

    throw new Error(`MCP server not found. Tried: ${candidates.join(', ')}`);
  }

  /**
   * Call an MCP tool by name. This spawns a new server process for each call.
   * For high-performance scenarios, consider using DirectMCPServer instead.
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }> }> {
    const { spawn } = require('child_process');
    const serverPath = await this.resolveServerPath();
    
    // Auto-inject active file context for store_knowledge calls
    const enrichedArgs = { ...args };
    if (name === 'store_knowledge' && !args.active_file) {
      const activeFile = this.getActiveFile();
      if (activeFile) {
        enrichedArgs.active_file = activeFile;
      }
    }
    
    return new Promise((resolve, reject) => {
      const nodePath = buildNodePath([
        path.join(this.context.extensionPath, 'node_modules'),
        path.join(path.dirname(serverPath), 'node_modules')
      ]);
      const serverProcess = spawn('node', [serverPath], {
        cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          NODE_PATH: nodePath ?? process.env.NODE_PATH
        }
      });
      
      let responseBuffer = '';
      let errorBuffer = '';
      
      serverProcess.stdout.on('data', (data: Buffer) => {
        responseBuffer += data.toString();
        
        // Try to parse JSON-RPC responses
        const lines = responseBuffer.split('\n');
        for (const line of lines) {
          if (line.trim()) {
            try {
              const response = JSON.parse(line);
              if (response.result) {
                serverProcess.kill();
                resolve(response.result);
              }
            } catch {
              // Not valid JSON yet, continue buffering
            }
          }
        }
      });
      
      serverProcess.stderr.on('data', (data: Buffer) => {
        errorBuffer += data.toString();
      });
      
      serverProcess.on('error', (err: Error) => {
        reject(new Error(`Failed to start MCP server: ${err.message}`));
      });
      
      serverProcess.on('close', (code: number) => {
        if (code !== 0 && !responseBuffer.includes('result')) {
          reject(new Error(`MCP server exited with code ${code}: ${errorBuffer}`));
        }
      });
      
      // Send initialization
      const initRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'copilot-memory-extension', version: '1.3.0' }
        }
      };
      serverProcess.stdin.write(JSON.stringify(initRequest) + '\n');
      
      // Send tool call after a brief delay
      setTimeout(() => {
        const toolRequest = {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: { name, arguments: enrichedArgs }
        };
        serverProcess.stdin.write(JSON.stringify(toolRequest) + '\n');
      }, 100);
      
      // Timeout after 30 seconds
      setTimeout(() => {
        serverProcess.kill();
        reject(new Error('MCP tool call timed out'));
      }, 30000);
    });
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  dispose(): void {
    if (this.statusBarItem) {
      this.statusBarItem.dispose();
    }
  }
}