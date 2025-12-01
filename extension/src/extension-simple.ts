import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  console.log('Copilot Memory MCP extension is now active!');

  // Register a simple command
  const disposable = vscode.commands.registerCommand('copilot-memory.selectProject', () => {
    vscode.window.showInformationMessage('Select Project command called!');
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}