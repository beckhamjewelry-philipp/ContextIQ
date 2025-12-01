import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';

export class ConfigurationManager {
  constructor(private context: vscode.ExtensionContext) {}

  async configureStorage(): Promise<void> {
    const storageType = await vscode.window.showQuickPick(
      ['local', 'server', 'both'],
      {
        placeHolder: 'Select storage type',
        ignoreFocusOut: true
      }
    );

    if (!storageType) return;

    const config = vscode.workspace.getConfiguration('copilotMemory');
    await config.update('storage.type', storageType, vscode.ConfigurationTarget.Global);

    if (storageType === 'local' || storageType === 'both') {
      await this.configureLocalStorage();
    }

    if (storageType === 'server' || storageType === 'both') {
      await this.configureServerStorage();
    }

    await this.configureMCPServer();

    vscode.window.showInformationMessage('Storage configuration updated successfully!');
  }

  private async configureLocalStorage(): Promise<void> {
    const defaultPath = path.join(os.homedir(), '.copilot-memory');
    const dataDir = await vscode.window.showInputBox({
      prompt: 'Enter local storage directory',
      value: defaultPath,
      ignoreFocusOut: true
    });

    if (dataDir) {
      const config = vscode.workspace.getConfiguration('copilotMemory');
      await config.update('storage.local.dataDir', dataDir, vscode.ConfigurationTarget.Global);
    }
  }

  private async configureServerStorage(): Promise<void> {
    const serverUrl = await vscode.window.showInputBox({
      prompt: 'Enter server URL',
      placeHolder: 'https://your-server.com/api',
      ignoreFocusOut: true
    });

    if (serverUrl) {
      const config = vscode.workspace.getConfiguration('copilotMemory');
      await config.update('storage.server.url', serverUrl, vscode.ConfigurationTarget.Global);

      const apiKey = await vscode.window.showInputBox({
        prompt: 'Enter API key (optional)',
        password: true,
        ignoreFocusOut: true
      });

      if (apiKey) {
        await config.update('storage.server.apiKey', apiKey, vscode.ConfigurationTarget.Global);
      }
    }
  }

  private async configureMCPServer(): Promise<void> {
    const serverPath = await vscode.window.showInputBox({
      prompt: 'Enter MCP server path (leave empty to use bundled server)',
      placeHolder: '/path/to/copilot-memory-mcp-server',
      ignoreFocusOut: true
    });

    const config = vscode.workspace.getConfiguration('copilotMemory');
    
    if (serverPath) {
      await config.update('mcp.serverPath', serverPath, vscode.ConfigurationTarget.Global);
    } else {
      // Use bundled server
      const bundledServerPath = path.join(this.context.extensionPath, 'server', 'dist', 'index-sqlite.js');
      await config.update('mcp.serverPath', bundledServerPath, vscode.ConfigurationTarget.Global);
    }

    const autoStart = await vscode.window.showQuickPick(['Yes', 'No'], {
      placeHolder: 'Auto-start MCP server?',
      ignoreFocusOut: true
    });

    if (autoStart) {
      await config.update('mcp.autoStart', autoStart === 'Yes', vscode.ConfigurationTarget.Global);
    }
  }

  getStorageConfig(): any {
    const config = vscode.workspace.getConfiguration('copilotMemory.storage');
    return {
      type: config.get('type', 'local'),
      local: {
        dataDir: this.expandPath(config.get('local.dataDir', '~/.copilot-memory'))
      },
      server: {
        url: config.get('server.url'),
        apiKey: config.get('server.apiKey'),
        timeout: config.get('server.timeout', 10000)
      }
    };
  }

  getServerPath(): string | undefined {
    const config = vscode.workspace.getConfiguration('copilotMemory.mcp');
    const serverPath = config.get<string>('serverPath');
    
    if (!serverPath) {
      // Return bundled server path
      return path.join(this.context.extensionPath, 'server', 'dist', 'index-sqlite.js');
    }
    
    return this.expandPath(serverPath);
  }

  private expandPath(filePath: string): string {
    if (filePath.startsWith('~/')) {
      return path.join(os.homedir(), filePath.slice(2));
    }
    return filePath;
  }

  async writeServerConfig(): Promise<void> {
    const storageConfig = this.getStorageConfig();
    const configPath = path.join(this.expandPath('~/.copilot-memory'), 'config.json');
    
    const config = {
      storage: storageConfig,
      logging: {
        level: vscode.workspace.getConfiguration('copilotMemory.logging').get('level', 'info')
      }
    };

    try {
      // Ensure directory exists
      const configDir = path.dirname(configPath);
      await vscode.workspace.fs.createDirectory(vscode.Uri.file(configDir));
      
      // Write config file
      const content = JSON.stringify(config, null, 2);
      await vscode.workspace.fs.writeFile(vscode.Uri.file(configPath), Buffer.from(content));
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to write server config: ${error}`);
    }
  }
}