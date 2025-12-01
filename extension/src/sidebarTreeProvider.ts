import * as vscode from 'vscode';
import { EmbeddedMCPServer } from './embeddedMCPServer';

export interface SidebarItem {
  label: string;
  description?: string;
  tooltip?: string;
  iconPath?: vscode.ThemeIcon;
  command?: vscode.Command;
  contextValue?: string;
  collapsibleState?: vscode.TreeItemCollapsibleState;
}

export class SidebarTreeProvider implements vscode.TreeDataProvider<SidebarItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<SidebarItem | undefined | null | void> = new vscode.EventEmitter<SidebarItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<SidebarItem | undefined | null | void> = this._onDidChangeTreeData.event;
  
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

  getTreeItem(element: SidebarItem): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label, element.collapsibleState);
    item.description = element.description;
    item.tooltip = element.tooltip;
    item.iconPath = element.iconPath;
    item.command = element.command;
    item.contextValue = element.contextValue;
    return item;
  }

  getChildren(element?: SidebarItem): Thenable<SidebarItem[]> {
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

  private getRootItems(): SidebarItem[] {
    const currentProject = this.embeddedServer.getCurrentProject();
    const isRunning = this.embeddedServer.isRunning();

    const items: SidebarItem[] = [];

    // Project section
    items.push({
      label: 'Project',
      description: currentProject || 'No Project Selected',
      tooltip: currentProject ? `Current project: ${currentProject}` : 'Click to select a project',
      iconPath: new vscode.ThemeIcon(currentProject ? 'database' : 'folder'),
      command: {
        command: 'copilot-memory.selectProject',
        title: 'Select Project'
      },
      contextValue: 'project'
    });

    // Server status section
    items.push({
      label: 'Server',
      description: isRunning ? 'Running' : 'Stopped',
      tooltip: isRunning ? 'Server is running' : 'Server is stopped',
      iconPath: new vscode.ThemeIcon(isRunning ? 'play' : 'debug-stop'),
      command: {
        command: isRunning ? 'copilot-memory.stopServer' : 'copilot-memory.startServer',
        title: isRunning ? 'Stop Server' : 'Start Server'
      },
      contextValue: 'server'
    });

    // Only show memory actions if server is running and project is selected
    if (currentProject && isRunning) {
      items.push({
        label: 'View Memory',
        description: 'Browse stored memories',
        iconPath: new vscode.ThemeIcon('eye'),
        command: {
          command: 'copilot-memory.viewMemory',
          title: 'View Memory'
        },
        contextValue: 'viewMemory'
      });

      items.push({
        label: 'Statistics',
        description: 'Project statistics',
        iconPath: new vscode.ThemeIcon('graph'),
        command: {
          command: 'copilot-memory.projectStats',
          title: 'Project Statistics'
        },
        contextValue: 'stats'
      });

      items.push({
        label: 'Export Memory',
        description: 'Export memories to file',
        iconPath: new vscode.ThemeIcon('export'),
        command: {
          command: 'copilot-memory.exportMemory',
          title: 'Export Memory'
        },
        contextValue: 'export'
      });

      items.push({
        label: 'Import Memory',
        description: 'Import memories from file',
        iconPath: new vscode.ThemeIcon('import'),
        command: {
          command: 'copilot-memory.importMemory',
          title: 'Import Memory'
        },
        contextValue: 'import'
      });

      items.push({
        label: 'Clear Memory',
        description: 'Clear all memories',
        iconPath: new vscode.ThemeIcon('trash'),
        command: {
          command: 'copilot-memory.clearMemory',
          title: 'Clear Memory'
        },
        contextValue: 'clear'
      });
    }

    return items;
  }
}