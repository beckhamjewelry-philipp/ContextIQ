const fs = require('fs');
const path = require('path');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function copyFile(source, destination) {
  ensureDir(path.dirname(destination));
  fs.copyFileSync(source, destination);
}

function copyServer() {
  const rootDir = path.resolve(__dirname, '..', '..');
  const sourceServer = path.join(rootDir, 'server', 'index-sqlite.js');

  if (!fs.existsSync(sourceServer)) {
    throw new Error(`MCP server source not found: ${sourceServer}`);
  }

  const extensionDir = path.resolve(__dirname, '..');
  const targetServer = path.join(extensionDir, 'server', 'index-sqlite.js');
  const targetServerDist = path.join(extensionDir, 'server', 'dist', 'index-sqlite.js');

  copyFile(sourceServer, targetServer);
  copyFile(sourceServer, targetServerDist);

  console.log('✅ Copied MCP server into extension package');
}

try {
  copyServer();
} catch (error) {
  console.error(`❌ Failed to copy MCP server: ${error.message || error}`);
  process.exit(1);
}
