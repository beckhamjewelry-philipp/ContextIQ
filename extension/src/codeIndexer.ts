import * as vscode from 'vscode';
import * as path from 'path';

interface MCPClient {
  callTool(name: string, args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }> }>;
}

interface IndexingStats {
  totalFiles: number;
  indexedFiles: number;
  skippedFiles: number;
  failedFiles: number;
}

/**
 * CodeIndexer manages workspace file indexing with debouncing, batch processing,
 * and FileSystemWatcher integration for real-time updates.
 */
export class CodeIndexer implements vscode.Disposable {
  private mcpClient: MCPClient;
  private fileWatcher: vscode.FileSystemWatcher | undefined;
  private disposables: vscode.Disposable[] = [];
  private pendingChanges: Map<string, 'create' | 'change' | 'delete'> = new Map();
  private debounceTimer: NodeJS.Timeout | undefined;
  private isIndexing = false;
  private statusBarItem: vscode.StatusBarItem;
  private outputChannel: vscode.OutputChannel;
  
  // Configuration
  private readonly DEBOUNCE_MS = 300;
  private readonly BATCH_SIZE = 50;
  private readonly SUPPORTED_EXTENSIONS = [
    // JavaScript/TypeScript
    '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
    // Python
    '.py', '.pyi',
    // Systems languages
    '.rs', '.go', '.c', '.cpp', '.h', '.hpp', '.cc',
    // JVM languages
    '.java', '.kt', '.kts', '.scala',
    // .NET
    '.cs',
    // Scripting
    '.rb', '.php', '.swift', '.lua',
    // Web
    '.vue', '.svelte'
  ];
  
  private readonly DEFAULT_EXCLUDE_PATTERNS = [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.git/**',
    '**/vendor/**',
    '**/__pycache__/**',
    '**/target/**',
    '**/.next/**',
    '**/out/**',
    '**/*.min.js',
    '**/*.bundle.js'
  ];

  constructor(mcpClient: MCPClient) {
    this.mcpClient = mcpClient;
    this.outputChannel = vscode.window.createOutputChannel('Copilot Memory - Code Index');
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
    this.statusBarItem.name = 'Code Index Status';
    this.disposables.push(this.statusBarItem, this.outputChannel);
  }

  /**
   * Initialize file watching for the workspace
   */
  async initialize(): Promise<void> {
    const config = vscode.workspace.getConfiguration('copilotMemory');
    const enabled = config.get<boolean>('codeIndexing.enabled', true);
    
    if (!enabled) {
      this.log('Code indexing is disabled');
      return;
    }
    
    // Create file watcher for supported extensions
    const globPattern = `**/*.{${this.SUPPORTED_EXTENSIONS.map(e => e.slice(1)).join(',')}}`;
    this.fileWatcher = vscode.workspace.createFileSystemWatcher(globPattern);
    
    this.disposables.push(
      this.fileWatcher.onDidCreate(uri => this.onFileChange(uri, 'create')),
      this.fileWatcher.onDidChange(uri => this.onFileChange(uri, 'change')),
      this.fileWatcher.onDidDelete(uri => this.onFileChange(uri, 'delete')),
      this.fileWatcher
    );
    
    this.log('File watcher initialized');
    
    // Register commands
    this.disposables.push(
      vscode.commands.registerCommand('copilotMemory.indexWorkspace', () => this.indexWorkspace()),
      vscode.commands.registerCommand('copilotMemory.indexCurrentFile', () => this.indexCurrentFile()),
      vscode.commands.registerCommand('copilotMemory.showIndexStats', () => this.showIndexStats())
    );
    
    // Auto-index on activation if configured
    const autoIndex = config.get<boolean>('codeIndexing.autoIndexOnStartup', false);
    if (autoIndex) {
      // Delay to let extension fully initialize
      setTimeout(() => this.indexWorkspace(), 2000);
    }
  }

  /**
   * Handle file change events with debouncing
   */
  private onFileChange(uri: vscode.Uri, type: 'create' | 'change' | 'delete'): void {
    // Check if file should be excluded
    if (this.shouldExclude(uri.fsPath)) {
      return;
    }
    
    // Queue the change
    this.pendingChanges.set(uri.fsPath, type);
    
    // Debounce processing
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    this.debounceTimer = setTimeout(() => {
      this.processPendingChanges();
    }, this.DEBOUNCE_MS);
  }

  /**
   * Process queued file changes
   */
  private async processPendingChanges(): Promise<void> {
    if (this.isIndexing || this.pendingChanges.size === 0) {
      return;
    }
    
    this.isIndexing = true;
    const changes = new Map(this.pendingChanges);
    this.pendingChanges.clear();
    
    try {
      const workspaceRoot = this.getWorkspaceRoot();
      if (!workspaceRoot) return;
      
      for (const [filePath, changeType] of changes) {
        const relativePath = path.relative(workspaceRoot, filePath);
        
        if (changeType === 'delete') {
          // For deletions, we could add a remove_file tool, but for now just log
          this.log(`File deleted: ${relativePath}`);
          continue;
        }
        
        try {
          await this.mcpClient.callTool('index_file', {
            filePath,
            relativePath,
            force: false
          });
          this.log(`Indexed: ${relativePath}`);
        } catch (err) {
          this.log(`Failed to index: ${relativePath} - ${err}`);
        }
      }
    } finally {
      this.isIndexing = false;
    }
  }

  /**
   * Index the entire workspace
   */
  async indexWorkspace(): Promise<IndexingStats> {
    const workspaceRoot = this.getWorkspaceRoot();
    if (!workspaceRoot) {
      vscode.window.showWarningMessage('No workspace folder open');
      return { totalFiles: 0, indexedFiles: 0, skippedFiles: 0, failedFiles: 0 };
    }
    
    this.showProgress('Scanning workspace...');
    
    try {
      // Find all matching files
      const files = await this.findWorkspaceFiles();
      
      if (files.length === 0) {
        this.hideProgress();
        vscode.window.showInformationMessage('No files found to index');
        return { totalFiles: 0, indexedFiles: 0, skippedFiles: 0, failedFiles: 0 };
      }
      
      this.showProgress(`Indexing ${files.length} files...`);
      this.log(`Starting workspace indexing: ${files.length} files`);
      
      // Prepare file list for batch indexing
      const fileList = files.map(uri => ({
        filePath: uri.fsPath,
        relativePath: path.relative(workspaceRoot, uri.fsPath)
      }));
      
      // Call the workspace indexing tool
      const result = await this.mcpClient.callTool('index_workspace', {
        files: fileList,
        incremental: true
      });
      
      this.hideProgress();
      
      // Parse results from response
      const resultText = result.content[0]?.text || '';
      this.log(resultText);
      
      // Show summary
      vscode.window.showInformationMessage(`Workspace indexed: ${files.length} files processed`);
      
      return {
        totalFiles: files.length,
        indexedFiles: files.length, // Approximate
        skippedFiles: 0,
        failedFiles: 0
      };
      
    } catch (err) {
      this.hideProgress();
      vscode.window.showErrorMessage(`Indexing failed: ${err}`);
      this.log(`Indexing error: ${err}`);
      return { totalFiles: 0, indexedFiles: 0, skippedFiles: 0, failedFiles: 0 };
    }
  }

  /**
   * Index the currently active file
   */
  async indexCurrentFile(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active file');
      return;
    }
    
    const uri = editor.document.uri;
    const workspaceRoot = this.getWorkspaceRoot();
    
    if (!workspaceRoot) {
      vscode.window.showWarningMessage('No workspace folder open');
      return;
    }
    
    const ext = path.extname(uri.fsPath).toLowerCase();
    if (!this.SUPPORTED_EXTENSIONS.includes(ext)) {
      vscode.window.showWarningMessage(`File type ${ext} is not supported for indexing`);
      return;
    }
    
    try {
      const relativePath = path.relative(workspaceRoot, uri.fsPath);
      
      await this.mcpClient.callTool('index_file', {
        filePath: uri.fsPath,
        relativePath,
        force: true
      });
      
      vscode.window.showInformationMessage(`Indexed: ${relativePath}`);
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to index file: ${err}`);
    }
  }

  /**
   * Show index statistics
   */
  async showIndexStats(): Promise<void> {
    try {
      const result = await this.mcpClient.callTool('get_index_stats', {
        includeLanguageBreakdown: true
      });
      
      const text = result.content[0]?.text || 'No stats available';
      
      // Show in output channel
      this.outputChannel.show();
      this.outputChannel.appendLine('\n' + '='.repeat(50));
      this.outputChannel.appendLine(text);
      
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to get stats: ${err}`);
    }
  }

  /**
   * Find all workspace files matching our patterns
   */
  private async findWorkspaceFiles(): Promise<vscode.Uri[]> {
    const config = vscode.workspace.getConfiguration('copilotMemory');
    const customExcludes = config.get<string[]>('codeIndexing.excludePatterns', []);
    const excludePatterns = [...this.DEFAULT_EXCLUDE_PATTERNS, ...customExcludes];
    
    // Build include pattern
    const extensions = this.SUPPORTED_EXTENSIONS.map(e => e.slice(1)).join(',');
    const includePattern = `**/*.{${extensions}}`;
    
    // Build exclude pattern
    const excludePattern = `{${excludePatterns.join(',')}}`;
    
    return vscode.workspace.findFiles(includePattern, excludePattern);
  }

  /**
   * Check if a file path should be excluded
   */
  private shouldExclude(filePath: string): boolean {
    const config = vscode.workspace.getConfiguration('copilotMemory');
    const customExcludes = config.get<string[]>('codeIndexing.excludePatterns', []);
    const patterns = [...this.DEFAULT_EXCLUDE_PATTERNS, ...customExcludes];
    
    // Simple pattern matching
    return patterns.some(pattern => {
      const regexPattern = pattern
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*');
      return new RegExp(regexPattern).test(filePath);
    });
  }

  /**
   * Get workspace root folder
   */
  private getWorkspaceRoot(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    return folders?.[0]?.uri.fsPath;
  }

  /**
   * Show progress in status bar
   */
  private showProgress(message: string): void {
    this.statusBarItem.text = `$(sync~spin) ${message}`;
    this.statusBarItem.show();
  }

  /**
   * Hide progress indicator
   */
  private hideProgress(): void {
    this.statusBarItem.hide();
  }

  /**
   * Log message to output channel
   */
  private log(message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(`[${timestamp}] ${message}`);
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.disposables.forEach(d => d.dispose());
  }
}
