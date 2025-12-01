#!/usr/bin/env node
// Inserts example design system rules into the global Copilot Memory DB
// Usage: node insert_design_rules.js

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const fs = require('fs');

const storageDir = path.join(os.homedir(), '.copilot-memory');
if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });
const dbPath = path.join(storageDir, 'global.db'); // Use global scope for rules

const db = new Database(dbPath);

function now() { return Math.floor(Date.now() / 1000); }
function genId(prefix = '') { return prefix + Math.random().toString(36).slice(2, 12); }

// Ensure rules table exists (defensive)
db.exec(`
CREATE TABLE IF NOT EXISTS rules (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  priority INTEGER DEFAULT 0,
  enabled INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`);

const insert = db.prepare(`INSERT OR REPLACE INTO rules (id, title, content, category, priority, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

const rules = [
  {
    title: 'Design Tokens Usage',
    content: 'All colors, spacing, typography and elevation must use design tokens from the shared token library (tokens/*) and not hard-coded values. Tokens should be referenced by semantic names (e.g., color.primary, spacing.md).',
    category: 'architecture',
    priority: 9
  },
  {
    title: 'Component Naming Prefix',
    content: 'All design system components must be prefixed with "DS" (e.g., DSButton, DSCard) and exported from the index file. Avoid generic names to prevent collisions with app-level components.',
    category: 'code-style',
    priority: 7
  },
  {
    title: 'Accessibility Requirements',
    content: 'All components must meet WCAG AA contrast ratios, expose ARIA attributes for interactive elements, and pass keyboard navigation tests. Include accessibility notes in component docs.',
    category: 'testing',
    priority: 10
  }
];

for (const r of rules) {
  const id = genId('rule_');
  const ts = now();
  insert.run(id, r.title, r.content, r.category, r.priority, 1, ts, ts);
  console.log('Inserted rule:', id, r.title);
}

// List rules to verify
const rows = db.prepare('SELECT id, title, category, priority, enabled, created_at FROM rules ORDER BY priority DESC').all();
console.log('\nCurrent rules in DB:');
for (const row of rows) {
  console.log('-', row.id, row.title, `(category:${row.category} priority:${row.priority} enabled:${row.enabled})`);
}

db.close();
