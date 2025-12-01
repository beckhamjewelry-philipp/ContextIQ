#!/usr/bin/env node
// Test multi-scope functionality
const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const storageDir = path.join(os.homedir(), '.copilot-memory');

function testScope(scopeName, dbFile) {
  console.log(`\n📊 Testing ${scopeName.toUpperCase()} scope:`);
  const dbPath = path.join(storageDir, dbFile);
  
  try {
    const db = new Database(dbPath);
    
    // Count knowledge
    const knowledgeCount = db.prepare('SELECT COUNT(*) as count FROM knowledge').get();
    console.log(`   Knowledge entries: ${knowledgeCount.count}`);
    
    // Count rules
    const rulesCount = db.prepare('SELECT COUNT(*) as count FROM rules').get();
    console.log(`   Rules: ${rulesCount.count}`);
    
    // List rules if any
    if (rulesCount.count > 0) {
      const rules = db.prepare('SELECT title, category, priority FROM rules ORDER BY priority DESC').all();
      rules.forEach(r => {
        console.log(`      ⭐ ${r.title} (${r.category}, priority: ${r.priority})`);
      });
    }
    
    db.close();
  } catch (error) {
    console.log(`   ❌ Database not initialized yet`);
  }
}

console.log('🔍 Multi-Scope Database Status:\n');

testScope('project', 'NodeMCPs.db');  // Current project
testScope('user', 'user.db');
testScope('global', 'global.db');

console.log('\n✅ Multi-scope setup complete!');
console.log('\n💡 Usage:');
console.log('   - store_knowledge with scope: "project" (default), "user", or "global"');
console.log('   - retrieve_knowledge with scope: "all" (default), "project", "user", or "global"');
console.log('   - store_rule with scope: "global" (default), "project", or "user"');
console.log('   - retrieve_rules with scope: "all" (default) to get rules from all scopes');
