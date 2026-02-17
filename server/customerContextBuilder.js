/**
 * Customer Context Builder
 *
 * Builds comprehensive customer context for AI consumption.
 * Aggregates customer profile, events, purchases, work orders, and knowledge
 * into a format optimized for LLM context injection.
 */

class CustomerContextBuilder {
  constructor(db) {
    this.db = db;
    this.prepareStatements();
  }

  prepareStatements() {
    this.stmts = {
      // Customer queries
      getCustomer: this.db.prepare('SELECT * FROM customers WHERE id = ?'),
      getCustomerByEmail: this.db.prepare('SELECT * FROM customers WHERE email = ? collate NOCASE LIMIT 1'),
      searchCustomers: this.db.prepare(`
        SELECT c.* FROM customers c
        JOIN customers_fts fts ON c.rowid = fts.rowid
        WHERE customers_fts MATCH ?
        LIMIT ?
      `),

      // Event queries
      getCustomerEvents: this.db.prepare(`
        SELECT * FROM customer_events
        WHERE customer_id = ?
        ORDER BY event_date DESC
        LIMIT ?
      `),

      getEventsByType: this.db.prepare(`
        SELECT * FROM customer_events
        WHERE customer_id = ? AND event_type = ?
        ORDER BY event_date DESC
        LIMIT ?
      `),

      // Purchase queries
      getCustomerPurchases: this.db.prepare(`
        SELECT * FROM purchases
        WHERE customer_id = ?
        ORDER BY purchase_date DESC
        LIMIT ?
      `),

      getPurchaseStats: this.db.prepare(`
        SELECT
          COUNT(*) as total_purchases,
          SUM(total) as total_spent,
          AVG(total) as avg_purchase,
          MAX(purchase_date) as last_purchase_date
        FROM purchases
        WHERE customer_id = ?
      `),

      // Work order queries
      getCustomerWorkOrders: this.db.prepare(`
        SELECT * FROM work_orders
        WHERE customer_id = ?
        ORDER BY created_date DESC
        LIMIT ?
      `),

      getOpenWorkOrders: this.db.prepare(`
        SELECT * FROM work_orders
        WHERE customer_id = ? AND status != 'completed' AND status != 'cancelled'
        ORDER BY priority DESC, created_date ASC
      `),

      // Knowledge queries
      getCustomerKnowledge: this.db.prepare(`
        SELECT * FROM customer_knowledge
        WHERE customer_id = ?
        ORDER BY
          CASE importance
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            WHEN 'low' THEN 4
            ELSE 5
          END,
          created_at DESC
        LIMIT ?
      `),

      getCriticalKnowledge: this.db.prepare(`
        SELECT * FROM customer_knowledge
        WHERE customer_id = ? AND importance IN ('high', 'critical')
        ORDER BY
          CASE importance
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
          END,
          created_at DESC
        LIMIT ?
      `)
    };
  }

  /**
   * Build complete customer context for AI
   */
  async buildCustomerContext(identifier, options = {}) {
    const {
      includeEvents = true,
      includePurchases = true,
      includeWorkOrders = true,
      includeKnowledge = true,
      eventsLimit = 20,
      purchasesLimit = 10,
      workOrdersLimit = 10,
      knowledgeLimit = 10
    } = options;

    // Get customer by ID or email
    let customer = null;
    if (identifier.includes('@')) {
      customer = this.stmts.getCustomerByEmail.get(identifier);
    } else {
      customer = this.stmts.getCustomer.get(identifier);
    }

    if (!customer) {
      throw new Error(`Customer not found: ${identifier}`);
    }

    // Parse JSON fields
    customer.tags = this.parseJSON(customer.tags);
    customer.custom_fields = this.parseJSON(customer.custom_fields);

    // Calculate relationship duration
    const now = Math.floor(Date.now() / 1000);
    const relationshipDays = Math.floor((now - customer.customer_since) / (60 * 60 * 24));

    // Build context object
    const context = {
      customer: customer,
      relationship: {
        duration_days: relationshipDays,
        status: customer.status,
        lifetime_value: customer.lifetime_value,
        tags: customer.tags,
        custom_fields: customer.custom_fields
      }
    };

    // Add events if requested
    if (includeEvents) {
      const events = this.stmts.getCustomerEvents.all(customer.id, eventsLimit);
      context.recent_activity = events.map(e => ({
        ...e,
        metadata: this.parseJSON(e.metadata),
        related_events: this.parseJSON(e.related_events)
      }));
      context.last_interaction = events[0] || null;
    }

    // Add purchase history if requested
    if (includePurchases) {
      const purchases = this.stmts.getCustomerPurchases.all(customer.id, purchasesLimit);
      const stats = this.stmts.getPurchaseStats.get(customer.id);

      context.purchases = {
        recent: purchases.map(p => ({
          ...p,
          metadata: this.parseJSON(p.metadata)
        })),
        stats: stats || {
          total_purchases: 0,
          total_spent: 0,
          avg_purchase: 0,
          last_purchase_date: null
        }
      };
    }

    // Add work orders if requested
    if (includeWorkOrders) {
      const workOrders = this.stmts.getCustomerWorkOrders.all(customer.id, workOrdersLimit);
      const openWorkOrders = this.stmts.getOpenWorkOrders.all(customer.id);

      context.work_orders = {
        recent: workOrders.map(w => ({
          ...w,
          metadata: this.parseJSON(w.metadata)
        })),
        open: openWorkOrders.map(w => ({
          ...w,
          metadata: this.parseJSON(w.metadata)
        }))
      };
    }

    // Add customer knowledge if requested
    if (includeKnowledge) {
      const knowledge = this.stmts.getCustomerKnowledge.all(customer.id, knowledgeLimit);
      const critical = this.stmts.getCriticalKnowledge.all(customer.id, 5);

      context.knowledge = {
        all: knowledge.map(k => ({
          ...k,
          tags: this.parseJSON(k.tags)
        })),
        critical: critical.map(k => ({
          ...k,
          tags: this.parseJSON(k.tags)
        }))
      };
    }

    // Build AI-ready context summary
    context.ai_context_summary = this.buildAIContextSummary(context);

    return context;
  }

  /**
   * Build formatted context summary for AI consumption
   */
  buildAIContextSummary(context) {
    const { customer, relationship, recent_activity, purchases, work_orders, knowledge } = context;

    let summary = `### Customer Profile
Name: ${customer.name}
Email: ${customer.email || 'N/A'}
Phone: ${customer.phone || 'N/A'}
Company: ${customer.company || 'N/A'}
Status: ${customer.status}
Customer Since: ${this.formatDate(customer.customer_since)}
Relationship Duration: ${relationship.duration_days} days
Lifetime Value: $${customer.lifetime_value.toFixed(2)}`;

    if (relationship.tags && relationship.tags.length > 0) {
      summary += `\nTags: ${relationship.tags.join(', ')}`;
    }

    // Recent activity
    if (recent_activity && recent_activity.length > 0) {
      summary += '\n\n### Recent Activity';
      recent_activity.slice(0, 5).forEach(event => {
        summary += `\n- ${this.formatDate(event.event_date)}: [${event.event_type}] ${event.title}`;
        if (event.description) {
          const desc = event.description.substring(0, 100);
          summary += `\n  ${desc}${event.description.length > 100 ? '...' : ''}`;
        }
      });
    }

    // Purchase summary
    if (purchases && purchases.stats) {
      summary += `\n\n### Purchase History
Total Purchases: ${purchases.stats.total_purchases}
Total Spent: $${purchases.stats.total_spent || 0}
Average Purchase: $${purchases.stats.avg_purchase || 0}`;

      if (purchases.stats.last_purchase_date) {
        summary += `\nLast Purchase: ${this.formatDate(purchases.stats.last_purchase_date)}`;
      }

      if (purchases.recent && purchases.recent.length > 0) {
        summary += '\n\nRecent Products:';
        purchases.recent.slice(0, 3).forEach(p => {
          summary += `\n- ${p.product_name} ($${p.total}) - ${this.formatDate(p.purchase_date)}`;
        });
      }
    }

    // Open work orders
    if (work_orders && work_orders.open && work_orders.open.length > 0) {
      summary += `\n\n### Open Work Orders (${work_orders.open.length})`;
      work_orders.open.forEach(wo => {
        summary += `\n- [${wo.priority.toUpperCase()}] ${wo.order_type}: ${wo.issue_description}`;
        summary += `\n  Status: ${wo.status}, Created: ${this.formatDate(wo.created_date)}`;
      });
    }

    // Critical knowledge/notes
    if (knowledge && knowledge.critical && knowledge.critical.length > 0) {
      summary += '\n\n### Important Notes';
      knowledge.critical.forEach(k => {
        summary += `\n- [${k.importance.toUpperCase()}] ${k.category || 'General'}: ${k.content}`;
      });
    }

    return summary;
  }

  /**
   * Search customers
   */
  searchCustomers(query, limit = 10) {
    const results = this.stmts.searchCustomers.all(query, limit);
    return results.map(c => ({
      ...c,
      tags: this.parseJSON(c.tags),
      custom_fields: this.parseJSON(c.custom_fields)
    }));
  }

  /**
   * Get customer timeline (all events chronologically)
   */
  getCustomerTimeline(customerId, options = {}) {
    const { limit = 50, eventTypes = null } = options;

    let query = `
      SELECT * FROM customer_events
      WHERE customer_id = ?
    `;

    const params = [customerId];

    if (eventTypes && eventTypes.length > 0) {
      query += ` AND event_type IN (${eventTypes.map(() => '?').join(',')})`;
      params.push(...eventTypes);
    }

    query += ` ORDER BY event_date DESC LIMIT ?`;
    params.push(limit);

    const stmt = this.db.prepare(query);
    const events = stmt.all(...params);

    return events.map(e => ({
      ...e,
      metadata: this.parseJSON(e.metadata),
      related_events: this.parseJSON(e.related_events)
    }));
  }

  /**
   * Utility: Parse JSON safely
   */
  parseJSON(jsonString) {
    if (!jsonString) return null;
    try {
      return JSON.parse(jsonString);
    } catch (e) {
      return null;
    }
  }

  /**
   * Utility: Format timestamp
   */
  formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

module.exports = CustomerContextBuilder;
