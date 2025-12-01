import * as vscode from 'vscode';
import { MCPClient } from './mcpClient';

export class MemoryExplorerProvider implements vscode.TreeDataProvider<MemoryItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<MemoryItem | undefined | null | void> = new vscode.EventEmitter<MemoryItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<MemoryItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private memories: any[] = [];

  constructor(private mcpClient: MCPClient) {
    this.loadMemories();
  }

  refresh(): void {
    this.loadMemories();
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: MemoryItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: MemoryItem): Thenable<MemoryItem[]> {
    if (!element) {
      // Root level - show categories
      const categories = [
        new MemoryItem('By Source', 'source', vscode.TreeItemCollapsibleState.Collapsed),
        new MemoryItem('By Context', 'context', vscode.TreeItemCollapsibleState.Collapsed),
        new MemoryItem('By Tags', 'tags', vscode.TreeItemCollapsibleState.Collapsed),
        new MemoryItem('Recent', 'recent', vscode.TreeItemCollapsibleState.Collapsed)
      ];
      return Promise.resolve(categories);
    }

    switch (element.category) {
      case 'source':
        return Promise.resolve(this.getSourceItems());
      case 'context':
        return Promise.resolve(this.getContextItems());
      case 'tags':
        return Promise.resolve(this.getTagItems());
      case 'recent':
        return Promise.resolve(this.getRecentItems());
      default:
        return Promise.resolve([]);
    }
  }

  private async loadMemories(): Promise<void> {
    if (!this.mcpClient.isConnected()) {
      return;
    }

    try {
      this.memories = await this.mcpClient.retrieveKnowledge({ 
        query: '', 
        limit: 100 
      });
    } catch (error) {
      console.error('Failed to load memories:', error);
      this.memories = [];
    }
  }

  private getSourceItems(): MemoryItem[] {
    const sources = new Set<string>();
    this.memories.forEach(memory => {
      if (memory.source) {
        sources.add(memory.source);
      }
    });

    return Array.from(sources).map(source => {
      const count = this.memories.filter(m => m.source === source).length;
      const item = new MemoryItem(`${source} (${count})`, 'memory-list', vscode.TreeItemCollapsibleState.None);
      item.tooltip = `Memories from ${source}`;
      item.command = {
        command: 'copilot-memory.showMemoriesBySource',
        title: 'Show Memories',
        arguments: [source]
      };
      return item;
    });
  }

  private getContextItems(): MemoryItem[] {
    const contexts = new Set<string>();
    this.memories.forEach(memory => {
      if (memory.context) {
        contexts.add(memory.context);
      }
    });

    return Array.from(contexts).map(context => {
      const count = this.memories.filter(m => m.context === context).length;
      const item = new MemoryItem(`${context} (${count})`, 'memory-list', vscode.TreeItemCollapsibleState.None);
      item.tooltip = `Memories from ${context}`;
      item.command = {
        command: 'copilot-memory.showMemoriesByContext',
        title: 'Show Memories',
        arguments: [context]
      };
      return item;
    });
  }

  private getTagItems(): MemoryItem[] {
    const tags = new Set<string>();
    this.memories.forEach(memory => {
      if (memory.tags) {
        memory.tags.forEach((tag: string) => tags.add(tag));
      }
    });

    return Array.from(tags).map(tag => {
      const count = this.memories.filter(m => m.tags && m.tags.includes(tag)).length;
      const item = new MemoryItem(`${tag} (${count})`, 'memory-list', vscode.TreeItemCollapsibleState.None);
      item.tooltip = `Memories tagged with ${tag}`;
      item.command = {
        command: 'copilot-memory.showMemoriesByTag',
        title: 'Show Memories',
        arguments: [tag]
      };
      return item;
    });
  }

  private getRecentItems(): MemoryItem[] {
    const recent = this.memories
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

    return recent.map(memory => {
      const preview = memory.content.slice(0, 50) + (memory.content.length > 50 ? '...' : '');
      const item = new MemoryItem(preview, 'memory', vscode.TreeItemCollapsibleState.None);
      item.tooltip = memory.content;
      item.description = new Date(memory.createdAt).toLocaleDateString();
      item.command = {
        command: 'copilot-memory.showMemory',
        title: 'Show Memory',
        arguments: [memory.id]
      };
      return item;
    });
  }
}

class MemoryItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly category: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label}`;
    this.contextValue = category;

    // Set icons based on category
    switch (category) {
      case 'source':
        this.iconPath = new vscode.ThemeIcon('account');
        break;
      case 'context':
        this.iconPath = new vscode.ThemeIcon('folder');
        break;
      case 'tags':
        this.iconPath = new vscode.ThemeIcon('tag');
        break;
      case 'recent':
        this.iconPath = new vscode.ThemeIcon('clock');
        break;
      case 'memory':
        this.iconPath = new vscode.ThemeIcon('note');
        break;
      case 'memory-list':
        this.iconPath = new vscode.ThemeIcon('list-unordered');
        break;
    }
  }
}