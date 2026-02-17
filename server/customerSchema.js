/**
 * Customer Profile Database Schema
 *
 * This module defines the database schema for customer profiles,
 * events, purchases, work orders, and customer-specific memories.
 */

const CUSTOMER_SCHEMA = `
  -- Main customer profile table
  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    company TEXT,
    status TEXT DEFAULT 'active',
    customer_since INTEGER NOT NULL,
    lifetime_value REAL DEFAULT 0,
    tags TEXT,
    custom_fields TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
  CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
  CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at);

  -- Customer interactions/events timeline
  CREATE TABLE IF NOT EXISTS customer_events (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_date INTEGER NOT NULL,
    title TEXT,
    description TEXT,
    amount REAL,
    status TEXT,
    metadata TEXT,
    agent_notes TEXT,
    related_events TEXT,
    source_service TEXT,
    raw_event_data TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_customer_events_customer_id ON customer_events(customer_id);
  CREATE INDEX IF NOT EXISTS idx_customer_events_type ON customer_events(event_type);
  CREATE INDEX IF NOT EXISTS idx_customer_events_date ON customer_events(event_date);
  CREATE INDEX IF NOT EXISTS idx_customer_events_source ON customer_events(source_service);

  -- Purchases history
  CREATE TABLE IF NOT EXISTS purchases (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    product_sku TEXT,
    quantity INTEGER DEFAULT 1,
    price REAL,
    total REAL,
    purchase_date INTEGER NOT NULL,
    warranty_expires INTEGER,
    metadata TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_purchases_customer_id ON purchases(customer_id);
  CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date);
  CREATE INDEX IF NOT EXISTS idx_purchases_sku ON purchases(product_sku);

  -- Work orders / repairs / service requests
  CREATE TABLE IF NOT EXISTS work_orders (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    order_type TEXT NOT NULL,
    product_id TEXT,
    issue_description TEXT,
    resolution TEXT,
    status TEXT DEFAULT 'open',
    priority TEXT DEFAULT 'medium',
    assigned_to TEXT,
    created_date INTEGER NOT NULL,
    completed_date INTEGER,
    cost REAL,
    metadata TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_work_orders_customer_id ON work_orders(customer_id);
  CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
  CREATE INDEX IF NOT EXISTS idx_work_orders_type ON work_orders(order_type);
  CREATE INDEX IF NOT EXISTS idx_work_orders_created_date ON work_orders(created_date);

  -- Customer relationship notes/memories
  CREATE TABLE IF NOT EXISTS customer_knowledge (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT,
    importance TEXT DEFAULT 'medium',
    tags TEXT,
    source TEXT,
    related_event_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_customer_knowledge_customer_id ON customer_knowledge(customer_id);
  CREATE INDEX IF NOT EXISTS idx_customer_knowledge_category ON customer_knowledge(category);
  CREATE INDEX IF NOT EXISTS idx_customer_knowledge_importance ON customer_knowledge(importance);

  -- FTS5 tables for fast searching
  CREATE VIRTUAL TABLE IF NOT EXISTS customers_fts USING fts5(
    name, email, phone, company, tags, custom_fields,
    content='customers', content_rowid='rowid'
  );

  CREATE VIRTUAL TABLE IF NOT EXISTS customer_knowledge_fts USING fts5(
    content, category, tags,
    content='customer_knowledge', content_rowid='rowid'
  );

  CREATE VIRTUAL TABLE IF NOT EXISTS customer_events_fts USING fts5(
    title, description, agent_notes,
    content='customer_events', content_rowid='rowid'
  );

  -- Triggers to keep FTS5 in sync
  CREATE TRIGGER IF NOT EXISTS customers_ai AFTER INSERT ON customers BEGIN
    INSERT INTO customers_fts(rowid, name, email, phone, company, tags, custom_fields)
    VALUES (new.rowid, new.name, new.email, new.phone, new.company, new.tags, new.custom_fields);
  END;

  CREATE TRIGGER IF NOT EXISTS customers_ad AFTER DELETE ON customers BEGIN
    INSERT INTO customers_fts(customers_fts, rowid, name, email, phone, company, tags, custom_fields)
    VALUES('delete', old.rowid, old.name, old.email, old.phone, old.company, old.tags, old.custom_fields);
  END;

  CREATE TRIGGER IF NOT EXISTS customers_au AFTER UPDATE ON customers BEGIN
    INSERT INTO customers_fts(customers_fts, rowid, name, email, phone, company, tags, custom_fields)
    VALUES('delete', old.rowid, old.name, old.email, old.phone, old.company, old.tags, old.custom_fields);
    INSERT INTO customers_fts(rowid, name, email, phone, company, tags, custom_fields)
    VALUES (new.rowid, new.name, new.email, new.phone, new.company, new.tags, new.custom_fields);
  END;

  CREATE TRIGGER IF NOT EXISTS customer_knowledge_ai AFTER INSERT ON customer_knowledge BEGIN
    INSERT INTO customer_knowledge_fts(rowid, content, category, tags)
    VALUES (new.rowid, new.content, new.category, new.tags);
  END;

  CREATE TRIGGER IF NOT EXISTS customer_knowledge_ad AFTER DELETE ON customer_knowledge BEGIN
    INSERT INTO customer_knowledge_fts(customer_knowledge_fts, rowid, content, category, tags)
    VALUES('delete', old.rowid, old.content, old.category, old.tags);
  END;

  CREATE TRIGGER IF NOT EXISTS customer_knowledge_au AFTER UPDATE ON customer_knowledge BEGIN
    INSERT INTO customer_knowledge_fts(customer_knowledge_fts, rowid, content, category, tags)
    VALUES('delete', old.rowid, old.content, old.category, old.tags);
    INSERT INTO customer_knowledge_fts(rowid, content, category, tags)
    VALUES (new.rowid, new.content, new.category, new.tags);
  END;

  CREATE TRIGGER IF NOT EXISTS customer_events_ai AFTER INSERT ON customer_events BEGIN
    INSERT INTO customer_events_fts(rowid, title, description, agent_notes)
    VALUES (new.rowid, new.title, new.description, new.agent_notes);
  END;

  CREATE TRIGGER IF NOT EXISTS customer_events_ad AFTER DELETE ON customer_events BEGIN
    INSERT INTO customer_events_fts(customer_events_fts, rowid, title, description, agent_notes)
    VALUES('delete', old.rowid, old.title, old.description, old.agent_notes);
  END;

  CREATE TRIGGER IF NOT EXISTS customer_events_au AFTER UPDATE ON customer_events BEGIN
    INSERT INTO customer_events_fts(customer_events_fts, rowid, title, description, agent_notes)
    VALUES('delete', old.rowid, old.title, old.description, old.agent_notes);
    INSERT INTO customer_events_fts(rowid, title, description, agent_notes)
    VALUES (new.rowid, new.title, new.description, new.agent_notes);
  END;
`;

/**
 * Initialize customer tables in the database
 * @param {Database} db - better-sqlite3 database instance
 */
function initializeCustomerSchema(db) {
  try {
    db.exec(CUSTOMER_SCHEMA);
    console.log('[CustomerSchema] Customer tables initialized successfully');
  } catch (error) {
    console.error('[CustomerSchema] Error initializing customer tables:', error);
    throw error;
  }
}

module.exports = {
  CUSTOMER_SCHEMA,
  initializeCustomerSchema
};
