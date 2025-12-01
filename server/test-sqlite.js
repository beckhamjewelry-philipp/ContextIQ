#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');
const fs = require('fs');

console.log('Testing SQLite3 MCP Server...');

// Test 1: Basic SQLite functionality
const storageDir = path.join(os.homedir(), '.copilot-memory');
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

const dbPath = path.join(storageDir, 'test.db');
console.log('Creating database at:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Database creation error:', err);
    process.exit(1);
  }
  
  console.log('✅ Database created successfully');
  
  // Test 2: Create table
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS knowledge (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `, (err) => {
      if (err) {
        console.error('❌ Table creation error:', err);
        process.exit(1);
      }
      console.log('✅ Table created successfully');
      
      // Test 3: Insert data
      const stmt = db.prepare('INSERT INTO knowledge (id, content, created_at) VALUES (?, ?, ?)');
      stmt.run(['test1', 'Test knowledge entry', Date.now()], function(err) {
        if (err) {
          console.error('❌ Insert error:', err);
          process.exit(1);
        }
        console.log('✅ Data inserted successfully, rowID:', this.lastID);
        
        // Test 4: Query data
        db.all('SELECT * FROM knowledge', (err, rows) => {
          if (err) {
            console.error('❌ Query error:', err);
            process.exit(1);
          }
          console.log('✅ Query successful, rows:', rows.length);
          console.log('Data:', rows);
          
          db.close((err) => {
            if (err) {
              console.error('❌ Close error:', err);
            } else {
              console.log('✅ Database closed successfully');
              console.log('🎉 All SQLite tests passed!');
              
              // Check file size
              const stats = fs.statSync(dbPath);
              console.log(`Database file size: ${stats.size} bytes`);
            }
          });
        });
      });
      
      stmt.finalize();
    });
  });
});