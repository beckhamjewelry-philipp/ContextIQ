/**
 * CRM Integration Module
 *
 * Provides bidirectional sync with external CRM systems:
 * - Salesforce
 * - HubSpot
 * - Generic REST API CRMs
 */

const https = require('https');
const http = require('http');

class CRMIntegration {
  constructor(db, options = {}) {
    this.db = db;
    this.type = options.type || 'salesforce'; // 'salesforce', 'hubspot', 'generic'
    this.config = options.config || {};
    this.syncInterval = options.syncInterval || 300000; // 5 minutes
    this.syncTimer = null;
  }

  /**
   * Start automated sync
   */
  startSync() {
    console.log(`[CRM] Starting ${this.type} sync (interval: ${this.syncInterval}ms)`);

    this.syncTimer = setInterval(async () => {
      try {
        await this.syncFromCRM();
      } catch (error) {
        console.error('[CRM] Sync error:', error);
      }
    }, this.syncInterval);

    // Initial sync
    this.syncFromCRM().catch(console.error);
  }

  /**
   * Stop automated sync
   */
  stopSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      console.log('[CRM] Sync stopped');
    }
  }

  /**
   * Sync customers from CRM to ContextIQ
   */
  async syncFromCRM() {
    console.log(`[CRM] Starting sync from ${this.type}...`);

    try {
      let customers;

      if (this.type === 'salesforce') {
        customers = await this.fetchFromSalesforce();
      } else if (this.type === 'hubspot') {
        customers = await this.fetchFromHubSpot();
      } else {
        customers = await this.fetchFromGenericAPI();
      }

      let created = 0;
      let updated = 0;

      for (const customerData of customers) {
        const existing = this.db.prepare('SELECT * FROM customers WHERE id = ?').get(customerData.id);

        if (existing) {
          await this.updateCustomer(customerData);
          updated++;
        } else {
          await this.createCustomer(customerData);
          created++;
        }
      }

      console.log(`[CRM] Sync complete: ${created} created, ${updated} updated`);
      return { created, updated };
    } catch (error) {
      console.error('[CRM] Sync failed:', error);
      throw error;
    }
  }

  /**
   * Push customer to CRM
   */
  async pushToCRM(customerId) {
    const customer = this.db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    if (this.type === 'salesforce') {
      return await this.pushToSalesforce(customer);
    } else if (this.type === 'hubspot') {
      return await this.pushToHubSpot(customer);
    } else {
      return await this.pushToGenericAPI(customer);
    }
  }

  // ==================== SALESFORCE INTEGRATION ====================

  async fetchFromSalesforce() {
    // Salesforce uses OAuth 2.0 for authentication
    const accessToken = await this.getSalesforceAccessToken();

    const query = `SELECT Id, Name, Email, Phone, Company, Status__c, Lifetime_Value__c, CreatedDate FROM Contact WHERE LastModifiedDate > ${this.getLastSyncTime()}`;

    const response = await this.makeRequest({
      hostname: this.config.instanceUrl.replace('https://', ''),
      path: `/services/data/v57.0/query?q=${encodeURIComponent(query)}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    return response.records.map(record => ({
      id: record.Id,
      name: record.Name,
      email: record.Email,
      phone: record.Phone,
      company: record.Company,
      status: this.mapSalesforceStatus(record.Status__c),
      lifetime_value: record.Lifetime_Value__c || 0,
      customer_since: new Date(record.CreatedDate).getTime() / 1000,
      tags: [],
      custom_fields: {
        salesforce_id: record.Id
      }
    }));
  }

  async pushToSalesforce(customer) {
    const accessToken = await this.getSalesforceAccessToken();

    const salesforceData = {
      Name: customer.name,
      Email: customer.email,
      Phone: customer.phone,
      Company: customer.company,
      Status__c: this.mapToSalesforceStatus(customer.status),
      Lifetime_Value__c: customer.lifetime_value
    };

    const customFields = JSON.parse(customer.custom_fields || '{}');
    const salesforceId = customFields.salesforce_id;

    if (salesforceId) {
      // Update existing
      await this.makeRequest({
        hostname: this.config.instanceUrl.replace('https://', ''),
        path: `/services/data/v57.0/sobjects/Contact/${salesforceId}`,
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(salesforceData)
      });
    } else {
      // Create new
      const response = await this.makeRequest({
        hostname: this.config.instanceUrl.replace('https://', ''),
        path: '/services/data/v57.0/sobjects/Contact',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(salesforceData)
      });

      // Store Salesforce ID
      this.db.prepare('UPDATE customers SET custom_fields = ? WHERE id = ?')
        .run(JSON.stringify({ ...customFields, salesforce_id: response.id }), customer.id);
    }

    return { success: true, salesforceId: salesforceId || response.id };
  }

  async getSalesforceAccessToken() {
    // OAuth 2.0 Password Flow (for server-to-server)
    const response = await this.makeRequest({
      hostname: this.config.loginUrl.replace('https://', '') || 'login.salesforce.com',
      path: '/services/oauth2/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        username: this.config.username,
        password: this.config.password + this.config.securityToken
      }).toString()
    });

    return response.access_token;
  }

  mapSalesforceStatus(status) {
    const mapping = {
      'Active': 'active',
      'Inactive': 'inactive',
      'VIP': 'vip',
      'At Risk': 'at-risk'
    };
    return mapping[status] || 'active';
  }

  mapToSalesforceStatus(status) {
    const mapping = {
      'active': 'Active',
      'inactive': 'Inactive',
      'vip': 'VIP',
      'at-risk': 'At Risk'
    };
    return mapping[status] || 'Active';
  }

  // ==================== HUBSPOT INTEGRATION ====================

  async fetchFromHubSpot() {
    const response = await this.makeRequest({
      hostname: 'api.hubapi.com',
      path: '/crm/v3/objects/contacts?limit=100&properties=firstname,lastname,email,phone,company,lifecyclestage,hs_lifetime_value',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    return response.results.map(contact => ({
      id: contact.id,
      name: `${contact.properties.firstname} ${contact.properties.lastname}`.trim(),
      email: contact.properties.email,
      phone: contact.properties.phone,
      company: contact.properties.company,
      status: this.mapHubSpotLifecycleStage(contact.properties.lifecyclestage),
      lifetime_value: parseFloat(contact.properties.hs_lifetime_value) || 0,
      customer_since: Math.floor(new Date(contact.createdAt).getTime() / 1000),
      tags: [],
      custom_fields: {
        hubspot_id: contact.id
      }
    }));
  }

  async pushToHubSpot(customer) {
    const [firstname, ...lastnameArr] = customer.name.split(' ');
    const lastname = lastnameArr.join(' ');

    const hubspotData = {
      properties: {
        firstname: firstname,
        lastname: lastname,
        email: customer.email,
        phone: customer.phone,
        company: customer.company,
        lifecyclestage: this.mapToHubSpotLifecycleStage(customer.status),
        hs_lifetime_value: customer.lifetime_value
      }
    };

    const customFields = JSON.parse(customer.custom_fields || '{}');
    const hubspotId = customFields.hubspot_id;

    if (hubspotId) {
      // Update existing
      await this.makeRequest({
        hostname: 'api.hubapi.com',
        path: `/crm/v3/objects/contacts/${hubspotId}`,
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(hubspotData)
      });
    } else {
      // Create new
      const response = await this.makeRequest({
        hostname: 'api.hubapi.com',
        path: '/crm/v3/objects/contacts',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(hubspotData)
      });

      // Store HubSpot ID
      this.db.prepare('UPDATE customers SET custom_fields = ? WHERE id = ?')
        .run(JSON.stringify({ ...customFields, hubspot_id: response.id }), customer.id);
    }

    return { success: true, hubspotId: hubspotId };
  }

  mapHubSpotLifecycleStage(stage) {
    const mapping = {
      'lead': 'active',
      'customer': 'active',
      'opportunity': 'active',
      'evangelist': 'vip',
      'other': 'inactive'
    };
    return mapping[stage] || 'active';
  }

  mapToHubSpotLifecycleStage(status) {
    const mapping = {
      'active': 'customer',
      'inactive': 'other',
      'vip': 'evangelist',
      'at-risk': 'customer'
    };
    return mapping[status] || 'customer';
  }

  // ==================== GENERIC API INTEGRATION ====================

  async fetchFromGenericAPI() {
    const response = await this.makeRequest({
      hostname: this.config.apiUrl.replace('https://', '').replace('http://', '').split('/')[0],
      path: this.config.customersEndpoint || '/api/customers',
      method: 'GET',
      headers: {
        'Authorization': this.config.authHeader || `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    // Assume response is array of customers
    // Map fields based on config
    return response.map(customer => ({
      id: customer[this.config.fieldMap.id] || customer.id,
      name: customer[this.config.fieldMap.name] || customer.name,
      email: customer[this.config.fieldMap.email] || customer.email,
      phone: customer[this.config.fieldMap.phone] || customer.phone,
      company: customer[this.config.fieldMap.company] || customer.company,
      status: customer[this.config.fieldMap.status] || 'active',
      lifetime_value: customer[this.config.fieldMap.lifetime_value] || 0,
      customer_since: Math.floor(Date.now() / 1000),
      tags: [],
      custom_fields: customer
    }));
  }

  async pushToGenericAPI(customer) {
    // Generic POST/PUT to external API
    const method = this.config.updateMethod || 'PUT';
    const endpoint = this.config.customersEndpoint || '/api/customers';

    await this.makeRequest({
      hostname: this.config.apiUrl.replace('https://', '').replace('http://', '').split('/')[0],
      path: `${endpoint}/${customer.id}`,
      method: method,
      headers: {
        'Authorization': this.config.authHeader || `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(customer)
    });

    return { success: true };
  }

  // ==================== HELPER METHODS ====================

  async createCustomer(customerData) {
    const now = Math.floor(Date.now() / 1000);

    this.db.prepare(`
      INSERT INTO customers (id, name, email, phone, company, status, customer_since, lifetime_value, tags, custom_fields, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      customerData.id,
      customerData.name,
      customerData.email,
      customerData.phone,
      customerData.company,
      customerData.status,
      customerData.customer_since || now,
      customerData.lifetime_value,
      JSON.stringify(customerData.tags || []),
      JSON.stringify(customerData.custom_fields || {}),
      now,
      now
    );
  }

  async updateCustomer(customerData) {
    const now = Math.floor(Date.now() / 1000);

    this.db.prepare(`
      UPDATE customers
      SET name = ?, email = ?, phone = ?, company = ?, status = ?, lifetime_value = ?, tags = ?, custom_fields = ?, updated_at = ?
      WHERE id = ?
    `).run(
      customerData.name,
      customerData.email,
      customerData.phone,
      customerData.company,
      customerData.status,
      customerData.lifetime_value,
      JSON.stringify(customerData.tags || []),
      JSON.stringify(customerData.custom_fields || {}),
      now,
      customerData.id
    );
  }

  getLastSyncTime() {
    // Get last sync from metadata table (or return yesterday)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString();
  }

  makeRequest(options) {
    return new Promise((resolve, reject) => {
      const protocol = options.hostname.startsWith('localhost') ? http : https;

      const req = protocol.request(options, (res) => {
        let data = '';

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`));
            }
          } catch (e) {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(data);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          }
        });
      });

      req.on('error', reject);

      if (options.body) {
        req.write(options.body);
      }

      req.end();
    });
  }
}

module.exports = CRMIntegration;
