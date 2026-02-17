/**
 * REST API Server for CustomerIQ Customer Management
 *
 * Provides HTTP endpoints for web frontends and external integrations.
 */

const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');
const CustomerContextBuilder = require('./customerContextBuilder');
const EventProcessor = require('./eventProcessor');

class CustomerAPIServer {
  constructor(options = {}) {
    this.port = options.port || process.env.API_PORT || 3000;
    this.staticPath = options.staticPath || path.join(__dirname, 'public');
    this.db = options.db; // Database provider instance (SQLite or MS SQL)
    this.contextBuilder = null;
    this.eventProcessor = null;
    this.server = null;

    if (!this.db) {
      throw new Error('Database provider is required');
    }
  }

  async start() {
    // Initialize context builder and event processor
    this.contextBuilder = new CustomerContextBuilder(this.db);
    this.eventProcessor = new EventProcessor(this.db);

    // Create HTTP server
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });

    // Start server
    this.server.listen(this.port, () => {
      console.log(`[API] REST API server running on http://localhost:${this.port}`);
    });
  }

  async handleRequest(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    try {
      // API Routes
      if (pathname.startsWith('/api/')) {
        await this.handleAPIRequest(req, res, pathname, parsedUrl.query);
      }
      // Static files
      else {
        this.serveStatic(req, res, pathname);
      }
    } catch (error) {
      console.error('[API] Error:', error);
      this.sendJSON(res, 500, { error: error.message });
    }
  }

  async handleAPIRequest(req, res, pathname, query) {
    const method = req.method;

    // Health check
    if (pathname === '/api/health') {
      return this.sendJSON(res, 200, { status: 'healthy', timestamp: new Date().toISOString() });
    }

    // Customer endpoints
    if (pathname === '/api/customers') {
      if (method === 'GET') {
        return await this.getCustomers(req, res, query);
      } else if (method === 'POST') {
        return await this.createCustomer(req, res);
      }
    }

    if (pathname.match(/^\/api\/customers\/([^\/]+)$/)) {
      const customerId = pathname.split('/')[3];
      if (method === 'GET') {
        return await this.getCustomer(req, res, customerId, query);
      } else if (method === 'PUT') {
        return await this.updateCustomer(req, res, customerId);
      } else if (method === 'DELETE') {
        return await this.deleteCustomer(req, res, customerId);
      }
    }

    if (pathname.match(/^\/api\/customers\/([^\/]+)\/context$/)) {
      const customerId = pathname.split('/')[3];
      return await this.getCustomerContext(req, res, customerId, query);
    }

    if (pathname.match(/^\/api\/customers\/([^\/]+)\/timeline$/)) {
      const customerId = pathname.split('/')[3];
      return await this.getCustomerTimeline(req, res, customerId, query);
    }

    if (pathname.match(/^\/api\/customers\/([^\/]+)\/notes$/)) {
      const customerId = pathname.split('/')[3];
      if (method === 'POST') {
        return await this.addCustomerNote(req, res, customerId);
      }
    }

    // Event endpoints
    if (pathname === '/api/events' && method === 'POST') {
      return await this.createEvent(req, res);
    }

    // Search endpoints
    if (pathname === '/api/search/customers') {
      return await this.searchCustomers(req, res, query);
    }

    // Stats endpoints
    if (pathname === '/api/stats') {
      return await this.getStats(req, res);
    }

    // Not found
    this.sendJSON(res, 404, { error: 'Endpoint not found' });
  }

  // ==================== CUSTOMER ENDPOINTS ====================

  async getCustomers(req, res, query) {
    const limit = parseInt(query.limit) || 50;
    const offset = parseInt(query.offset) || 0;
    const status = query.status;

    let sqlText = 'SELECT * FROM customers';
    const params = [];

    if (status) {
      sqlText += ' WHERE status = ?';
      params.push(status);
    }

    sqlText += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const customers = await this.db.query(sqlText, params);

    // Parse JSON fields
    customers.forEach(c => {
      c.tags = JSON.parse(c.tags || '[]');
      c.custom_fields = JSON.parse(c.custom_fields || '{}');
    });

    this.sendJSON(res, 200, {
      customers,
      total: customers.length,
      limit,
      offset
    });
  }

  async getCustomer(req, res, customerId, query) {
    const customer = await this.db.queryOne('SELECT * FROM customers WHERE id = ?', [customerId]);

    if (!customer) {
      return this.sendJSON(res, 404, { error: 'Customer not found' });
    }

    customer.tags = JSON.parse(customer.tags || '[]');
    customer.custom_fields = JSON.parse(customer.custom_fields || '{}');

    this.sendJSON(res, 200, { customer });
  }

  async createCustomer(req, res) {
    const body = await this.parseBody(req);

    if (!body.name) {
      return this.sendJSON(res, 400, { error: 'name is required' });
    }

    const id = body.id || this.generateId();
    const now = Math.floor(Date.now() / 1000);

    const stmt = this.db.prepare(`
      INSERT INTO customers (id, name, email, phone, company, status, customer_since, lifetime_value, tags, custom_fields, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    await stmt.run(
      id,
      body.name,
      body.email || null,
      body.phone || null,
      body.company || null,
      body.status || 'active',
      now,
      0,
      JSON.stringify(body.tags || []),
      JSON.stringify(body.custom_fields || {}),
      now,
      now
    );

    const customer = await this.db.queryOne('SELECT * FROM customers WHERE id = ?', [id]);
    customer.tags = JSON.parse(customer.tags);
    customer.custom_fields = JSON.parse(customer.custom_fields);

    this.sendJSON(res, 201, { customer });
  }

  async updateCustomer(req, res, customerId) {
    const body = await this.parseBody(req);

    const existing = await this.db.queryOne('SELECT * FROM customers WHERE id = ?', [customerId]);
    if (!existing) {
      return this.sendJSON(res, 404, { error: 'Customer not found' });
    }

    const now = Math.floor(Date.now() / 1000);
    const updates = [];
    const params = [];

    ['name', 'email', 'phone', 'company', 'status'].forEach(field => {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(body[field]);
      }
    });

    if (body.tags !== undefined) {
      updates.push('tags = ?');
      params.push(JSON.stringify(body.tags));
    }

    if (body.custom_fields !== undefined) {
      updates.push('custom_fields = ?');
      params.push(JSON.stringify(body.custom_fields));
    }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(customerId);

    await this.db.execute(`UPDATE customers SET ${updates.join(', ')} WHERE id = ?`, params);

    const customer = await this.db.queryOne('SELECT * FROM customers WHERE id = ?', [customerId]);
    customer.tags = JSON.parse(customer.tags);
    customer.custom_fields = JSON.parse(customer.custom_fields);

    this.sendJSON(res, 200, { customer });
  }

  async deleteCustomer(req, res, customerId) {
    const existing = await this.db.queryOne('SELECT * FROM customers WHERE id = ?', [customerId]);
    if (!existing) {
      return this.sendJSON(res, 404, { error: 'Customer not found' });
    }

    await this.db.execute('DELETE FROM customers WHERE id = ?', [customerId]);

    this.sendJSON(res, 200, { message: 'Customer deleted successfully' });
  }

  async getCustomerContext(req, res, customerId, query) {
    try {
      const context = await this.contextBuilder.buildCustomerContext(customerId, {
        includeEvents: query.include_events !== 'false',
        includePurchases: query.include_purchases !== 'false',
        includeWorkOrders: query.include_work_orders !== 'false',
        includeKnowledge: query.include_knowledge !== 'false',
        eventsLimit: parseInt(query.events_limit) || 20,
        purchasesLimit: parseInt(query.purchases_limit) || 10
      });

      this.sendJSON(res, 200, { context });
    } catch (error) {
      this.sendJSON(res, 404, { error: error.message });
    }
  }

  async getCustomerTimeline(req, res, customerId, query) {
    const timeline = this.contextBuilder.getCustomerTimeline(customerId, {
      limit: parseInt(query.limit) || 50,
      eventTypes: query.event_types ? query.event_types.split(',') : null
    });

    this.sendJSON(res, 200, { timeline });
  }

  async addCustomerNote(req, res, customerId) {
    const body = await this.parseBody(req);

    if (!body.content) {
      return this.sendJSON(res, 400, { error: 'content is required' });
    }

    const id = this.generateId();
    const now = Math.floor(Date.now() / 1000);

    const stmt = this.db.prepare(`
      INSERT INTO customer_knowledge (id, customer_id, content, category, importance, tags, source, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    await stmt.run(
      id,
      customerId,
      body.content,
      body.category || 'other',
      body.importance || 'medium',
      JSON.stringify(body.tags || []),
      'api',
      now,
      now
    );

    const note = await this.db.queryOne('SELECT * FROM customer_knowledge WHERE id = ?', [id]);
    note.tags = JSON.parse(note.tags);

    this.sendJSON(res, 201, { note });
  }

  // ==================== EVENT ENDPOINTS ====================

  async createEvent(req, res) {
    const body = await this.parseBody(req);

    if (!body.customer_id || !body.event_type) {
      return this.sendJSON(res, 400, { error: 'customer_id and event_type are required' });
    }

    body.timestamp = body.timestamp || Math.floor(Date.now() / 1000);
    body.source_service = body.source_service || 'api';

    try {
      const result = await this.eventProcessor.processEvent(body);
      this.sendJSON(res, 201, { result });
    } catch (error) {
      this.sendJSON(res, 400, { error: error.message });
    }
  }

  // ==================== SEARCH ENDPOINTS ====================

  async searchCustomers(req, res, query) {
    if (!query.q) {
      return this.sendJSON(res, 400, { error: 'Query parameter "q" is required' });
    }

    const results = this.contextBuilder.searchCustomers(query.q, parseInt(query.limit) || 10);

    this.sendJSON(res, 200, { results, total: results.length });
  }

  // ==================== STATS ENDPOINTS ====================

  async getStats(req, res) {
    const stats = {
      customers: {
        total: (await this.db.queryOne('SELECT COUNT(*) as count FROM customers')).count,
        by_status: await this.db.query('SELECT status, COUNT(*) as count FROM customers GROUP BY status')
      },
      events: {
        total: (await this.db.queryOne('SELECT COUNT(*) as count FROM customer_events')).count,
        by_type: await this.db.query('SELECT event_type, COUNT(*) as count FROM customer_events GROUP BY event_type')
      },
      purchases: {
        total: (await this.db.queryOne('SELECT COUNT(*) as count FROM purchases')).count,
        total_revenue: (await this.db.queryOne('SELECT SUM(total) as total FROM purchases')).total || 0
      },
      work_orders: {
        total: (await this.db.queryOne('SELECT COUNT(*) as count FROM work_orders')).count,
        open: (await this.db.queryOne('SELECT COUNT(*) as count FROM work_orders WHERE status != ? AND status != ?', ['completed', 'cancelled'])).count
      }
    };

    this.sendJSON(res, 200, { stats });
  }

  // ==================== STATIC FILE SERVER ====================

  serveStatic(req, res, pathname) {
    if (pathname === '/') {
      pathname = '/index.html';
    }

    const filePath = path.join(this.staticPath, pathname);

    // Security: prevent directory traversal
    if (!filePath.startsWith(this.staticPath)) {
      return this.sendJSON(res, 403, { error: 'Forbidden' });
    }

    // Check if file exists
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return this.sendJSON(res, 404, { error: 'Not found' });
    }

    // Determine content type
    const ext = path.extname(filePath);
    const contentTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml'
    };

    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  }

  // ==================== UTILITIES ====================

  generateId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

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

  sendJSON(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  async stop() {
    if (this.server) {
      this.server.close();
    }
    // Database disconnection handled by main application
  }
}

// Standalone server mode
if (require.main === module) {
  const server = new CustomerAPIServer();
  server.start().catch(console.error);
}

module.exports = CustomerAPIServer;
