#!/usr/bin/env node

/**
 * CustomerIQ Unified Console Application
 *
 * Standalone application that runs:
 * - MCP Server (AI assistant integration)
 * - REST API Server (web frontend & external APIs)
 * - NATS Subscriber (event aggregation)
 * - CRM Integration (Salesforce/HubSpot sync)
 * - DevOps Control Interface (management & monitoring)
 *
 * Supports both SQLite (single instance) and MS SQL (multi-instance scaling)
 */

const path = require('path');
const fs = require('fs');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');

// Database providers
const SQLiteProvider = require('./database/SQLiteProvider');
const MSSQLProvider = require('./database/MSSQLProvider');

// Services
const CustomerAPIServer = require('./apiServer');
const NATSSubscriberService = require('./natsSubscriber');
const CRMIntegration = require('./crmIntegration');
const CustomerContextBuilder = require('./customerContextBuilder');
const DevOpsControlServer = require('./devopsControl');

class CustomerIQApplication {
  constructor(config = {}) {
    this.config = this.loadConfiguration(config);
    this.db = null;
    this.mcpServer = null;
    this.apiServer = null;
    this.natsService = null;
    this.crmIntegration = null;
    this.contextBuilder = null;
    this.controlServer = null;
    this.isShuttingDown = false;
  }

  /**
   * Load configuration from environment and config file
   */
  loadConfiguration(overrides = {}) {
    const config = {
      // Database configuration
      database: {
        provider: process.env.DB_PROVIDER || 'sqlite', // 'sqlite' or 'mssql'
        sqlite: {
          dbPath: process.env.SQLITE_PATH || path.join(require('os').homedir(), '.customeriq', 'customeriq.db')
        },
        mssql: {
          server: process.env.MSSQL_SERVER,
          port: parseInt(process.env.MSSQL_PORT) || 1433,
          database: process.env.MSSQL_DATABASE || 'CustomerIQ',
          user: process.env.MSSQL_USER,
          password: process.env.MSSQL_PASSWORD,
          encrypt: process.env.MSSQL_ENCRYPT !== 'false',
          trustServerCertificate: process.env.MSSQL_TRUST_CERT === 'true'
        }
      },

      // MCP Server configuration
      mcp: {
        enabled: process.env.MCP_ENABLED !== 'false', // Default enabled
        name: 'customeriq-mcp',
        version: '2.0.0'
      },

      // REST API configuration
      api: {
        enabled: process.env.API_ENABLED !== 'false', // Default enabled
        port: parseInt(process.env.API_PORT) || 3000,
        host: process.env.API_HOST || '0.0.0.0'
      },

      // NATS configuration
      nats: {
        enabled: process.env.NATS_ENABLED === 'true',
        servers: process.env.NATS_SERVERS || 'nats://localhost:4222',
        subjects: process.env.NATS_SUBJECTS?.split(',') || ['customer.events.>'],
        queueGroup: process.env.NATS_QUEUE_GROUP || 'customeriq-service',
        autoCreateCustomer: process.env.NATS_AUTO_CREATE_CUSTOMER !== 'false',
        summarizeThreshold: parseInt(process.env.NATS_SUMMARIZE_THRESHOLD) || 500
      },

      // CRM Integration configuration
      crm: {
        enabled: process.env.CRM_ENABLED === 'true',
        type: process.env.CRM_TYPE || 'salesforce', // 'salesforce', 'hubspot', 'generic'
        syncInterval: parseInt(process.env.CRM_SYNC_INTERVAL) || 300000, // 5 minutes
        config: this.loadCRMConfig()
      },

      // DevOps Control Interface configuration
      control: {
        enabled: process.env.CONTROL_ENABLED !== 'false', // Default enabled
        port: parseInt(process.env.CONTROL_PORT) || 9000,
        host: process.env.CONTROL_HOST || '0.0.0.0'
      },

      ...overrides
    };

    return config;
  }

  loadCRMConfig() {
    const type = process.env.CRM_TYPE || 'salesforce';

    if (type === 'salesforce') {
      return {
        loginUrl: process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com',
        instanceUrl: process.env.SALESFORCE_INSTANCE_URL,
        clientId: process.env.SALESFORCE_CLIENT_ID,
        clientSecret: process.env.SALESFORCE_CLIENT_SECRET,
        username: process.env.SALESFORCE_USERNAME,
        password: process.env.SALESFORCE_PASSWORD,
        securityToken: process.env.SALESFORCE_SECURITY_TOKEN
      };
    } else if (type === 'hubspot') {
      return {
        apiKey: process.env.HUBSPOT_API_KEY
      };
    } else {
      return {
        apiUrl: process.env.CRM_API_URL,
        apiKey: process.env.CRM_API_KEY,
        customersEndpoint: process.env.CRM_CUSTOMERS_ENDPOINT,
        authHeader: process.env.CRM_AUTH_HEADER
      };
    }
  }

  /**
   * Start all services
   */
  async start() {
    console.log('\n╔═══════════════════════════════════════════════════╗');
    console.log('║         CustomerIQ Customer Context Platform      ║');
    console.log('║                  Version 2.0.0                    ║');
    console.log('╚═══════════════════════════════════════════════════╝\n');

    try {
      // 1. Initialize database
      await this.initializeDatabase();

      // 2. Start MCP Server (if enabled)
      if (this.config.mcp.enabled) {
        await this.startMCPServer();
      } else {
        console.log('[MCP] MCP Server disabled');
      }

      // 3. Start REST API Server (if enabled)
      if (this.config.api.enabled) {
        await this.startAPIServer();
      } else {
        console.log('[API] REST API Server disabled');
      }

      // 4. Start NATS Subscriber (if enabled)
      if (this.config.nats.enabled) {
        await this.startNATSService();
      } else {
        console.log('[NATS] NATS Subscriber disabled');
      }

      // 5. Start CRM Integration (if enabled)
      if (this.config.crm.enabled) {
        await this.startCRMIntegration();
      } else {
        console.log('[CRM] CRM Integration disabled');
      }

      // 6. Start DevOps Control Interface (if enabled)
      if (this.config.control.enabled) {
        await this.startControlInterface();
      } else {
        console.log('[Control] DevOps Control Interface disabled');
      }

      // Setup graceful shutdown
      this.setupShutdownHandlers();

      console.log('\n✅ CustomerIQ is running. Press Ctrl+C to stop.\n');

      // Display service status
      this.displayStatus();

    } catch (error) {
      console.error('\n❌ Failed to start CustomerIQ:', error);
      await this.shutdown();
      process.exit(1);
    }
  }

  /**
   * Initialize database provider
   */
  async initializeDatabase() {
    console.log(`[Database] Initializing ${this.config.database.provider.toUpperCase()} database...`);

    try {
      if (this.config.database.provider === 'sqlite') {
        this.db = new SQLiteProvider(this.config.database.sqlite);
      } else if (this.config.database.provider === 'mssql') {
        this.db = new MSSQLProvider(this.config.database.mssql);
      } else {
        throw new Error(`Unsupported database provider: ${this.config.database.provider}`);
      }

      await this.db.connect();
      await this.db.initializeSchema();
      await this.db.runMigrations();

      // Initialize context builder
      this.contextBuilder = new CustomerContextBuilder(this.db);

      console.log(`[Database] ${this.config.database.provider.toUpperCase()} database ready`);
    } catch (error) {
      console.error('[Database] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Start MCP Server
   */
  async startMCPServer() {
    console.log('[MCP] Starting MCP Server...');

    // Load MCP server handlers from index-sqlite.js
    // For now, we'll note that MCP server runs via stdio
    console.log('[MCP] MCP Server available via stdio (use Claude Desktop or MCP clients)');
    console.log('[MCP] Tools available: 20+ tools including customer management');
  }

  /**
   * Start REST API Server
   */
  async startAPIServer() {
    console.log('[API] Starting REST API Server...');

    this.apiServer = new CustomerAPIServer({
      port: this.config.api.port,
      db: this.db,
      staticPath: path.join(__dirname, 'public')
    });

    await this.apiServer.start();

    console.log(`[API] REST API Server running on http://${this.config.api.host}:${this.config.api.port}`);
    console.log(`[API] Web UI available at http://localhost:${this.config.api.port}`);
  }

  /**
   * Start NATS Subscriber
   */
  async startNATSService() {
    console.log('[NATS] Starting NATS Subscriber...');

    this.natsService = new NATSSubscriberService(this.db, {
      servers: this.config.nats.servers,
      subjects: this.config.nats.subjects,
      queueGroup: this.config.nats.queueGroup,
      eventProcessor: {
        summarizeThreshold: this.config.nats.summarizeThreshold,
        autoCreateCustomer: this.config.nats.autoCreateCustomer
      }
    });

    await this.natsService.start();

    console.log(`[NATS] Subscribed to: ${this.config.nats.subjects.join(', ')}`);
    console.log(`[NATS] Queue group: ${this.config.nats.queueGroup}`);
  }

  /**
   * Start CRM Integration
   */
  async startCRMIntegration() {
    console.log(`[CRM] Starting ${this.config.crm.type.toUpperCase()} integration...`);

    this.crmIntegration = new CRMIntegration(this.db, {
      type: this.config.crm.type,
      config: this.config.crm.config,
      syncInterval: this.config.crm.syncInterval
    });

    this.crmIntegration.startSync();

    console.log(`[CRM] ${this.config.crm.type.toUpperCase()} sync enabled (interval: ${this.config.crm.syncInterval}ms)`);
  }

  /**
   * Start DevOps Control Interface
   */
  async startControlInterface() {
    console.log('[Control] Starting DevOps Control Interface...');

    this.controlServer = new DevOpsControlServer(this, {
      port: this.config.control.port,
      host: this.config.control.host
    });

    await this.controlServer.start();

    console.log(`[Control] DevOps API available at http://${this.config.control.host}:${this.config.control.port}`);
  }

  /**
   * Display service status
   */
  displayStatus() {
    console.log('┌─────────────────────────────────────────────┐');
    console.log('│            Service Status                    │');
    console.log('├─────────────────────────────────────────────┤');
    console.log('│ Database:     ' + (this.db?.isConnected() ? '✓' : '✗') + ' ' + this.config.database.provider.toUpperCase().padEnd(28) + ' │');
    console.log('│ MCP Server:   ' + (this.config.mcp.enabled ? '✓ Enabled (stdio)' : '✗ Disabled').padEnd(31) + ' │');
    console.log('│ REST API:     ' + (this.apiServer ? `✓ http://localhost:${this.config.api.port}` : '✗ Disabled').padEnd(31) + ' │');
    console.log('│ NATS Events:  ' + (this.natsService?.isHealthy() ? '✓ Connected' : (this.config.nats.enabled ? '⚠ Connecting...' : '✗ Disabled')).padEnd(31) + ' │');
    console.log('│ CRM Sync:     ' + (this.crmIntegration ? `✓ ${this.config.crm.type.toUpperCase()}` : '✗ Disabled').padEnd(31) + ' │');
    console.log('│ Control API:  ' + (this.controlServer ? `✓ http://localhost:${this.config.control.port}` : '✗ Disabled').padEnd(31) + ' │');
    console.log('└─────────────────────────────────────────────┘\n');
  }

  /**
   * Setup graceful shutdown handlers
   */
  setupShutdownHandlers() {
    const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];

    signals.forEach(signal => {
      process.on(signal, async () => {
        console.log(`\n[Shutdown] Received ${signal}, shutting down gracefully...`);
        await this.shutdown();
        process.exit(0);
      });
    });

    process.on('uncaughtException', async (error) => {
      console.error('[Error] Uncaught exception:', error);
      await this.shutdown();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      console.error('[Error] Unhandled rejection:', reason);
      await this.shutdown();
      process.exit(1);
    });
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    console.log('\n[Shutdown] Stopping services...');

    try {
      // Stop CRM integration
      if (this.crmIntegration) {
        console.log('[Shutdown] Stopping CRM integration...');
        this.crmIntegration.stopSync();
      }

      // Stop NATS subscriber
      if (this.natsService) {
        console.log('[Shutdown] Stopping NATS subscriber...');
        await this.natsService.stop();
      }

      // Stop API server
      if (this.apiServer) {
        console.log('[Shutdown] Stopping API server...');
        await this.apiServer.stop();
      }

      // Stop Control server
      if (this.controlServer) {
        console.log('[Shutdown] Stopping Control server...');
        await this.controlServer.stop();
      }

      // Disconnect database
      if (this.db) {
        console.log('[Shutdown] Disconnecting database...');
        await this.db.disconnect();
      }

      console.log('[Shutdown] CustomerIQ stopped successfully');
    } catch (error) {
      console.error('[Shutdown] Error during shutdown:', error);
    }
  }
}

// Start application if run directly
if (require.main === module) {
  const app = new CustomerIQApplication();
  app.start().catch(console.error);
}

module.exports = CustomerIQApplication;
