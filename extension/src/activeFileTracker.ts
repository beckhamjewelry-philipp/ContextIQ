/**
 * ActiveFileTracker - Tracks the currently active file in VS Code
 * 
 * This module provides utilities for tracking the active file
 * and extracting workspace-relative paths for context enrichment.
 */

import * as vscode from 'vscode';
import * as path from 'path';

export interface ActiveFileContext {
  absolutePath: string;
  relativePath: string;
  languageId: string;
  fileName: string;
  workspaceFolder?: string;
}

export class ActiveFileTracker implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private _currentFile: ActiveFileContext | null = null;
  private _onFileChanged = new vscode.EventEmitter<ActiveFileContext | null>();
  
  public readonly onFileChanged = this._onFileChanged.event;

  constructor() {
    // Initialize with current active editor
    this.updateActiveFile(vscode.window.activeTextEditor);
    
    // Track editor changes
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        this.updateActiveFile(editor);
      })
    );
    
    // Track when a document is saved (file might be renamed)
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument((doc) => {
        if (vscode.window.activeTextEditor?.document === doc) {
          this.updateActiveFile(vscode.window.activeTextEditor);
        }
      })
    );
  }

  private updateActiveFile(editor: vscode.TextEditor | undefined): void {
    if (!editor || editor.document.uri.scheme !== 'file') {
      this._currentFile = null;
      this._onFileChanged.fire(null);
      return;
    }
    
    const doc = editor.document;
    const absolutePath = doc.uri.fsPath;
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(doc.uri);
    
    this._currentFile = {
      absolutePath,
      relativePath: workspaceFolder 
        ? path.relative(workspaceFolder.uri.fsPath, absolutePath)
        : path.basename(absolutePath),
      languageId: doc.languageId,
      fileName: path.basename(absolutePath),
      workspaceFolder: workspaceFolder?.name
    };
    
    this._onFileChanged.fire(this._currentFile);
  }

  /**
   * Get the current active file context
   */
  get currentFile(): ActiveFileContext | null {
    return this._currentFile;
  }

  /**
   * Get the relative path of the active file (or null if none)
   */
  getActiveFilePath(): string | null {
    return this._currentFile?.relativePath ?? null;
  }

  /**
   * Get the absolute path of the active file (or null if none)
   */
  getActiveFileAbsolutePath(): string | null {
    return this._currentFile?.absolutePath ?? null;
  }

  /**
   * Get the language ID of the active file
   */
  getActiveFileLanguage(): string | null {
    return this._currentFile?.languageId ?? null;
  }

  /**
   * Check if there's an active file
   */
  hasActiveFile(): boolean {
    return this._currentFile !== null;
  }

  /**
   * Get a summary of the current file context
   */
  getContextSummary(): string | null {
    if (!this._currentFile) {
      return null;
    }
    return `${this._currentFile.relativePath} (${this._currentFile.languageId})`;
  }

  dispose(): void {
    this._onFileChanged.dispose();
    this.disposables.forEach(d => d.dispose());
  }
}

// Singleton instance for easy access
let _tracker: ActiveFileTracker | null = null;

export function getActiveFileTracker(): ActiveFileTracker {
  if (!_tracker) {
    _tracker = new ActiveFileTracker();
  }
  return _tracker;
}

export function disposeActiveFileTracker(): void {
  if (_tracker) {
    _tracker.dispose();
    _tracker = null;
  }
}
