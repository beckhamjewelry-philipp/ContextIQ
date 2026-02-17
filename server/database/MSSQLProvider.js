/**
 * MS SQL Server Database Provider
 *
 * External database for multi-instance deployments with scaling
 */

const sql = require('mssql');
const DatabaseProvider = require('./DatabaseProvider');

class MSSQLProvider extends DatabaseProvider {
  constructor(options = {}) {
    super();
    this.config = {
      server: options.server || process.env.MSSQL_SERVER || 'localhost',
      port: options.port || parseInt(process.env.MSSQL_PORT) || 1433,
      database: options.database || process.env.MSSQL_DATABASE || 'ContextIQ',
      user: options.user || process.env.MSSQL_USER,
      password: options.password || process.env.MSSQL_PASSWORD,
      options: {
        encrypt: options.encrypt !== false, // Use encryption by default
        trustServerCertificate: options.trustServerCertificate || false,
        enableArithAbort: true,
        ...options.options
      },
      pool: {
        max: options.poolMax || 10,
        min: options.poolMin || 0,
        idleTimeoutMillis: options.idleTimeout || 30000
      }
    };
    this.pool = null;
    this.transaction = null;
  }

  async connect() {
    try {
      this.pool = await sql.connect(this.config);
      console.log(`[MSSQL] Connected to ${this.config.server}/${this.config.database}`);
      return this;
    } catch (error) {
      console.error('[MSSQL] Connection failed:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
      console.log('[MSSQL] Disconnected');
    }
  }

  isConnected() {
    return this.pool !== null && this.pool.connected;
  }

  async execute(sqlText, params = []) {
    if (!this.pool) throw new Error('Database not connected');

    const request = this.transaction || this.pool.request();

    // Bind parameters
    params.forEach((param, index) => {
      request.input(`param${index}`, param);
    });

    // Replace ? placeholders with @param0, @param1, etc.
    let paramIndex = 0;
    const query = sqlText.replace(/\?/g, () => `@param${paramIndex++}`);

    const result = await request.query(query);
    return { changes: result.rowsAffected[0] || 0, lastID: result.recordset?.[0]?.id };
  }

  async query(sqlText, params = []) {
    if (!this.pool) throw new Error('Database not connected');

    const request = this.transaction || this.pool.request();

    // Bind parameters
    params.forEach((param, index) => {
      request.input(`param${index}`, param);
    });

    // Replace ? placeholders with @param0, @param1, etc.
    let paramIndex = 0;
    const query = sqlText.replace(/\?/g, () => `@param${paramIndex++}`);

    const result = await request.query(query);
    return result.recordset || [];
  }

  async queryOne(sqlText, params = []) {
    const results = await this.query(sqlText, params);
    return results[0] || null;
  }

  async beginTransaction() {
    if (!this.pool) throw new Error('Database not connected');
    this.transaction = new sql.Transaction(this.pool);
    await this.transaction.begin();
  }

  async commit() {
    if (!this.transaction) throw new Error('No active transaction');
    await this.transaction.commit();
    this.transaction = null;
  }

  async rollback() {
    if (!this.transaction) throw new Error('No active transaction');
    await this.transaction.rollback();
    this.transaction = null;
  }

  prepare(sqlText) {
    // MS SQL doesn't have the same prepared statement model
    // Return a wrapper that uses parameterized queries
    return {
      run: async (...params) => await this.execute(sqlText, params),
      all: async (...params) => await this.query(sqlText, params),
      get: async (...params) => await this.queryOne(sqlText, params)
    };
  }

  async initializeSchema() {
    if (!this.pool) throw new Error('Database not connected');

    console.log('[MSSQL] Initializing schema...');

    // Create tables with MS SQL syntax
    await this.pool.request().query(`
      -- Knowledge table
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='knowledge' AND xtype='U')
      CREATE TABLE knowledge (
        id NVARCHAR(255) PRIMARY KEY,
        content NVARCHAR(MAX) NOT NULL,
        tags NVARCHAR(MAX),
        metadata NVARCHAR(MAX),
        source NVARCHAR(500),
        context NVARCHAR(500),
        related_files NVARCHAR(MAX),
        related_symbols NVARCHAR(MAX),
        active_file NVARCHAR(500),
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      );

      -- Full-text catalog and index for knowledge (MS SQL full-text search)
      IF NOT EXISTS (SELECT * FROM sys.fulltext_catalogs WHERE name = 'knowledge_catalog')
      CREATE FULLTEXT CATALOG knowledge_catalog AS DEFAULT;

      IF NOT EXISTS (SELECT * FROM sys.fulltext_indexes WHERE object_id = OBJECT_ID('knowledge'))
      BEGIN
        IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('knowledge') AND name = 'PK_knowledge')
        ALTER TABLE knowledge ADD CONSTRAINT PK_knowledge PRIMARY KEY (id);

        CREATE FULLTEXT INDEX ON knowledge(content, tags, context)
        KEY INDEX PK_knowledge ON knowledge_catalog;
      END;

      -- Rules table
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='rules' AND xtype='U')
      CREATE TABLE rules (
        id NVARCHAR(255) PRIMARY KEY,
        title NVARCHAR(500) NOT NULL,
        content NVARCHAR(MAX) NOT NULL,
        category NVARCHAR(100),
        priority INT DEFAULT 0,
        enabled BIT DEFAULT 1,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      );

      -- Customers table
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='customers' AND xtype='U')
      CREATE TABLE customers (
        id NVARCHAR(255) PRIMARY KEY,
        name NVARCHAR(500) NOT NULL,
        email NVARCHAR(255),
        phone NVARCHAR(50),
        company NVARCHAR(500),
        status NVARCHAR(50) DEFAULT 'active',
        customer_since BIGINT NOT NULL,
        lifetime_value DECIMAL(18,2) DEFAULT 0,
        tags NVARCHAR(MAX),
        custom_fields NVARCHAR(MAX),
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
      CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);

      -- Customer events table
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='customer_events' AND xtype='U')
      CREATE TABLE customer_events (
        id NVARCHAR(255) PRIMARY KEY,
        customer_id NVARCHAR(255) NOT NULL,
        event_type NVARCHAR(100) NOT NULL,
        event_date BIGINT NOT NULL,
        title NVARCHAR(500),
        description NVARCHAR(MAX),
        amount DECIMAL(18,2),
        status NVARCHAR(50),
        metadata NVARCHAR(MAX),
        agent_notes NVARCHAR(MAX),
        related_events NVARCHAR(MAX),
        source_service NVARCHAR(100),
        raw_event_data NVARCHAR(MAX),
        created_at BIGINT NOT NULL,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_customer_events_customer ON customer_events(customer_id);
      CREATE INDEX IF NOT EXISTS idx_customer_events_type ON customer_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_customer_events_date ON customer_events(event_date);

      -- Purchases table
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='purchases' AND xtype='U')
      CREATE TABLE purchases (
        id NVARCHAR(255) PRIMARY KEY,
        customer_id NVARCHAR(255) NOT NULL,
        product_name NVARCHAR(500) NOT NULL,
        product_sku NVARCHAR(100),
        quantity INT DEFAULT 1,
        price DECIMAL(18,2),
        total DECIMAL(18,2),
        purchase_date BIGINT NOT NULL,
        warranty_expires BIGINT,
        metadata NVARCHAR(MAX),
        created_at BIGINT NOT NULL,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_purchases_customer ON purchases(customer_id);
      CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date);

      -- Work orders table
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='work_orders' AND xtype='U')
      CREATE TABLE work_orders (
        id NVARCHAR(255) PRIMARY KEY,
        customer_id NVARCHAR(255) NOT NULL,
        order_type NVARCHAR(100) NOT NULL,
        product_id NVARCHAR(255),
        issue_description NVARCHAR(MAX),
        resolution NVARCHAR(MAX),
        status NVARCHAR(50) DEFAULT 'open',
        priority NVARCHAR(50) DEFAULT 'medium',
        assigned_to NVARCHAR(255),
        created_date BIGINT NOT NULL,
        completed_date BIGINT,
        cost DECIMAL(18,2),
        metadata NVARCHAR(MAX),
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_work_orders_customer ON work_orders(customer_id);
      CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);

      -- Customer knowledge table
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='customer_knowledge' AND xtype='U')
      CREATE TABLE customer_knowledge (
        id NVARCHAR(255) PRIMARY KEY,
        customer_id NVARCHAR(255) NOT NULL,
        content NVARCHAR(MAX) NOT NULL,
        category NVARCHAR(100),
        importance NVARCHAR(50) DEFAULT 'medium',
        tags NVARCHAR(MAX),
        source NVARCHAR(100),
        related_event_id NVARCHAR(255),
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_customer_knowledge_customer ON customer_knowledge(customer_id);
      CREATE INDEX IF NOT EXISTS idx_customer_knowledge_importance ON customer_knowledge(importance);
    `);

    console.log('[MSSQL] Schema initialized');
  }

  async runMigrations() {
    console.log('[MSSQL] Running migrations...');

    // Create migrations table if it doesn't exist
    await this.pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='migrations' AND xtype='U')
      CREATE TABLE migrations (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(255) UNIQUE NOT NULL,
        executed_at DATETIME2 DEFAULT GETDATE()
      );
    `);

    // Add any missing columns (migration example)
    const migrations = [
      {
        name: '001_add_source_service',
        sql: `
          IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('customer_events') AND name = 'source_service')
          ALTER TABLE customer_events ADD source_service NVARCHAR(100);
        `
      }
    ];

    for (const migration of migrations) {
      const existing = await this.queryOne(
        'SELECT * FROM migrations WHERE name = ?',
        [migration.name]
      );

      if (!existing) {
        console.log(`[MSSQL] Running migration: ${migration.name}`);
        await this.pool.request().query(migration.sql);
        await this.execute('INSERT INTO migrations (name) VALUES (?)', [migration.name]);
      }
    }

    console.log('[MSSQL] Migrations complete');
  }
}

module.exports = MSSQLProvider;
