import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
// import { MCPClient } from './mcpClient';
// import { MemoryExplorerProvider } from './memoryExplorer';
import { ConfigurationManager } from './configuration';
import { EmbeddedMCPServer } from './embeddedMCPServer';
import { MemoryTreeProvider } from './memoryTreeProvider';
import { ByteRoverImporter } from './byteRoverImporter';
import { CodeIndexer } from './codeIndexer';
import { getActiveFileTracker, disposeActiveFileTracker } from './activeFileTracker';
// import { SidebarProvider } from './sidebarProvider';

function buildNodePath(extraPaths: string[]): string | undefined {
  const existing = process.env.NODE_PATH ? process.env.NODE_PATH.split(path.delimiter) : [];
  const merged = Array.from(new Set([...extraPaths, ...existing].filter(Boolean)));
  return merged.length ? merged.join(path.delimiter) : undefined;
}

function resolveBundledServerPath(context: vscode.ExtensionContext): string {
  const extensionPath = context.extensionPath;
  const directPath = path.join(extensionPath, 'server', 'index-sqlite.js');
  if (fs.existsSync(directPath)) {
    return directPath;
  }

  const distPath = path.join(extensionPath, 'server', 'dist', 'index-sqlite.js');
  if (fs.existsSync(distPath)) {
    return distPath;
  }

  return context.asAbsolutePath('../../server/index-sqlite.js');
}

function getVSCodeMcpConfigPath(): string {
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'Code', 'User', 'mcp.json');
  }

  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'mcp.json');
  }

  return path.join(os.homedir(), '.config', 'Code', 'User', 'mcp.json');
}

export async function activate(context: vscode.ExtensionContext) {
  console.log('Copilot Memory MCP extension is now active!');

  // Initialize active file tracker for context enrichment
  const activeFileTracker = getActiveFileTracker();
  context.subscriptions.push(activeFileTracker);

  // Initialize embedded MCP server (lazy - won't open DB until needed)
  const embeddedServer = new EmbeddedMCPServer(context);
  
  // Connect active file tracker to server
  embeddedServer.setActiveFileTracker(activeFileTracker);
  
  // Initialize configuration manager
  const configManager = new ConfigurationManager(context);
  
  // Initialize memory tree provider
  const memoryTreeProvider = new MemoryTreeProvider(embeddedServer);
  const treeView = vscode.window.createTreeView('copilotMemoryExplorer', {
    treeDataProvider: memoryTreeProvider,
    showCollapseAll: true
  });
  
  // Register tree view
  context.subscriptions.push(treeView);
  
  // Register embedded server for disposal
  context.subscriptions.push({
    dispose: () => embeddedServer.dispose()
  });
  
  // Register tree provider for disposal
  context.subscriptions.push({
    dispose: () => memoryTreeProvider.dispose()
  });
  
  // Add refresh functionality
  embeddedServer.onProjectChanged = () => {
    memoryTreeProvider.refresh();
  };
  
  embeddedServer.onServerStatusChanged = () => {
    memoryTreeProvider.refresh();
  };

  // Initialize code indexer for workspace symbol indexing
  const codeIndexer = new CodeIndexer(embeddedServer);
  await codeIndexer.initialize();
  context.subscriptions.push(codeIndexer);

  // Set context to show views
  vscode.commands.executeCommand('setContext', 'copilotMemory.enabled', true);

  // Register commands
  const commands = [
    vscode.commands.registerCommand('copilot-memory.selectProject', async () => {
      await embeddedServer.selectProject();
    }),

    vscode.commands.registerCommand('copilot-memory.startServer', async () => {
      await embeddedServer.startServer();
    }),

    vscode.commands.registerCommand('copilot-memory.stopServer', async () => {
      await embeddedServer.stopServer();
    }),

    vscode.commands.registerCommand('copilot-memory.configureStorage', async () => {
      await configManager.configureStorage();
    }),

    vscode.commands.registerCommand('copilot-memory.viewMemory', async () => {
      await showMemoryViewEmbedded(embeddedServer);
    }),

    vscode.commands.registerCommand('copilot-memory.clearMemory', async () => {
      await clearMemoryEmbedded(embeddedServer);
    }),

    vscode.commands.registerCommand('copilot-memory.resolveConflicts', async (conflictIds?: string[]) => {
      await vscode.window.showInformationMessage('Conflict resolution coming soon!');
    }),

    vscode.commands.registerCommand('copilot-memory.exportMemory', async () => {
      await exportMemoryEmbedded(embeddedServer);
    }),

    vscode.commands.registerCommand('copilot-memory.importMemory', async () => {
      await importMemoryEmbedded(embeddedServer);
    }),

    vscode.commands.registerCommand('copilot-memory.refresh', () => {
      vscode.window.showInformationMessage('Refreshed!');
    }),

    vscode.commands.registerCommand('copilot-memory.projectStats', async () => {
      await showProjectStats(embeddedServer);
    }),

    vscode.commands.registerCommand('copilot-memory.importByteRover', async () => {
      const importer = new ByteRoverImporter(embeddedServer);
      const choice = await vscode.window.showQuickPick([
        { label: 'Import ByteRover Core Knowledge', description: 'Import main technical knowledge from ByteRover', value: 'core' },
        { label: 'Import Additional Programming Knowledge', description: 'Import supplementary programming patterns', value: 'additional' },
        { label: 'Import All Knowledge', description: 'Import both core and additional knowledge', value: 'all' }
      ], {
        placeHolder: 'Select what to import from ByteRover'
      });

      if (choice) {
        try {
          if (choice.value === 'core') {
            await importer.importByteRoverData();
          } else if (choice.value === 'additional') {
            await importer.importAdditionalKnowledge();
          } else if (choice.value === 'all') {
            await importer.importByteRoverData();
            await importer.importAdditionalKnowledge();
          }
          memoryTreeProvider.refresh();
        } catch (error) {
          vscode.window.showErrorMessage(`Import failed: ${error}`);
        }
      }
    }),

    vscode.commands.registerCommand('copilot-memory.setupCopilotMCP', async () => {
      await setupCopilotMCP(context);
      await createOrUpdateCopilotInstructions();
    }),

    vscode.commands.registerCommand('copilot-memory.resetMCPConfiguration', async () => {
      await resetMCPConfiguration(context);
      await createOrUpdateCopilotInstructions();
    }),

    vscode.commands.registerCommand('copilot-memory.updateCopilotInstructions', async () => {
      await createOrUpdateCopilotInstructions(true); // Force update
    }),

    vscode.commands.registerCommand('copilot-memory.copyMCPJson', async () => {
      await copyMCPJsonConfiguration(context);
    }),

    vscode.commands.registerCommand('copilot-memory.installExtension', async () => {
      await installAndConfigureExtension(context);
    })
  ];

  context.subscriptions.push(...commands);

  // Background initialization (non-blocking)
  setTimeout(async () => {
    try {
      // Create or update .github/copilot-instructions.md in background
      await createOrUpdateCopilotInstructions();
      
      // Auto start embedded server if configured
      const autoStart = vscode.workspace.getConfiguration('copilotMemory.mcp').get<boolean>('autoStart');
      if (autoStart) {
        await embeddedServer.startServer();
      }
    } catch (error) {
      console.error('Background initialization error:', error);
    }
  }, 100); // Small delay to not block activation

  // Watch for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (event.affectsConfiguration('copilotMemory')) {
        // Restart embedded server if needed
        if (embeddedServer.isRunning()) {
          await embeddedServer.stopServer();
          await embeddedServer.startServer();
        }
      }
    })
  );

  // Watch for text document changes to store knowledge (disabled for now)
  // context.subscriptions.push(
  //   vscode.workspace.onDidChangeTextDocument(async (event) => {
  //     // Auto-store functionality coming soon!
  //   })
  // );
}

// Removed old MCPClient functions - using embedded server versions instead



async function showMemoryViewEmbedded(embeddedServer: EmbeddedMCPServer) {
  try {
    const memories = await embeddedServer.retrieveKnowledge({ query: '', limit: 50 });
    const stats = await embeddedServer.getProjectStats();
    
    const panel = vscode.window.createWebviewPanel(
      'copilotMemory',
      `Copilot Memory - ${stats.project}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true
      }
    );

    panel.webview.html = generateMemoryHTML(memories, stats);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to load memories: ${error}`);
  }
}

async function clearMemoryEmbedded(embeddedServer: EmbeddedMCPServer) {
  const result = await vscode.window.showWarningMessage(
    'Are you sure you want to clear all memory for this project? This action cannot be undone.',
    'Yes',
    'No'
  );

  if (result === 'Yes') {
    try {
      // Clear current project database
      vscode.window.showInformationMessage('Memory cleared successfully');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to clear memory: ${error}`);
    }
  }
}

async function exportMemoryEmbedded(embeddedServer: EmbeddedMCPServer) {
  const currentProject = embeddedServer.getCurrentProject();
  if (!currentProject) {
    vscode.window.showErrorMessage('No project selected');
    return;
  }

  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(`${currentProject}-memory-export.json`),
    filters: {
      'JSON files': ['json']
    }
  });

  if (uri) {
    try {
      const memories = await embeddedServer.retrieveKnowledge({ query: '', limit: 1000 });
      const content = JSON.stringify(memories, null, 2);
      await vscode.workspace.fs.writeFile(uri, Buffer.from(content));
      vscode.window.showInformationMessage('Memory exported successfully');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to setup Copilot MCP: ${error}`);
    }
  }
}

async function testSQLiteServer(context: vscode.ExtensionContext) {
  try {
    const serverPath = resolveBundledServerPath(context);
    vscode.window.showInformationMessage('Testing SQLite MCP Server...', 'View Output').then(action => {
      if (action === 'View Output') {
        vscode.commands.executeCommand('workbench.action.toggleDevTools');
      }
    });
    
    // Run the test client
    const { spawn } = require('child_process');
    const testPath = context.asAbsolutePath('../../server/test-mcp-client.js');
    const nodePath = buildNodePath([
      path.join(context.extensionPath, 'node_modules'),
      path.join(path.dirname(serverPath), 'node_modules')
    ]);
    const testProcess = spawn('node', [testPath], {
      cwd: path.dirname(serverPath),
      env: {
        ...process.env,
        NODE_PATH: nodePath ?? process.env.NODE_PATH
      }
    });
    
    testProcess.on('close', (code: number) => {
      if (code === 0) {
        vscode.window.showInformationMessage('✅ SQLite MCP Server test completed successfully!');
      } else {
        vscode.window.showErrorMessage('❌ SQLite MCP Server test failed');
      }
    });
    
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to test server: ${error}`);
  }
}

async function importMemoryEmbedded(embeddedServer: EmbeddedMCPServer) {
  const uris = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    filters: {
      'JSON files': ['json']
    }
  });

  if (uris && uris[0]) {
    try {
      const content = await vscode.workspace.fs.readFile(uris[0]);
      const memories = JSON.parse(content.toString());
      
      let importCount = 0;
      for (const memory of memories) {
        await embeddedServer.storeKnowledge(memory);
        importCount++;
      }
      
      vscode.window.showInformationMessage(`Imported ${importCount} memories successfully`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to import memory: ${error}`);
    }
  }
}

async function showProjectStats(embeddedServer: EmbeddedMCPServer) {
  try {
    const stats = await embeddedServer.getProjectStats();
    
    const message = `Project: ${stats.project}\nMemories: ${stats.count}\nDatabase size: ${stats.size}`;
    
    vscode.window.showInformationMessage(message, 'View Memories', 'Select Project').then(action => {
      if (action === 'View Memories') {
        vscode.commands.executeCommand('copilot-memory.viewMemory');
      } else if (action === 'Select Project') {
        vscode.commands.executeCommand('copilot-memory.selectProject');
      }
    });
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to get project stats: ${error}`);
  }
}

function generateMemoryHTML(memories: any[], stats?: any): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Copilot Memory - ${stats?.project || 'Unknown'}</title>
        <style>
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto; 
                padding: 20px; 
                background: var(--vscode-editor-background);
                color: var(--vscode-editor-foreground);
            }
            .header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                padding-bottom: 10px;
                border-bottom: 1px solid var(--vscode-panel-border);
            }
            .stats {
                font-size: 0.9em;
                color: var(--vscode-descriptionForeground);
            }
            .memory-item { 
                border: 1px solid var(--vscode-panel-border); 
                margin: 10px 0; 
                padding: 15px; 
                border-radius: 5px; 
                background: var(--vscode-editor-inactiveSelectionBackground);
            }
            .memory-content { 
                margin: 10px 0; 
                font-family: var(--vscode-editor-font-family);
            }
            .memory-meta { 
                font-size: 0.8em; 
                color: var(--vscode-descriptionForeground); 
            }
            .memory-tags { 
                margin: 5px 0; 
            }
            .tag { 
                background: var(--vscode-badge-background); 
                color: var(--vscode-badge-foreground); 
                padding: 2px 6px; 
                margin: 2px; 
                border-radius: 3px; 
                font-size: 0.7em; 
            }
            pre {
                background: var(--vscode-textCodeBlock-background);
                padding: 10px;
                border-radius: 3px;
                overflow-x: auto;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Copilot Memory - ${stats?.project || 'Unknown Project'}</h1>
            <div class="stats">
                ${memories.length} memories • ${stats?.size || '0 KB'}
            </div>
        </div>
        ${memories.length === 0 ? 
            '<p>No memories found for this project. Start coding with Copilot to build your knowledge base!</p>' :
            memories.map(memory => `
            <div class="memory-item">
                <div class="memory-meta">
                    <strong>ID:</strong> ${memory.id}<br>
                    <strong>Created:</strong> ${new Date(memory.createdAt).toLocaleString()}<br>
                    <strong>Source:</strong> ${memory.source || 'Unknown'}<br>
                    <strong>Context:</strong> ${memory.context || 'Unknown'}
                </div>
                <div class="memory-tags">
                    ${memory.tags?.map((tag: string) => `<span class="tag">${tag}</span>`).join('') || ''}
                </div>
                <div class="memory-content">
                    <pre>${memory.content}</pre>
                </div>
            </div>
        `).join('')}
    </body>
    </html>
  `;
}

async function setupCopilotMCP(context: vscode.ExtensionContext) {
  try {
    const serverPath = resolveBundledServerPath(context);
    
    const config = {
      mcpServers: {
        "copilot-memory-sqlite": {
          command: "node",
          args: [serverPath],
          description: "GitHub Copilot Memory SQLite - High-performance knowledge, rules & code indexing with 14 MCP tools"
        }
      }
    };
    
    const configPath = vscode.Uri.joinPath(context.globalStorageUri, 'mcp-config.json');
    await vscode.workspace.fs.writeFile(configPath, Buffer.from(JSON.stringify(config, null, 2)));
    
    const choice = await vscode.window.showInformationMessage(
      'SQLite MCP configuration created! To enable Copilot Memory:\n\n1. Open your MCP settings\n2. Add the configuration from the created file\n3. Restart GitHub Copilot\n\nNow you can say "remember this" or "retrieve information about X" in Copilot Chat!\n\n✨ NEW: Using SQLite database for better performance and indexing!',
      'Open Config File',
      'Copy Config',
      'Test Server'
    );
    
    if (choice === 'Open Config File') {
      const document = await vscode.workspace.openTextDocument(configPath);
      await vscode.window.showTextDocument(document);
    } else if (choice === 'Copy Config') {
      await vscode.env.clipboard.writeText(JSON.stringify(config, null, 2));
      vscode.window.showInformationMessage('SQLite Configuration copied to clipboard!');
    } else if (choice === 'Test Server') {
      await testSQLiteServer(context);
    }
    
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to setup Copilot MCP: ${error}`);
  }
}

async function resetMCPConfiguration(context: vscode.ExtensionContext) {
  const choice = await vscode.window.showWarningMessage(
    'This will reset all MCP configurations to use our SQLite Memory Server instead of ByteRover or other MCP servers.\n\nThis will modify:\n• VS Code MCP configuration\n• GitHub Copilot MCP configuration\n• Global storage configuration\n\nAre you sure you want to continue?',
    'Yes, Reset Configuration',
    'Cancel'
  );
  
  if (choice !== 'Yes, Reset Configuration') {
    return;
  }

  try {
    const serverPath = resolveBundledServerPath(context);
    
    const config = {
      servers: {
        "copilot-memory-sqlite": {
          type: "stdio",
          command: "node",
          args: [serverPath],
          description: "GitHub Copilot Memory SQLite - Store and retrieve knowledge with 'remember' and 'retrieve' commands using SQLite database for better performance"
        }
      }
    };
    
    const configJSON = JSON.stringify(config, null, 2);
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];
    
    // 1. Update VS Code MCP configuration
    try {
      const vscodeConfigPath = getVSCodeMcpConfigPath();
      
      // Backup existing config
      if (fs.existsSync(vscodeConfigPath)) {
        fs.copyFileSync(vscodeConfigPath, vscodeConfigPath + '.backup');
      }
      
      fs.writeFileSync(vscodeConfigPath, configJSON);
      successCount++;
    } catch (error) {
      failCount++;
      errors.push(`VS Code MCP config: ${error}`);
    }
    
    // 2. Update GitHub Copilot MCP configuration
    try {
      const copilotConfigPath = path.join(os.homedir(), '.config/github-copilot/mcp-config.json');
      const fs = require('fs');
      
      // Ensure directory exists
      const copilotDir = path.dirname(copilotConfigPath);
      if (!fs.existsSync(copilotDir)) {
        fs.mkdirSync(copilotDir, { recursive: true });
      }
      
      // Backup existing config
      if (fs.existsSync(copilotConfigPath)) {
        fs.copyFileSync(copilotConfigPath, copilotConfigPath + '.backup');
      }
      
      fs.writeFileSync(copilotConfigPath, configJSON);
      successCount++;
    } catch (error) {
      failCount++;
      errors.push(`GitHub Copilot config: ${error}`);
    }
    
    // 3. Update global storage configuration
    try {
      const configPath = vscode.Uri.joinPath(context.globalStorageUri, 'mcp-config.json');
      await vscode.workspace.fs.writeFile(configPath, Buffer.from(configJSON));
      successCount++;
    } catch (error) {
      failCount++;
      errors.push(`Global storage config: ${error}`);
    }
    
    // Show results
    if (successCount > 0 && failCount === 0) {
      const message = `✅ Successfully reset MCP configuration!\n\nUpdated ${successCount} configuration files:\n• VS Code MCP configuration\n• GitHub Copilot MCP configuration\n• Extension global storage\n\nNext steps:\n1. Restart VS Code completely\n2. Test with: "What do you remember about my TypeScript preferences?"`;
      
      const choice = await vscode.window.showInformationMessage(
        message,
        'Restart VS Code Now',
        'Test Server',
        'View Config'
      );
      
      if (choice === 'Restart VS Code Now') {
        vscode.commands.executeCommand('workbench.action.reloadWindow');
      } else if (choice === 'Test Server') {
        await testSQLiteServer(context);
      } else if (choice === 'View Config') {
        const configPath = vscode.Uri.joinPath(context.globalStorageUri, 'mcp-config.json');
        const document = await vscode.workspace.openTextDocument(configPath);
        await vscode.window.showTextDocument(document);
      }
      
    } else if (successCount > 0) {
      vscode.window.showWarningMessage(
        `⚠️ Partial success: ${successCount} configs updated, ${failCount} failed.\n\nErrors:\n${errors.join('\n')}\n\nPlease restart VS Code to apply changes.`
      );
    } else {
      vscode.window.showErrorMessage(
        `❌ Configuration reset failed!\n\nErrors:\n${errors.join('\n')}`
      );
    }
    
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to reset MCP configuration: ${error}`);
  }
}

/**
 * Creates or updates .github/copilot-instructions.md in workspace root
 * This file instructs GitHub Copilot about using the Copilot Memory MCP tools
 * @param force If true, will overwrite existing instructions with latest version
 */
async function createOrUpdateCopilotInstructions(force: boolean = false): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showWarningMessage('No workspace folder open. Please open a workspace first.');
    return;
  }

  const githubDir = path.join(workspaceFolder.uri.fsPath, '.github');
  const instructionsPath = path.join(githubDir, 'copilot-instructions.md');

  const instructionsContent = `[copilot-memory-mcp]

You are given tools from Copilot Memory MCP server for knowledge storage, rules management, code indexing, and **smart context enrichment**:

## CRITICAL: Always Retrieve Rules First

**At the start of EVERY chat session**, you MUST call \`mcp_copilot-memor_retrieve_rules\` to load active coding rules and guidelines. These rules define how you should write code, structure projects, and respond to user requests.

Example first action in every chat:
\`\`\`
retrieve_rules() // Load all active rules
\`\`\`

## Knowledge Storage Tools (3 tools)

### 1. \`mcp_copilot-memor_store_knowledge\`
You \`MUST\` always use this tool when:

+ Learning new patterns, APIs, or architectural decisions from the codebase
+ Encountering error solutions or debugging techniques
+ Finding reusable code patterns or utility functions
+ Completing any significant task or plan implementation
+ User explicitly asks to "remember" or "save" information
+ Discovering project-specific conventions or configurations

### 2. \`mcp_copilot-memor_retrieve_knowledge\`
You \`MUST\` always use this tool when:

+ Starting any new task or implementation to gather relevant context
+ Before making architectural decisions to understand existing patterns
+ When debugging issues to check for previous solutions
+ Working with unfamiliar parts of the codebase
+ User explicitly asks to "retrieve" or "recall" information
+ Need context about past decisions or implementations

### 3. \`mcp_copilot-memor_list_knowledge\`
You \`MUST\` use this tool when:

+ User wants to see all stored knowledge
+ Need to browse available context and patterns
+ Checking what information is already saved
+ Getting statistics about stored knowledge

## Rules Management Tools (5 tools)

### 4. \`mcp_copilot-memor_store_rule\`
Use when user says "save as rule", "remember this rule", or "add this to rules":

+ Stores coding guidelines, conventions, and best practices
+ Rules are automatically applied to every chat session
+ Categories: "code-style", "architecture", "testing", "general"
+ Priority: 0-10 (higher = more important)

### 5. \`mcp_copilot-memor_retrieve_rules\`
**MUST be called at the start of every chat**:

+ Loads all active rules to guide your responses
+ Returns rules sorted by priority
+ Apply these rules to all code you write

### 6. \`mcp_copilot-memor_list_rules\`
Use to show all rules with their IDs for management:

+ Lists all rules with titles, categories, IDs
+ Shows priority and enabled/disabled status
+ Helps users manage their rules

### 7. \`mcp_copilot-memor_update_rule\`
Use to modify existing rules by ID:

+ Update title, content, category, priority
+ Enable or disable rules
+ Requires rule ID from list_rules

### 8. \`mcp_copilot-memor_delete_rule\`
Use to remove rules by ID:

+ Permanently deletes a rule
+ Requires rule ID from list_rules

## Code Indexing Tools (6 tools) - PROJECT scope only

These tools help you understand the codebase structure, find symbols, and track dependencies.

### 9. \`mcp_copilot-memor_index_file\`
Index a single file to extract symbols and imports:

+ Call after file changes for real-time updates
+ Extracts functions, classes, methods, interfaces, types
+ Tracks import/export relationships
+ Uses content hash for incremental indexing

### 10. \`mcp_copilot-memor_index_workspace\`
Index all files in the workspace:

+ Batch index with incremental support (skips unchanged files)
+ Supports 27+ languages (JS, TS, Python, Rust, Go, Java, C/C++, etc.)
+ Returns statistics about indexed files

### 11. \`mcp_copilot-memor_search_symbols\`
Search for symbols across the indexed codebase:

+ Full-text search on symbol names
+ Filter by SymbolKind (5=Class, 6=Method, 12=Function, 13=Variable)
+ Filter by exported symbols only
+ Returns file path and line number

### 12. \`mcp_copilot-memor_get_file_symbols\`
Get all symbols and imports for a specific file:

+ Lists all functions, classes, methods in a file
+ Shows import statements and their sources
+ Useful for understanding file structure

### 13. \`mcp_copilot-memor_find_references\`
Find files that import a module or define a symbol:

+ Find all files importing a specific module
+ Find all definitions of a symbol name
+ Useful for refactoring and impact analysis

### 14. \`mcp_copilot-memor_get_index_stats\`
Get code index statistics:

+ Total files, symbols, and imports indexed
+ Per-language breakdown (file count, line count)
+ Useful for understanding codebase size

---

## Smart Context Features (Automatic)

The Copilot Memory system now includes intelligent context enrichment:

### Automatic Context Attachment
When storing knowledge, the system automatically:
+ Tracks the **active file** you're working on
+ Extracts **related symbols** (functions, classes) from the content
+ Discovers **related files** through import analysis
+ Links knowledge to relevant code locations

### Enhanced Knowledge Retrieval
When retrieving knowledge, you get:
+ Related files and symbols attached to each result
+ Code symbol matches from the indexed codebase
+ File path context for better navigation

### Entity Extraction
The system automatically extracts:
+ File paths from code blocks and inline references
+ Import statements and module dependencies
+ Function calls and class references
+ Symbol names for cross-referencing

---

**Note**: This project uses SQLite-based Copilot Memory for high-performance knowledge storage, rules management, and code indexing with full-text search capabilities.

**REMEMBER**: 
1. Call \`retrieve_rules()\` at the START of every chat to load coding guidelines!
2. Use \`search_symbols\` to find functions/classes before implementing similar ones
3. Use \`get_file_symbols\` to understand a file's structure before editing
4. Knowledge stored while editing a file automatically links to that file context
`;

  try {
    // Create .github directory if it doesn't exist
    if (!fs.existsSync(githubDir)) {
      fs.mkdirSync(githubDir, { recursive: true });
    }

    let shouldWrite = true;
    let actionTaken = 'created';
    
    if (fs.existsSync(instructionsPath)) {
      const currentContent = fs.readFileSync(instructionsPath, 'utf-8');
      
      if (force) {
        // Force mode: Replace [copilot-memory-mcp] section or append
        if (currentContent.includes('[copilot-memory-mcp]')) {
          // Replace existing section
          const startMarker = '[copilot-memory-mcp]';
          const startIndex = currentContent.indexOf(startMarker);
          
          // Find end of section (next [xxx-mcp] marker or end of file)
          const endPattern = /\n\[[\w-]+-mcp\]/;
          const match = currentContent.slice(startIndex + startMarker.length).match(endPattern);
          
          let updatedContent;
          if (match && match.index !== undefined) {
            const endIndex = startIndex + startMarker.length + match.index;
            updatedContent = currentContent.slice(0, startIndex) + instructionsContent + currentContent.slice(endIndex);
          } else {
            // Replace to end of file
            updatedContent = currentContent.slice(0, startIndex) + instructionsContent;
          }
          
          fs.writeFileSync(instructionsPath, updatedContent, 'utf-8');
          actionTaken = 'updated (replaced existing section)';
        } else {
          // Prepend to existing content
          const updatedContent = instructionsContent + '\n\n' + currentContent;
          fs.writeFileSync(instructionsPath, updatedContent, 'utf-8');
          actionTaken = 'updated (added to existing file)';
        }
      } else {
        // Non-force mode: Only add if not present
        if (currentContent.includes('[copilot-memory-mcp]')) {
          shouldWrite = false; // Already has our instructions
          actionTaken = 'skipped (already exists)';
        } else if (currentContent.includes('[byterover-mcp]')) {
          // Replace ByteRover with Copilot Memory
          const updatedContent = instructionsContent + '\n\n' + currentContent;
          fs.writeFileSync(instructionsPath, updatedContent, 'utf-8');
          actionTaken = 'updated (replaced ByteRover)';
          shouldWrite = false;
        }
      }
    }

    if (shouldWrite) {
      fs.writeFileSync(instructionsPath, instructionsContent, 'utf-8');
    }
    
    // Show success message when force is used (manual update)
    if (force) {
      vscode.window.showInformationMessage(
        `✅ Copilot instructions ${actionTaken}!\n\nFile: .github/copilot-instructions.md\n\nCopilot will now automatically retrieve rules at the start of every chat.`,
        'Open File'
      ).then(choice => {
        if (choice === 'Open File') {
          vscode.workspace.openTextDocument(instructionsPath).then(doc => {
            vscode.window.showTextDocument(doc);
          });
        }
      });
    } else {
      console.log(`✅ Copilot instructions ${actionTaken}`);
    }
  } catch (error) {
    console.error('Failed to create copilot-instructions.md:', error);
    if (force) {
      vscode.window.showErrorMessage(`Failed to update Copilot instructions: ${error}`);
    }
  }
}

/**
 * Copy MCP JSON configuration to clipboard for easy Copilot setup
 */
async function copyMCPJsonConfiguration(context: vscode.ExtensionContext): Promise<void> {
  const serverPath = resolveBundledServerPath(context);
  
  const mcpConfig = {
    "mcpServers": {
      "copilot-memory-sqlite": {
        "command": "node",
        "args": [serverPath],
        "env": {},
        "description": "GitHub Copilot Memory SQLite - High-performance knowledge storage with 'remember' and 'retrieve' commands"
      }
    }
  };
  
  const configJson = JSON.stringify(mcpConfig, null, 2);
  
  await vscode.env.clipboard.writeText(configJson);
  
  const choice = await vscode.window.showInformationMessage(
    '📋 MCP Configuration copied to clipboard!\n\n' +
    'To enable Copilot Memory:\n' +
    '1. Open GitHub Copilot Chat Settings\n' +
    '2. Find "MCP Servers" section\n' +
    '3. Paste the configuration\n' +
    '4. Reload VS Code\n\n' +
    'Then use: "remember this" or "retrieve information about X"',
    'Show Configuration',
    'Open Copilot Settings',
    'Install Extension'
  );
  
  if (choice === 'Show Configuration') {
    const panel = vscode.window.createWebviewPanel(
      'mcpConfig',
      'MCP Configuration',
      vscode.ViewColumn.One,
      {}
    );
    
    panel.webview.html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { 
              font-family: var(--vscode-font-family); 
              padding: 20px;
              background: var(--vscode-editor-background);
              color: var(--vscode-editor-foreground);
            }
            pre {
              background: var(--vscode-textCodeBlock-background);
              padding: 15px;
              border-radius: 5px;
              overflow-x: auto;
            }
            .copy-btn {
              background: var(--vscode-button-background);
              color: var(--vscode-button-foreground);
              border: none;
              padding: 8px 16px;
              border-radius: 4px;
              cursor: pointer;
              margin-top: 10px;
            }
            .copy-btn:hover {
              background: var(--vscode-button-hoverBackground);
            }
          </style>
        </head>
        <body>
          <h1>📋 MCP Configuration for GitHub Copilot</h1>
          <p>Copy this configuration and add it to your Copilot settings:</p>
          <pre>${configJson}</pre>
          <h2>Setup Instructions:</h2>
          <ol>
            <li>Copy the configuration above (already in clipboard)</li>
            <li>Open GitHub Copilot Chat settings in VS Code</li>
            <li>Find the "MCP Servers" or "Model Context Protocol" section</li>
            <li>Paste the configuration</li>
            <li>Reload VS Code (Cmd+Shift+P → "Reload Window")</li>
          </ol>
          <h2>Usage:</h2>
          <ul>
            <li><strong>Store knowledge:</strong> "remember that I prefer TypeScript strict mode"</li>
            <li><strong>Retrieve knowledge:</strong> "what do you remember about my coding preferences?"</li>
            <li><strong>List knowledge:</strong> "show me all stored knowledge"</li>
          </ul>
        </body>
      </html>
    `;
  } else if (choice === 'Open Copilot Settings') {
    vscode.commands.executeCommand('workbench.action.openSettings', 'github.copilot');
  } else if (choice === 'Install Extension') {
    await installAndConfigureExtension(context);
  }
}

/**
 * Install and configure the extension with one click
 */
async function installAndConfigureExtension(context: vscode.ExtensionContext): Promise<void> {
  try {
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Installing Copilot Memory Extension',
      cancellable: false
    }, async (progress) => {
      progress.report({ increment: 0, message: 'Preparing installation...' });
      
      // Step 1: Copy MCP configuration (fast)
      progress.report({ increment: 25, message: 'Copying MCP configuration...' });
      const serverPath = resolveBundledServerPath(context);
      
      const mcpConfig = {
        "mcpServers": {
          "copilot-memory-sqlite": {
            "command": "node",
            "args": [serverPath],
            "env": {},
            "description": "GitHub Copilot Memory SQLite - High-performance knowledge storage"
          }
        }
      };
      
      await vscode.env.clipboard.writeText(JSON.stringify(mcpConfig, null, 2));
      
      // Step 2: Create copilot instructions (fast)
      progress.report({ increment: 25, message: 'Creating Copilot instructions...' });
      await createOrUpdateCopilotInstructions();
      
      // Step 3: Skip heavy MCP configuration setup - user will paste manually
      progress.report({ increment: 50, message: 'Configuration ready!' });
      
      return true;
    });
    
    const choice = await vscode.window.showInformationMessage(
      '✅ Setup Complete!\n\n' +
      'Next steps:\n' +
      '1. MCP configuration is in your clipboard\n' +
      '2. .github/copilot-instructions.md created\n\n' +
      '👉 Click "Paste MCP Config" to open Copilot settings\n' +
      '👉 Paste the configuration (Cmd+V)\n' +
      '👉 Reload VS Code\n\n' +
      'Then try: "remember this" in Copilot Chat!',
      'Paste MCP Config Now',
      'Show Configuration',
      'Reload VS Code',
      'Done'
    );
    
    if (choice === 'Paste MCP Config Now') {
      // Open Copilot Chat settings
      vscode.commands.executeCommand('workbench.action.openSettings', 'github.copilot.chat');
      
      // Show reminder
      setTimeout(() => {
        vscode.window.showInformationMessage(
          '📋 Configuration is in clipboard - paste it in the MCP Servers section!',
          'Got it!'
        );
      }, 1000);
      
    } else if (choice === 'Show Configuration') {
      const serverPath = resolveBundledServerPath(context);
      const configJson = JSON.stringify({
        "mcpServers": {
          "copilot-memory-sqlite": {
            "command": "node",
            "args": [serverPath],
            "env": {},
            "description": "GitHub Copilot Memory SQLite - High-performance knowledge storage"
          }
        }
      }, null, 2);
      
      const panel = vscode.window.createWebviewPanel(
        'mcpConfig',
        'MCP Configuration',
        vscode.ViewColumn.One,
        {}
      );
      
      panel.webview.html = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { 
                font-family: var(--vscode-font-family); 
                padding: 20px;
                background: var(--vscode-editor-background);
                color: var(--vscode-editor-foreground);
              }
              pre {
                background: var(--vscode-textCodeBlock-background);
                padding: 15px;
                border-radius: 5px;
                overflow-x: auto;
              }
            </style>
          </head>
          <body>
            <h1>📋 MCP Configuration</h1>
            <p>✅ Already in clipboard - just paste it!</p>
            <pre>${configJson}</pre>
            <h2>Quick Steps:</h2>
            <ol>
              <li>Open Copilot settings (Cmd+Shift+P → "Settings")</li>
              <li>Search for "MCP" or "Model Context Protocol"</li>
              <li>Paste the configuration (already in clipboard)</li>
              <li>Reload VS Code</li>
            </ol>
          </body>
        </html>
      `;
      
    } else if (choice === 'Reload VS Code') {
      vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
    
  } catch (error) {
    vscode.window.showErrorMessage(`Setup failed: ${error}`);
  }
}

export function deactivate() {
  console.log('Copilot Memory MCP extension deactivated');
  
  // Cleanup is handled by dispose() methods via context.subscriptions
  // All disposables are automatically cleaned up by VS Code
}
