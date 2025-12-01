#!/usr/bin/env node

/**
 * Test FTS5 search improvements
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');

const dbPath = path.join(os.homedir(), '.copilot-memory', 'server.db');

console.log(`📊 Testing FTS5 search on: ${path.basename(dbPath)}\n`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Failed to open database:', err.message);
    process.exit(1);
  }

  const testQueries = [
    'DHA',
    'TypeScript MCP',
    'remember retrieve',
    'SQLite database',
    'VSCode extension',
    'ByteRover knowledge'
  ];

  console.log('🔍 Testing search queries:\n');

  let queryIndex = 0;

  function runNextQuery() {
    if (queryIndex >= testQueries.length) {
      db.close();
      console.log('\n✅ All tests complete!');
      return;
    }

    const query = testQueries[queryIndex++];
    const keywords = query.trim().split(/\s+/).filter(k => k.length > 0);
    const ftsQuery = keywords.map(k => `"${k.replace(/"/g, '""')}"`).join(' OR ');

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Query: "${query}"`);
    console.log(`FTS Query: ${ftsQuery}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    const sql = `
      SELECT 
        k.id,
        k.context,
        SUBSTR(k.content, 1, 100) as preview,
        bm25(knowledge_fts) as rank
      FROM knowledge k
      INNER JOIN knowledge_fts ON k.rowid = knowledge_fts.rowid
      WHERE knowledge_fts MATCH ?
      ORDER BY rank, k.updated_at DESC
      LIMIT 5
    `;

    db.all(sql, [ftsQuery], (err, rows) => {
      if (err) {
        console.error('❌ Search error:', err.message);
      } else if (rows.length === 0) {
        console.log('❌ No results found');
      } else {
        console.log(`✅ Found ${rows.length} results:\n`);
        rows.forEach((row, i) => {
          console.log(`${i + 1}. ${row.context || 'Knowledge'} (rank: ${row.rank.toFixed(2)})`);
          console.log(`   ${row.preview}...`);
          console.log(`   ID: ${row.id}\n`);
        });
      }

      // Run next query
      setTimeout(runNextQuery, 100);
    });
  }

  runNextQuery();
});
