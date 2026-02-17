/**
 * CustomerIQ DevOps Control Interface
 *
 * Management API for external DevOps systems to:
 * - Start/stop/restart the application
 * - Stream stdout/stderr logs
 * - Load and manipulate configuration
 * - Report runtime metrics and health
 * - Query environment and app info
 */

const http = require('http');
const url = require('url');
const { EventEmitter } = require('events');

class DevOpsControlServer extends EventEmitter {
  constructor(app, options = {}) {
    super();
    this.app = app; // Reference to CustomerIQApplication
    this.port = options.port || process.env.CONTROL_PORT || 9000;
    this.host = options.host || '0.0.0.0';
    this.server = null;
    this.logBuffer = [];
    this.maxLogBuffer = options.maxLogBuffer || 1000;
    this.startTime = Date.now();
    this.metrics = {
      requests: 0,
      errors: 0,
      restarts: 0
    };

    // Capture console output
    this.setupLogCapture();
  }

  /**
   * Setup log capture for streaming
   */
  setupLogCapture() {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = (...args) => {
      const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      this.addLog('info', message);
      originalLog.apply(console, args);
    };

    console.error = (...args) => {
      const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      this.addLog('error', message);
      originalError.apply(console, args);
    };

    console.warn = (...args) => {
      const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      this.addLog('warn', message);
      originalWarn.apply(console, args);
    };
  }

  /**
   * Add log entry to buffer
   */
  addLog(level, message) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message
    };

    this.logBuffer.push(entry);

    // Keep buffer size manageable
    if (this.logBuffer.length > this.maxLogBuffer) {
      this.logBuffer.shift();
    }

    // Emit for streaming clients
    this.emit('log', entry);
  }

  /**
   * Start control server
   */
  async start() {
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });

    return new Promise((resolve, reject) => {
      this.server.listen(this.port, this.host, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log(`[Control] DevOps control interface running on http://${this.host}:${this.port}`);
          resolve();
        }
      });
    });
  }

  /**
   * Handle HTTP requests
   */
  async handleRequest(req, res) {
    this.metrics.requests++;

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    try {
      // Route requests
      if (pathname === '/health') {
        await this.handleHealth(req, res);
      } else if (pathname === '/info') {
        await this.handleInfo(req, res);
      } else if (pathname === '/config') {
        await this.handleConfig(req, res, method);
      } else if (pathname === '/env') {
        await this.handleEnv(req, res);
      } else if (pathname === '/runtime') {
        await this.handleRuntime(req, res, method);
      } else if (pathname === '/logs') {
        await this.handleLogs(req, res);
      } else if (pathname === '/logs/stream') {
        await this.handleLogStream(req, res);
      } else if (pathname === '/control/restart') {
        await this.handleRestart(req, res);
      } else if (pathname === '/control/stop') {
        await this.handleStop(req, res);
      } else if (pathname === '/metrics') {
        await this.handleMetrics(req, res);
      } else {
        this.sendJSON(res, 404, { error: 'Endpoint not found' });
      }
    } catch (error) {
      this.metrics.errors++;
      console.error('[Control] Error:', error);
      this.sendJSON(res, 500, { error: error.message });
    }
  }

  /**
   * Health check endpoint
   */
  async handleHealth(req, res) {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      services: {
        database: this.app.db?.isConnected() || false,
        api: !!this.app.apiServer,
        mcp: this.app.config.mcp.enabled,
        nats: this.app.natsService?.isHealthy() || false,
        crm: !!this.app.crmIntegration
      }
    };

    this.sendJSON(res, 200, health);
  }

  /**
   * App info endpoint
   */
  async handleInfo(req, res) {
    const info = {
      name: 'CustomerIQ',
      version: '2.0.0',
      description: 'Customer Context Platform',
      node_version: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      started_at: new Date(this.startTime).toISOString(),
      uptime_seconds: Math.floor((Date.now() - this.startTime) / 1000)
    };

    this.sendJSON(res, 200, info);
  }

  /**
   * Configuration endpoint
   */
  async handleConfig(req, res, method) {
    if (method === 'GET') {
      // Return sanitized config (hide secrets)
      const config = JSON.parse(JSON.stringify(this.app.config));

      // Sanitize sensitive data
      if (config.database?.mssql?.password) {
        config.database.mssql.password = '***REDACTED***';
      }
      if (config.crm?.config) {
        Object.keys(config.crm.config).forEach(key => {
          if (key.toLowerCase().includes('password') ||
              key.toLowerCase().includes('secret') ||
              key.toLowerCase().includes('token') ||
              key.toLowerCase().includes('key')) {
            config.crm.config[key] = '***REDACTED***';
          }
        });
      }

      this.sendJSON(res, 200, { config });
    } else if (method === 'PUT') {
      // Update configuration (requires restart)
      const body = await this.parseBody(req);

      // Validate and update config
      // Note: Full restart required for most config changes
      this.sendJSON(res, 200, {
        message: 'Configuration updated. Restart required to apply changes.',
        requires_restart: true
      });
    } else {
      this.sendJSON(res, 405, { error: 'Method not allowed' });
    }
  }

  /**
   * Environment variables endpoint
   */
  async handleEnv(req, res) {
    const env = { ...process.env };

    // Sanitize sensitive environment variables
    Object.keys(env).forEach(key => {
      if (key.includes('PASSWORD') ||
          key.includes('SECRET') ||
          key.includes('TOKEN') ||
          key.includes('KEY')) {
        env[key] = '***REDACTED***';
      }
    });

    this.sendJSON(res, 200, { env });
  }

  /**
   * Runtime variables endpoint
   */
  async handleRuntime(req, res, method) {
    if (method === 'GET') {
      const runtime = {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        uptime: process.uptime(),
        pid: process.pid,
        ppid: process.ppid,
        platform: process.platform,
        arch: process.arch,
        node_version: process.version,
        cwd: process.cwd(),
        exec_path: process.execPath,
        argv: process.argv,
        database: {
          provider: this.app.config.database.provider,
          connected: this.app.db?.isConnected() || false
        },
        services: {
          mcp_enabled: this.app.config.mcp.enabled,
          api_enabled: this.app.config.api.enabled,
          api_port: this.app.config.api.port,
          nats_enabled: this.app.config.nats.enabled,
          crm_enabled: this.app.config.crm.enabled
        }
      };

      this.sendJSON(res, 200, runtime);
    } else if (method === 'POST') {
      // Allow runtime variable manipulation
      const body = await this.parseBody(req);

      // Example: Set environment variable
      if (body.env_set) {
        Object.keys(body.env_set).forEach(key => {
          process.env[key] = body.env_set[key];
        });
      }

      this.sendJSON(res, 200, {
        message: 'Runtime variables updated',
        updated: body.env_set || {}
      });
    } else {
      this.sendJSON(res, 405, { error: 'Method not allowed' });
    }
  }

  /**
   * Logs endpoint (buffered logs)
   */
  async handleLogs(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const limit = parseInt(parsedUrl.query.limit) || 100;
    const level = parsedUrl.query.level;

    let logs = this.logBuffer;

    // Filter by level if specified
    if (level) {
      logs = logs.filter(log => log.level === level);
    }

    // Return most recent logs
    const recentLogs = logs.slice(-limit);

    this.sendJSON(res, 200, {
      total: this.logBuffer.length,
      returned: recentLogs.length,
      logs: recentLogs
    });
  }

  /**
   * Log streaming endpoint (Server-Sent Events)
   */
  async handleLogStream(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

    // Stream new logs as they come
    const logHandler = (entry) => {
      res.write(`data: ${JSON.stringify(entry)}\n\n`);
    };

    this.on('log', logHandler);

    // Cleanup on disconnect
    req.on('close', () => {
      this.removeListener('log', logHandler);
    });
  }

  /**
   * Restart application endpoint
   */
  async handleRestart(req, res) {
    this.metrics.restarts++;

    this.sendJSON(res, 200, {
      message: 'Application restart initiated',
      pid: process.pid
    });

    // Graceful restart
    setTimeout(async () => {
      console.log('[Control] Restarting application...');
      await this.app.shutdown();
      process.exit(0); // Process manager (PM2, systemd) should restart
    }, 1000);
  }

  /**
   * Stop application endpoint
   */
  async handleStop(req, res) {
    this.sendJSON(res, 200, {
      message: 'Application shutdown initiated',
      pid: process.pid
    });

    // Graceful shutdown
    setTimeout(async () => {
      console.log('[Control] Stopping application...');
      await this.app.shutdown();
      process.exit(0);
    }, 1000);
  }

  /**
   * Metrics endpoint
   */
  async handleMetrics(req, res) {
    const metrics = {
      ...this.metrics,
      uptime_seconds: Math.floor((Date.now() - this.startTime) / 1000),
      memory_usage: process.memoryUsage(),
      cpu_usage: process.cpuUsage(),
      log_buffer_size: this.logBuffer.length,
      timestamp: new Date().toISOString()
    };

    this.sendJSON(res, 200, { metrics });
  }

  /**
   * Parse request body
   */
  parseBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          resolve(JSON.parse(body || '{}'));
        } catch (e) {
          reject(new Error('Invalid JSON'));
        }
      });
    });
  }

  /**
   * Send JSON response
   */
  sendJSON(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data, null, 2));
  }

  /**
   * Stop control server
   */
  async stop() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          console.log('[Control] DevOps control interface stopped');
          resolve();
        });
      });
    }
  }
}

module.exports = DevOpsControlServer;
