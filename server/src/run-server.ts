#!/usr/bin/env node

/**
 * Copilot Memory MCP Server Runner
 * 
 * This script detects the current project and starts the MCP server
 * with a project-specific database for local storage.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join, basename } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function detectProjectRoot(): string {
  let currentDir = process.cwd();
  
  // Look for common project indicators
  const projectIndicators = [
    'package.json',
    '.git',
    'pyproject.toml',
    'Cargo.toml',
    'pom.xml',
    'build.gradle',
    'composer.json',
    'requirements.txt'
  ];
  
  // Walk up the directory tree to find project root
  while (currentDir !== '/') {
    const hasIndicator = projectIndicators.some(indicator => 
      existsSync(join(currentDir, indicator))
    );
    
    if (hasIndicator) {
      return currentDir;
    }
    
    const parent = dirname(currentDir);
    if (parent === currentDir) break; // Reached root
    currentDir = parent;
  }
  
  // Fallback to current directory
  return process.cwd();
}

function main() {
  const projectRoot = detectProjectRoot();
  const projectName = basename(projectRoot);
  
  console.error(`🧠 Copilot Memory MCP Server`);
  console.error(`📁 Project: ${projectName}`);
  console.error(`📍 Root: ${projectRoot}`);
  console.error(`💾 Database: ~/.copilot-memory/${projectName.replace(/[^a-zA-Z0-9-_]/g, '_')}.db`);
  console.error(`🚀 Starting server...`);
  
  // Set environment variable for project path
  process.env.COPILOT_MEMORY_PROJECT_PATH = projectRoot;
  
  // Start the MCP server
  const serverPath = join(__dirname, 'index.js');
  const serverProcess = spawn('node', [serverPath], {
    stdio: 'inherit',
    env: process.env
  });
  
  serverProcess.on('error', (error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
  
  serverProcess.on('exit', (code) => {
    process.exit(code || 0);
  });
  
  // Forward signals
  process.on('SIGINT', () => serverProcess.kill('SIGINT'));
  process.on('SIGTERM', () => serverProcess.kill('SIGTERM'));
}

main();