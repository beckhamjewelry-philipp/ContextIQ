#!/usr/bin/env node

const { spawn } = require('child_process');

console.log('Testing MCP Server...');

// Start the MCP server
const server = spawn('node', ['index.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  cwd: __dirname
});

server.stderr.on('data', (data) => {
  console.log('Server stderr:', data.toString());
});

server.stdout.on('data', (data) => {
  console.log('Server stdout:', data.toString());
});

// Send MCP protocol messages
setTimeout(() => {
  console.log('Sending initialize request...');
  
  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      }
    }
  };
  
  server.stdin.write(JSON.stringify(initRequest) + '\n');
  
  setTimeout(() => {
    console.log('Sending tools/list request...');
    
    const toolsRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    };
    
    server.stdin.write(JSON.stringify(toolsRequest) + '\n');
    
    setTimeout(() => {
      console.log('Sending store_knowledge request...');
      
      const storeRequest = {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'store_knowledge',
          arguments: {
            content: 'This is a test SQLite knowledge entry that should be stored in the database',
            tags: ['test', 'sqlite', 'mcp'],
            context: 'mcp-test'
          }
        }
      };
      
      server.stdin.write(JSON.stringify(storeRequest) + '\n');
      
      // Wait for responses and cleanup
      setTimeout(() => {
        server.kill('SIGTERM');
        
        // Check if database was created
        const fs = require('fs');
        const path = require('path');
        const os = require('os');
        
        const dbPath = path.join(os.homedir(), '.copilot-memory', 'server.db');
        if (fs.existsSync(dbPath)) {
          const stats = fs.statSync(dbPath);
          console.log(`✅ Database created successfully: ${dbPath} (${stats.size} bytes)`);
        } else {
          console.log('❌ Database was not created');
        }
        
        process.exit(0);
      }, 2000);
    }, 1000);
  }, 1000);
}, 500);

server.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
});