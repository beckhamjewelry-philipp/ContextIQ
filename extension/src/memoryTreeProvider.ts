import * as vscode from 'vscode';
import { EmbeddedMCPServer } from './embeddedMCPServer';

export class MemoryTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command,
    public readonly iconPath?: vscode.ThemeIcon,
    public readonly tooltip?: string,
    public readonly description?: string
  ) {
    super(label, collapsibleState);
    this.command = command;
    this.iconPath = iconPath;
    this.tooltip = tooltip;
    this.description = description;
  }
}

export class MemoryTreeProvider implements vscode.TreeDataProvider<MemoryTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<MemoryTreeItem | undefined | null | void> = new vscode.EventEmitter<MemoryTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<MemoryTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
  
  private refreshTimeout: NodeJS.Timeout | undefined;
  private readonly DEBOUNCE_DELAY = 300; // 300ms debounce

  constructor(private embeddedServer: EmbeddedMCPServer) {}

  refresh(): void {
    // Debounce refresh calls to prevent excessive updates
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }
    
    this.refreshTimeout = setTimeout(() => {
      this._onDidChangeTreeData.fire();
      this.refreshTimeout = undefined;
    }, this.DEBOUNCE_DELAY);
  }
  
  // Immediate refresh for critical updates
  refreshImmediate(): void {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = undefined;
    }
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: MemoryTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: MemoryTreeItem): Thenable<MemoryTreeItem[]> {
    if (!element) {
      return Promise.resolve(this.getRootItems());
    }
    return Promise.resolve([]);
  }
  
  dispose(): void {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }
  }

  private getRootItems(): MemoryTreeItem[] {
    const items: MemoryTreeItem[] = [];
    
    const currentProject = this.embeddedServer.getCurrentProject();
    const isRunning = this.embeddedServer.isRunning();

    // Quick Setup Section (Always visible)
    items.push(new MemoryTreeItem(
      '⚡ Quick Setup',
      vscode.TreeItemCollapsibleState.Expanded,
      undefined,
      new vscode.ThemeIcon('zap', new vscode.ThemeColor('charts.yellow')),
      'One-click installation and configuration'
    ));

    items.push(new MemoryTreeItem(
      '  📋 Copy MCP Configuration',
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'copilot-memory.copyMCPJson',
        title: 'Copy MCP Configuration'
      },
      new vscode.ThemeIcon('copy'),
      'Copy MCP JSON to clipboard for Copilot setup'
    ));

    items.push(new MemoryTreeItem(
      '  🚀 Install & Configure',
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'copilot-memory.installExtension',
        title: 'Install & Configure'
      },
      new vscode.ThemeIcon('extensions'),
      'One-click install: Copy config + create instructions'
    ));

    items.push(new MemoryTreeItem(
      '  📝 Update Copilot Instructions',
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'copilot-memory.updateCopilotInstructions',
        title: 'Update Copilot Instructions'
      },
      new vscode.ThemeIcon('file-code'),
      'Create or update .github/copilot-instructions.md with rules support'
    ));

    // Divider
    items.push(new MemoryTreeItem(
      '―――――――――――――――',
      vscode.TreeItemCollapsibleState.None,
      undefined,
      undefined,
      ''
    ));

    // Project Status
    items.push(new MemoryTreeItem(
      'Project',
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'copilot-memory.selectProject',
        title: 'Select Project'
      },
      new vscode.ThemeIcon(currentProject ? 'database' : 'folder'),
      currentProject ? `Current project: ${currentProject}` : 'Click to select a project',
      currentProject || 'No Project'
    ));

    // Server Status
    items.push(new MemoryTreeItem(
      'Server',
      vscode.TreeItemCollapsibleState.None,
      {
        command: isRunning ? 'copilot-memory.stopServer' : 'copilot-memory.startServer',
        title: isRunning ? 'Stop Server' : 'Start Server'
      },
      new vscode.ThemeIcon(isRunning ? 'play' : 'debug-stop'),
      isRunning ? 'Click to stop server' : 'Click to start server',
      isRunning ? 'Running' : 'Stopped'
    ));

    // Memory Actions (only if project selected and server running)
    if (currentProject && isRunning) {
      items.push(new MemoryTreeItem(
        'View Memories',
        vscode.TreeItemCollapsibleState.None,
        {
          command: 'copilot-memory.viewMemory',
          title: 'View Memory'
        },
        new vscode.ThemeIcon('eye'),
        'Browse stored memories'
      ));

      items.push(new MemoryTreeItem(
        'Export Memory',
        vscode.TreeItemCollapsibleState.None,
        {
          command: 'copilot-memory.exportMemory',
          title: 'Export Memory'
        },
        new vscode.ThemeIcon('export'),
        'Export memories to file'
      ));

      items.push(new MemoryTreeItem(
        'Import Memory',
        vscode.TreeItemCollapsibleState.None,
        {
          command: 'copilot-memory.importMemory',
          title: 'Import Memory'
        },
        new vscode.ThemeIcon('import'),
        'Import memories from file'
      ));

      items.push(new MemoryTreeItem(
        'Clear Memory',
        vscode.TreeItemCollapsibleState.None,
        {
          command: 'copilot-memory.clearMemory',
          title: 'Clear Memory'
        },
        new vscode.ThemeIcon('trash'),
        'Clear all memories for this project'
      ));

      items.push(new MemoryTreeItem(
        'Import ByteRover Knowledge',
        vscode.TreeItemCollapsibleState.None,
        {
          command: 'copilot-memory.importByteRover',
          title: 'Import ByteRover Knowledge'
        },
        new vscode.ThemeIcon('download'),
        'Import knowledge from ByteRover system'
      ));
    } else if (!currentProject) {
      items.push(new MemoryTreeItem(
        'Select a project to get started',
        vscode.TreeItemCollapsibleState.None,
        {
          command: 'copilot-memory.selectProject',
          title: 'Select Project'
        },
        new vscode.ThemeIcon('info'),
        'Click to select or create a project'
      ));
    } else if (!isRunning) {
      items.push(new MemoryTreeItem(
        'Start server to begin',
        vscode.TreeItemCollapsibleState.None,
        {
          command: 'copilot-memory.startServer',
          title: 'Start Server'
        },
        new vscode.ThemeIcon('info'),
        'Click to start the MCP server'
      ));
    }

    return items;
  }
}