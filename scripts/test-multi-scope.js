#!/usr/bin/env node

/**
 * Test multi-scope knowledge storage and retrieval
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');

const storageDir = path.join(os.homedir(), '.copilot-memory');

console.log('🧪 Testing Multi-Scope Knowledge Management\n');

// Test data
const testData = [
  { scope: 'project', content: 'This project uses React with TypeScript', context: 'project-tech' },
  { scope: 'user', content: 'I prefer tabs over spaces for indentation', context: 'personal-preferences' },
  { scope: 'global', content: 'Best practice: Always use semantic versioning', context: 'best-practices' }
];

async function testScope(scope) {
  const dbPath = scope === 'project' ? 
    path.join(storageDir, 'copilot-memory-mcp.db') :
    path.join(storageDir, `${scope}.db`);
  
  console.log(`\n📂 Testing ${scope.toUpperCase()} scope: ${path.basename(dbPath)}`);
  
  return new Promise((resolve) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error(`   ❌ Error opening database: ${err.message}`);
        resolve();
        return;
      }

      // Count entries
      db.get('SELECT COUNT(*) as count FROM knowledge', (err, result) => {
        if (err) {
          console.error(`   ❌ Error counting: ${err.message}`);
          db.close();
          resolve();
          return;
        }

        console.log(`   ✅ Found ${result.count} entries`);

        // Show sample
        db.all('SELECT context, SUBSTR(content, 1, 60) as preview FROM knowledge LIMIT 3', (err, rows) => {
          if (err) {
            console.error(`   ❌ Error reading: ${err.message}`);
          } else if (rows.length > 0) {
            console.log(`   📝 Sample entries:`);
            rows.forEach((row, i) => {
              console.log(`      ${i + 1}. [${row.context}] ${row.preview}...`);
            });
          }

          db.close();
          resolve();
        });
      });
    });
  });
}

async function main() {
  console.log(`📊 Checking databases in: ${storageDir}\n`);
  
  // Test each scope
  await testScope('project');
  await testScope('user');
  await testScope('global');
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Multi-scope test complete!\n');
  console.log('Try these commands in Copilot Chat:');
  console.log('  - "remember [project] this is specific to current project"');
  console.log('  - "remember [user] this is my personal preference"');
  console.log('  - "remember [global] this is a universal best practice"');
  console.log('  - "retrieve knowledge about TypeScript" (searches all scopes)');
  console.log('  - "list knowledge from user scope"');
}

main().catch(console.error);
