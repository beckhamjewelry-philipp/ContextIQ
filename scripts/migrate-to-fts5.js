#!/usr/bin/env node

/**
 * Migration script to add FTS5 full-text search to existing databases
 * This will rebuild existing databases with FTS5 support for better search
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');
const fs = require('fs');

class FTS5Migrator {
  constructor() {
    this.storageDir = path.join(os.homedir(), '.copilot-memory');
  }

  async migrateDatabase(dbPath) {
    return new Promise((resolve, reject) => {
      console.log(`\n🔄 Migrating: ${path.basename(dbPath)}`);
      
      const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error(`❌ Failed to open database: ${err.message}`);
          reject(err);
          return;
        }

        db.serialize(() => {
          // First check if knowledge table exists
          db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='knowledge'", (err, tableRow) => {
            if (err) {
              console.error(`❌ Error checking for knowledge table: ${err.message}`);
              db.close();
              reject(err);
              return;
            }

            if (!tableRow) {
              console.log('ℹ️  No knowledge table found, skipping (will be created on first use)');
              db.close();
              resolve();
              return;
            }

            // Check if scope column exists (v1.0.7+)
            db.get("PRAGMA table_info(knowledge)", (err, rows) => {
              // Add scope column if missing
              db.all("PRAGMA table_info(knowledge)", (err, columns) => {
                const hasScope = columns && columns.some(col => col.name === 'scope');
                
                if (!hasScope) {
                  console.log('📝 Adding scope column for multi-scope support...');
                  db.run(`ALTER TABLE knowledge ADD COLUMN scope TEXT DEFAULT 'project'`, (err) => {
                    if (err && !err.message.includes('duplicate column')) {
                      console.error(`⚠️  Warning: Failed to add scope column: ${err.message}`);
                    } else {
                      console.log('✅ Added scope column');
                    }
                    
                    // Continue with FTS5 migration
                    this.migrateFTS5(db, resolve, reject);
                  });
                } else {
                  // Continue with FTS5 migration
                  this.migrateFTS5(db, resolve, reject);
                }
              });
            });
          });
        });
      });
    });
  }

  migrateFTS5(db, resolve, reject) {
    // Check if FTS5 table already exists
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='knowledge_fts'", (err, row) => {
      if (err) {
        console.error(`❌ Error checking for FTS table: ${err.message}`);
        db.close();
        reject(err);
        return;
      }

      if (row) {
        console.log('ℹ️  FTS5 table already exists, skipping FTS5 migration');
        db.close();
        resolve();
        return;
      }

      // Create FTS5 virtual table
      db.run(`
        CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
          id UNINDEXED,
          content,
          tags,
          context,
          content='knowledge',
          content_rowid='rowid'
        )
      `, (err) => {
        if (err) {
          console.error(`❌ Failed to create FTS5 table: ${err.message}`);
          db.close();
          reject(err);
          return;
        }

        console.log('✅ Created FTS5 virtual table');

        // Populate FTS5 table with existing data
        db.run(`
          INSERT INTO knowledge_fts(rowid, id, content, tags, context)
          SELECT rowid, id, content, tags, context FROM knowledge
        `, (err) => {
          if (err) {
            console.error(`❌ Failed to populate FTS5 table: ${err.message}`);
            db.close();
            reject(err);
            return;
          }

          console.log('✅ Populated FTS5 table with existing data');

          // Create triggers
          db.run(`
            CREATE TRIGGER IF NOT EXISTS knowledge_ai AFTER INSERT ON knowledge BEGIN
              INSERT INTO knowledge_fts(rowid, id, content, tags, context)
              VALUES (new.rowid, new.id, new.content, new.tags, new.context);
            END
          `, (err) => {
            if (err) console.error(`⚠️  Warning: Failed to create INSERT trigger: ${err.message}`);
          });

          db.run(`
            CREATE TRIGGER IF NOT EXISTS knowledge_ad AFTER DELETE ON knowledge BEGIN
              DELETE FROM knowledge_fts WHERE rowid = old.rowid;
            END
          `, (err) => {
            if (err) console.error(`⚠️  Warning: Failed to create DELETE trigger: ${err.message}`);
          });

          db.run(`
            CREATE TRIGGER IF NOT EXISTS knowledge_au AFTER UPDATE ON knowledge BEGIN
              UPDATE knowledge_fts SET content = new.content, tags = new.tags, context = new.context
              WHERE rowid = new.rowid;
            END
          `, (err) => {
            if (err) console.error(`⚠️  Warning: Failed to create UPDATE trigger: ${err.message}`);
          });

          console.log('✅ Created FTS5 sync triggers');

          // Create missing indexes
          db.run(`CREATE INDEX IF NOT EXISTS idx_updated_at ON knowledge(updated_at)`, (err) => {
            if (err) console.error(`⚠️  Warning: Index creation error: ${err.message}`);
          });
          
          db.run(`CREATE INDEX IF NOT EXISTS idx_scope ON knowledge(scope)`, (err) => {
            if (err) console.error(`⚠️  Warning: Scope index creation error: ${err.message}`);
          });

          // Run VACUUM to optimize
          db.run('VACUUM', (err) => {
            if (err) console.error(`⚠️  Warning: VACUUM error: ${err.message}`);
            
            // Get statistics
            db.get('SELECT COUNT(*) as count FROM knowledge', (err, result) => {
              if (!err && result) {
                console.log(`📊 Total entries: ${result.count}`);
              }
              
              console.log('✅ Migration complete!\n');
              db.close();
              resolve();
            });
          });
        });
      });
    });
  }

  async migrateAll() {
    if (!fs.existsSync(this.storageDir)) {
      console.log('ℹ️  No .copilot-memory directory found - will be created on first use');
      return;
    }

    const files = fs.readdirSync(this.storageDir);
    const dbFiles = files.filter(f => f.endsWith('.db'));

    if (dbFiles.length === 0) {
      console.log('ℹ️  No database files found - will be created on first use');
      console.log('\n📝 When you store knowledge, databases will be created with:');
      console.log('   • FTS5 full-text search enabled');
      console.log('   • Multi-scope support (project/user/global)');
      console.log('   • BM25 relevance ranking');
      console.log('   • Automatic sync triggers\n');
      return;
    }

    console.log(`🔍 Found ${dbFiles.length} database(s) to migrate`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const dbFile of dbFiles) {
      const dbPath = path.join(this.storageDir, dbFile);
      try {
        const result = await this.migrateDatabase(dbPath);
        if (result === 'skipped') {
          skipCount++;
        } else {
          successCount++;
        }
      } catch (error) {
        console.error(`❌ Failed to migrate ${dbFile}: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Migration Summary:');
    console.log(`   • Successfully migrated: ${successCount}`);
    console.log(`   • Already up-to-date: ${skipCount}`);
    console.log(`   • Errors: ${errorCount}`);
    console.log('\n📝 What changed:');
    console.log('   • Added FTS5 full-text search for better keyword matching');
    console.log('   • Added scope column for multi-scope support (v1.0.7+)');
    console.log('   • Multi-keyword searches now work properly');
    console.log('   • Results ranked by relevance (BM25 algorithm)');
    console.log('   • Faster searches with automatic triggers');
    console.log('\n🎯 Multi-Scope Support:');
    console.log('   • Project scope: {project-name}.db');
    console.log('   • User scope: user.db');
    console.log('   • Global scope: global.db');
    console.log('\n💡 Next Steps:');
    console.log('   1. Restart VS Code');
    console.log('   2. Try: "remember [user] my preference"');
    console.log('   3. Try: "remember [global] best practice"');
    console.log('   4. Try: "retrieve knowledge from all scopes"\n');
  }
}

// Main execution
async function main() {
  const migrator = new FTS5Migrator();
  await migrator.migrateAll();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { FTS5Migrator };
