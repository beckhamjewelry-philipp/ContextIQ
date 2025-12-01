#!/usr/bin/env node

/**
 * Transfer ByteRover knowledge to main MCP server database
 */

const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

class KnowledgeTransfer {
  constructor() {
    this.storageDir = path.join(os.homedir(), '.copilot-memory');
    this.serverPath = '/Users/admin/NodeMCPs/copilot-memory-mcp/server/index.js';
  }

  async transferKnowledge(content, tags, context) {
    return new Promise((resolve, reject) => {
      const jsonRequest = JSON.stringify({
        jsonrpc: "2.0",
        id: Math.floor(Math.random() * 1000),
        method: "tools/call",
        params: {
          name: "store_knowledge",
          arguments: {
            content: content,
            tags: tags,
            context: context
          }
        }
      });

      console.log(`📦 Transferring: ${content.substring(0, 50)}...`);

      const mcpServer = spawn('node', [this.serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: path.dirname(this.serverPath)
      });

      let output = '';
      let errorOutput = '';

      mcpServer.stdout.on('data', (data) => {
        output += data.toString();
      });

      mcpServer.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      mcpServer.on('close', (code) => {
        if (code === 0) {
          try {
            // Parse the JSON response
            const lines = output.trim().split('\n');
            const jsonLine = lines.find(line => {
              try {
                JSON.parse(line);
                return true;
              } catch {
                return false;
              }
            });

            if (jsonLine) {
              const response = JSON.parse(jsonLine);
              if (response.result && !response.result.isError) {
                console.log(`✅ Successfully transferred knowledge`);
                resolve(response);
              } else {
                console.error(`❌ Transfer failed:`, response.result);
                reject(new Error(response.result.content?.[0]?.text || 'Unknown error'));
              }
            } else {
              console.error(`❌ No valid JSON response found in output:`, output);
              reject(new Error('No valid JSON response'));
            }
          } catch (parseError) {
            console.error(`❌ Failed to parse response:`, parseError);
            console.error('Raw output:', output);
            reject(parseError);
          }
        } else {
          console.error(`❌ MCP server exited with code ${code}`);
          console.error('Error output:', errorOutput);
          reject(new Error(`Server exit code ${code}`));
        }
      });

      mcpServer.stdin.write(jsonRequest + '\n');
      mcpServer.stdin.end();
    });
  }

  async transferAllKnowledge() {
    console.log('🚀 Starting knowledge transfer to main MCP server...\n');

    // Read from the imported database and transfer to main server
    const sqlite3 = require('sqlite3').verbose();
    const importDbPath = path.join(this.storageDir, 'byterover-import.db');
    
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(importDbPath, (err) => {
        if (err) {
          reject(err);
          return;
        }

        db.all('SELECT * FROM knowledge ORDER BY created_at', async (err, rows) => {
          if (err) {
            reject(err);
            return;
          }

          console.log(`📊 Found ${rows.length} knowledge entries to transfer\n`);

          let transferred = 0;
          let failed = 0;

          for (const row of rows) {
            try {
              const tags = row.tags ? row.tags.split(',') : [];
              await this.transferKnowledge(row.content, tags, row.context);
              transferred++;
              
              // Small delay to prevent overwhelming the server
              await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
              console.error(`❌ Failed to transfer entry ${row.id}:`, error.message);
              failed++;
            }
          }

          console.log(`\n🎉 Transfer completed!`);
          console.log(`   ✅ Successfully transferred: ${transferred}`);
          console.log(`   ❌ Failed transfers: ${failed}`);
          console.log(`   📊 Total processed: ${rows.length}`);

          db.close();
          resolve({ transferred, failed, total: rows.length });
        });
      });
    });
  }
}

// Main execution
async function main() {
  const transfer = new KnowledgeTransfer();
  
  try {
    const result = await transfer.transferAllKnowledge();
    console.log('\n✅ All ByteRover knowledge has been transferred to the main MCP server!');
    console.log('🚀 You can now test with GitHub Copilot using "retrieve" commands.');
  } catch (error) {
    console.error('❌ Transfer failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { KnowledgeTransfer };