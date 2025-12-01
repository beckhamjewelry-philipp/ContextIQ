import * as vscode from 'vscode';
import { EmbeddedMCPServer } from './embeddedMCPServer';

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'copilotMemoryExplorer';

  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly embeddedServer: EmbeddedMCPServer
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (data: any) => {
      switch (data.type) {
        case 'selectProject':
          await this.embeddedServer.selectProject();
          this.refresh();
          break;
        case 'startServer':
          await this.embeddedServer.startServer();
          this.refresh();
          break;
        case 'stopServer':
          await this.embeddedServer.stopServer();
          this.refresh();
          break;
        case 'viewMemory':
          await vscode.commands.executeCommand('copilot-memory.viewMemory');
          break;
        case 'projectStats':
          await vscode.commands.executeCommand('copilot-memory.projectStats');
          break;
        case 'exportMemory':
          await vscode.commands.executeCommand('copilot-memory.exportMemory');
          break;
        case 'importMemory':
          await vscode.commands.executeCommand('copilot-memory.importMemory');
          break;
        case 'clearMemory':
          await vscode.commands.executeCommand('copilot-memory.clearMemory');
          break;
        case 'refresh':
          this.refresh();
          break;
      }
    });

    // Initial refresh
    this.refresh();
  }

  public refresh(): void {
    if (this._view) {
      this._view.webview.html = this._getHtmlForWebview(this._view.webview);
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const currentProject = this.embeddedServer.getCurrentProject();
    const isRunning = this.embeddedServer.isRunning();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Copilot Memory</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            font-weight: var(--vscode-font-weight);
            color: var(--vscode-foreground);
            background-color: var(--vscode-sideBar-background);
            padding: 16px;
            margin: 0;
        }
        
        .section {
            margin-bottom: 20px;
            padding: 12px;
            background-color: var(--vscode-sideBarSectionHeader-background);
            border-radius: 6px;
        }
        
        .section-title {
            font-weight: bold;
            font-size: 14px;
            margin-bottom: 8px;
            color: var(--vscode-sideBarSectionHeader-foreground);
        }
        
        .project-info {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
            padding: 8px;
            background-color: var(--vscode-input-background);
            border-radius: 4px;
        }
        
        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: ${isRunning ? '#4caf50' : '#f44336'};
        }
        
        .project-name {
            flex: 1;
            font-weight: 500;
        }
        
        .btn {
            display: inline-block;
            padding: 8px 12px;
            margin: 4px 4px 4px 0;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            text-align: center;
            text-decoration: none;
            width: 100%;
            box-sizing: border-box;
        }
        
        .btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .btn:disabled {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            cursor: not-allowed;
        }
        
        .btn-secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        .btn-secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        .btn-icon {
            margin-right: 6px;
        }
        
        .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
        }
        
        .stats {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 8px;
        }
        
        .help-text {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
            margin-top: 8px;
        }
    </style>
</head>
<body>
    <div class="section">
        <div class="section-title">🧠 Project Memory</div>
        
        <div class="project-info">
            <div class="status-dot"></div>
            <div class="project-name">${currentProject || 'No Project'}</div>
        </div>
        
        <button class="btn" onclick="selectProject()">
            <span class="btn-icon">📁</span>Select Project
        </button>
        
        ${isRunning ? `
            <button class="btn btn-secondary" onclick="stopServer()">
                <span class="btn-icon">⏹️</span>Stop Server
            </button>
        ` : `
            <button class="btn" onclick="startServer()">
                <span class="btn-icon">▶️</span>Start Server
            </button>
        `}
    </div>

    ${currentProject && isRunning ? `
    <div class="section">
        <div class="section-title">📊 Memory Management</div>
        
        <button class="btn btn-secondary" onclick="viewMemory()">
            <span class="btn-icon">👁️</span>View Memories
        </button>
        
        <button class="btn btn-secondary" onclick="projectStats()">
            <span class="btn-icon">📈</span>Statistics
        </button>
        
        <div class="grid">
            <button class="btn btn-secondary" onclick="exportMemory()">
                <span class="btn-icon">📤</span>Export
            </button>
            <button class="btn btn-secondary" onclick="importMemory()">
                <span class="btn-icon">📥</span>Import
            </button>
        </div>
        
        <button class="btn btn-secondary" onclick="clearMemory()" style="margin-top: 8px;">
            <span class="btn-icon">🗑️</span>Clear Memory
        </button>
    </div>
    ` : ''}
    
    <div class="section">
        <div class="section-title">ℹ️ Quick Help</div>
        <div class="help-text">
            ${!currentProject ? 
                "Click 'Select Project' to choose or create a project database." :
                !isRunning ?
                "Click 'Start Server' to begin storing memories." :
                "Server is running! Your memories are automatically saved as you code with GitHub Copilot."
            }
        </div>
        
        <button class="btn btn-secondary" onclick="refresh()" style="margin-top: 12px;">
            <span class="btn-icon">🔄</span>Refresh
        </button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        function selectProject() {
            vscode.postMessage({ type: 'selectProject' });
        }
        
        function startServer() {
            vscode.postMessage({ type: 'startServer' });
        }
        
        function stopServer() {
            vscode.postMessage({ type: 'stopServer' });
        }
        
        function viewMemory() {
            vscode.postMessage({ type: 'viewMemory' });
        }
        
        function projectStats() {
            vscode.postMessage({ type: 'projectStats' });
        }
        
        function exportMemory() {
            vscode.postMessage({ type: 'exportMemory' });
        }
        
        function importMemory() {
            vscode.postMessage({ type: 'importMemory' });
        }
        
        function clearMemory() {
            vscode.postMessage({ type: 'clearMemory' });
        }
        
        function refresh() {
            vscode.postMessage({ type: 'refresh' });
        }
    </script>
</body>
</html>`;
  }
}