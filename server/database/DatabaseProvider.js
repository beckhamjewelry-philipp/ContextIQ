/**
 * Database Provider Interface
 *
 * Abstraction layer supporting both SQLite and MS SQL Server
 */

class DatabaseProvider {
  constructor() {
    if (this.constructor === DatabaseProvider) {
      throw new Error('DatabaseProvider is abstract and cannot be instantiated directly');
    }
  }

  // Connection management
  async connect() { throw new Error('Must implement connect()'); }
  async disconnect() { throw new Error('Must implement disconnect()'); }
  isConnected() { throw new Error('Must implement isConnected()'); }

  // Query execution
  execute(sql, params = []) { throw new Error('Must implement execute()'); }
  query(sql, params = []) { throw new Error('Must implement query()'); }
  queryOne(sql, params = []) { throw new Error('Must implement queryOne()'); }

  // Transaction support
  async beginTransaction() { throw new Error('Must implement beginTransaction()'); }
  async commit() { throw new Error('Must implement commit()'); }
  async rollback() { throw new Error('Must implement rollback()'); }

  // Schema management
  async initializeSchema() { throw new Error('Must implement initializeSchema()'); }
  async runMigrations() { throw new Error('Must implement runMigrations()'); }

  // Prepared statements (optional optimization)
  prepare(sql) { throw new Error('Must implement prepare()'); }
}

module.exports = DatabaseProvider;
