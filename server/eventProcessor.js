/**
 * Event Processor
 *
 * Processes incoming NATS events and stores them in customer profiles.
 * Handles event validation, transformation, summarization, and storage.
 */

class EventProcessor {
  constructor(db, options = {}) {
    this.db = db;
    this.summarizeThreshold = options.summarizeThreshold || 500; // Chars threshold for summarization
    this.autoCreateCustomer = options.autoCreateCustomer !== false; // Default true

    // Prepare statements for performance
    this.prepareStatements();
  }

  prepareStatements() {
    // Customer operations
    this.stmts = {
      getCustomer: this.db.prepare('SELECT * FROM customers WHERE id = ?'),
      getCustomerByEmail: this.db.prepare('SELECT * FROM customers WHERE email = ?'),
      createCustomer: this.db.prepare(`
        INSERT INTO customers (id, name, email, phone, company, status, customer_since, lifetime_value, tags, custom_fields, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),
      updateCustomer: this.db.prepare(`
        UPDATE customers
        SET name = ?, email = ?, phone = ?, company = ?, status = ?, lifetime_value = ?, tags = ?, custom_fields = ?, updated_at = ?
        WHERE id = ?
      `),

      // Event operations
      createEvent: this.db.prepare(`
        INSERT INTO customer_events (id, customer_id, event_type, event_date, title, description, amount, status, metadata, agent_notes, related_events, source_service, raw_event_data, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),

      // Purchase operations
      createPurchase: this.db.prepare(`
        INSERT INTO purchases (id, customer_id, product_name, product_sku, quantity, price, total, purchase_date, warranty_expires, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),

      // Work order operations
      createWorkOrder: this.db.prepare(`
        INSERT INTO work_orders (id, customer_id, order_type, product_id, issue_description, resolution, status, priority, assigned_to, created_date, completed_date, cost, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),
      updateWorkOrder: this.db.prepare(`
        UPDATE work_orders
        SET status = ?, resolution = ?, completed_date = ?, cost = ?, metadata = ?
        WHERE id = ?
      `),

      // Knowledge operations
      createKnowledge: this.db.prepare(`
        INSERT INTO customer_knowledge (id, customer_id, content, category, importance, tags, source, related_event_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
    };
  }

  /**
   * Main entry point for processing events from NATS
   */
  async processEvent(event) {
    try {
      // Validate event structure
      this.validateEvent(event);

      // Get or create customer
      const customer = await this.ensureCustomer(event);

      // Process based on event type
      switch (event.event_type) {
        case 'purchase':
          return await this.processPurchase(customer, event);

        case 'support_ticket':
        case 'contact':
          return await this.processContact(customer, event);

        case 'repair':
        case 'work_order':
          return await this.processWorkOrder(customer, event);

        case 'profile_update':
          return await this.processProfileUpdate(customer, event);

        case 'note':
        case 'observation':
          return await this.processNote(customer, event);

        default:
          // Store as generic event
          return await this.processGenericEvent(customer, event);
      }
    } catch (error) {
      console.error('[EventProcessor] Error processing event:', error);
      console.error('[EventProcessor] Event data:', JSON.stringify(event, null, 2));
      throw error;
    }
  }

  /**
   * Validate event has required fields
   */
  validateEvent(event) {
    if (!event.customer_id && !event.data?.customer_id && !event.data?.email) {
      throw new Error('Event must have customer_id or email');
    }
    if (!event.event_type) {
      throw new Error('Event must have event_type');
    }
    if (!event.timestamp) {
      throw new Error('Event must have timestamp');
    }
  }

  /**
   * Get existing customer or create new one
   */
  async ensureCustomer(event) {
    const customerId = event.customer_id || event.data?.customer_id;
    const email = event.data?.email || event.data?.customer_email;

    let customer = null;

    // Try to find by ID first
    if (customerId) {
      customer = this.stmts.getCustomer.get(customerId);
    }

    // Try by email if not found
    if (!customer && email) {
      customer = this.stmts.getCustomerByEmail.get(email);
    }

    // Create customer if not found and auto-create is enabled
    if (!customer && this.autoCreateCustomer) {
      const now = Math.floor(Date.now() / 1000);
      const newCustomerId = customerId || this.generateId();

      this.stmts.createCustomer.run(
        newCustomerId,
        event.data?.customer_name || event.data?.name || 'Unknown',
        email || null,
        event.data?.phone || null,
        event.data?.company || null,
        'active',
        now,
        0,
        JSON.stringify([]),
        JSON.stringify({}),
        now,
        now
      );

      customer = this.stmts.getCustomer.get(newCustomerId);
      console.log(`[EventProcessor] Auto-created customer: ${newCustomerId}`);
    }

    if (!customer) {
      throw new Error(`Customer not found and auto-create disabled: ${customerId || email}`);
    }

    return customer;
  }

  /**
   * Process purchase event
   */
  async processPurchase(customer, event) {
    const now = Math.floor(Date.now() / 1000);
    const purchaseId = event.data?.purchase_id || this.generateId();

    // Create purchase record
    this.stmts.createPurchase.run(
      purchaseId,
      customer.id,
      event.data?.product_name || event.data?.product || 'Unknown Product',
      event.data?.product_sku || event.data?.sku || null,
      event.data?.quantity || 1,
      event.data?.price || event.data?.unit_price || 0,
      event.data?.total || event.data?.amount || 0,
      event.timestamp,
      event.data?.warranty_expires || null,
      JSON.stringify(event.data || {}),
      now
    );

    // Create event record
    const eventId = this.generateId();
    const title = event.data?.title || `Purchase: ${event.data?.product_name || 'Unknown Product'}`;
    const description = this.shouldSummarize(event)
      ? await this.summarizeEvent(event, 'purchase')
      : this.formatEventDescription(event);

    this.stmts.createEvent.run(
      eventId,
      customer.id,
      'purchase',
      event.timestamp,
      title,
      description,
      event.data?.total || event.data?.amount || 0,
      event.data?.status || 'completed',
      JSON.stringify(event.metadata || {}),
      null, // agent_notes
      null, // related_events
      event.source_service || 'unknown',
      JSON.stringify(event),
      now
    );

    // Update customer lifetime value
    const newLifetimeValue = customer.lifetime_value + (event.data?.total || event.data?.amount || 0);
    this.db.prepare('UPDATE customers SET lifetime_value = ?, updated_at = ? WHERE id = ?')
      .run(newLifetimeValue, now, customer.id);

    console.log(`[EventProcessor] Processed purchase for customer ${customer.id}: ${purchaseId}`);
    return { event_id: eventId, purchase_id: purchaseId };
  }

  /**
   * Process contact/support ticket event
   */
  async processContact(customer, event) {
    const now = Math.floor(Date.now() / 1000);
    const eventId = this.generateId();

    const title = event.data?.title || event.data?.subject || 'Customer Contact';
    const description = this.shouldSummarize(event)
      ? await this.summarizeEvent(event, 'contact')
      : this.formatEventDescription(event);

    this.stmts.createEvent.run(
      eventId,
      customer.id,
      event.event_type,
      event.timestamp,
      title,
      description,
      null, // amount
      event.data?.status || 'open',
      JSON.stringify(event.metadata || {}),
      event.data?.agent_notes || null,
      null, // related_events
      event.source_service || 'unknown',
      JSON.stringify(event),
      now
    );

    // Extract important notes as customer knowledge
    if (event.data?.important || event.data?.save_as_memory) {
      await this.createKnowledgeEntry(customer, event, description);
    }

    console.log(`[EventProcessor] Processed contact for customer ${customer.id}: ${eventId}`);
    return { event_id: eventId };
  }

  /**
   * Process work order/repair event
   */
  async processWorkOrder(customer, event) {
    const now = Math.floor(Date.now() / 1000);
    const workOrderId = event.data?.work_order_id || event.data?.ticket_id || this.generateId();

    // Check if work order exists (for updates)
    const existing = this.db.prepare('SELECT * FROM work_orders WHERE id = ?').get(workOrderId);

    if (existing) {
      // Update existing work order
      this.stmts.updateWorkOrder.run(
        event.data?.status || existing.status,
        event.data?.resolution || existing.resolution,
        event.data?.completed_date || (event.data?.status === 'completed' ? now : existing.completed_date),
        event.data?.cost || existing.cost,
        JSON.stringify(event.data || {}),
        workOrderId
      );
    } else {
      // Create new work order
      this.stmts.createWorkOrder.run(
        workOrderId,
        customer.id,
        event.event_type === 'repair' ? 'repair' : (event.data?.order_type || 'service'),
        event.data?.product_id || null,
        event.data?.issue_description || event.data?.description || '',
        event.data?.resolution || null,
        event.data?.status || 'open',
        event.data?.priority || 'medium',
        event.data?.assigned_to || null,
        event.timestamp,
        event.data?.completed_date || null,
        event.data?.cost || null,
        JSON.stringify(event.data || {})
      );
    }

    // Create event record
    const eventId = this.generateId();
    const title = event.data?.title || `Work Order: ${workOrderId}`;
    const description = this.shouldSummarize(event)
      ? await this.summarizeEvent(event, 'work_order')
      : this.formatEventDescription(event);

    this.stmts.createEvent.run(
      eventId,
      customer.id,
      event.event_type,
      event.timestamp,
      title,
      description,
      event.data?.cost || null,
      event.data?.status || 'open',
      JSON.stringify(event.metadata || {}),
      event.data?.agent_notes || null,
      null,
      event.source_service || 'unknown',
      JSON.stringify(event),
      now
    );

    console.log(`[EventProcessor] Processed work order for customer ${customer.id}: ${workOrderId}`);
    return { event_id: eventId, work_order_id: workOrderId };
  }

  /**
   * Process profile update event
   */
  async processProfileUpdate(customer, event) {
    const now = Math.floor(Date.now() / 1000);

    // Update customer profile fields
    const updates = event.data?.updates || event.data || {};

    this.stmts.updateCustomer.run(
      updates.name || customer.name,
      updates.email || customer.email,
      updates.phone || customer.phone,
      updates.company || customer.company,
      updates.status || customer.status,
      updates.lifetime_value !== undefined ? updates.lifetime_value : customer.lifetime_value,
      updates.tags ? JSON.stringify(updates.tags) : customer.tags,
      updates.custom_fields ? JSON.stringify(updates.custom_fields) : customer.custom_fields,
      now,
      customer.id
    );

    // Create event record
    const eventId = this.generateId();
    this.stmts.createEvent.run(
      eventId,
      customer.id,
      'profile_update',
      event.timestamp,
      'Profile Updated',
      `Customer profile updated: ${Object.keys(updates).join(', ')}`,
      null,
      'completed',
      JSON.stringify(event.metadata || {}),
      event.data?.notes || null,
      null,
      event.source_service || 'unknown',
      JSON.stringify(event),
      now
    );

    console.log(`[EventProcessor] Processed profile update for customer ${customer.id}: ${eventId}`);
    return { event_id: eventId };
  }

  /**
   * Process note/observation event
   */
  async processNote(customer, event) {
    const now = Math.floor(Date.now() / 1000);

    const content = event.data?.content || event.data?.note || event.data?.message || '';

    // Create knowledge entry
    await this.createKnowledgeEntry(customer, event, content);

    // Also create event record for timeline
    const eventId = this.generateId();
    this.stmts.createEvent.run(
      eventId,
      customer.id,
      'note',
      event.timestamp,
      event.data?.title || 'Note',
      this.shouldSummarize(event) ? await this.summarizeEvent(event, 'note') : content,
      null,
      'completed',
      JSON.stringify(event.metadata || {}),
      null,
      null,
      event.source_service || 'unknown',
      JSON.stringify(event),
      now
    );

    console.log(`[EventProcessor] Processed note for customer ${customer.id}: ${eventId}`);
    return { event_id: eventId };
  }

  /**
   * Process generic event
   */
  async processGenericEvent(customer, event) {
    const now = Math.floor(Date.now() / 1000);
    const eventId = this.generateId();

    const title = event.data?.title || `Event: ${event.event_type}`;
    const description = this.shouldSummarize(event)
      ? await this.summarizeEvent(event, event.event_type)
      : this.formatEventDescription(event);

    this.stmts.createEvent.run(
      eventId,
      customer.id,
      event.event_type,
      event.timestamp,
      title,
      description,
      event.data?.amount || null,
      event.data?.status || 'completed',
      JSON.stringify(event.metadata || {}),
      event.data?.agent_notes || null,
      null,
      event.source_service || 'unknown',
      JSON.stringify(event),
      now
    );

    console.log(`[EventProcessor] Processed generic event for customer ${customer.id}: ${eventId}`);
    return { event_id: eventId };
  }

  /**
   * Create a knowledge entry for important customer information
   */
  async createKnowledgeEntry(customer, event, content) {
    const now = Math.floor(Date.now() / 1000);
    const knowledgeId = this.generateId();

    this.stmts.createKnowledge.run(
      knowledgeId,
      customer.id,
      content,
      event.data?.category || this.inferCategory(event),
      event.data?.importance || 'medium',
      JSON.stringify(event.data?.tags || []),
      event.source_service || 'nats-event',
      event.data?.event_id || null,
      now,
      now
    );

    return knowledgeId;
  }

  /**
   * Determine if event should be summarized
   */
  shouldSummarize(event) {
    // Check if event explicitly requests summarization
    if (event.data?.summarize === true) return true;
    if (event.data?.summarize === false) return false;

    // Auto-summarize if description is long
    const description = this.formatEventDescription(event);
    return description.length > this.summarizeThreshold;
  }

  /**
   * Summarize event using AI (placeholder - integrate with your LLM)
   */
  async summarizeEvent(event, eventType) {
    // TODO: Integrate with LLM for intelligent summarization
    // For now, return a simple summary
    const description = this.formatEventDescription(event);

    // Simple truncation with ellipsis (replace with LLM call)
    if (description.length > 200) {
      return description.substring(0, 197) + '...';
    }

    return description;
  }

  /**
   * Format event description from data
   */
  formatEventDescription(event) {
    if (event.data?.description) return event.data.description;
    if (event.data?.message) return event.data.message;
    if (event.data?.content) return event.data.content;

    // Build description from event data
    const important = [];
    if (event.data?.product_name) important.push(`Product: ${event.data.product_name}`);
    if (event.data?.issue_description) important.push(`Issue: ${event.data.issue_description}`);
    if (event.data?.resolution) important.push(`Resolution: ${event.data.resolution}`);
    if (event.data?.amount) important.push(`Amount: $${event.data.amount}`);

    return important.length > 0 ? important.join('\n') : JSON.stringify(event.data, null, 2);
  }

  /**
   * Infer knowledge category from event
   */
  inferCategory(event) {
    if (event.event_type.includes('purchase')) return 'purchase_history';
    if (event.event_type.includes('support') || event.event_type.includes('ticket')) return 'support';
    if (event.event_type.includes('repair') || event.event_type.includes('work_order')) return 'technical';
    if (event.event_type.includes('contact')) return 'communication';
    if (event.event_type.includes('note') || event.event_type.includes('observation')) return 'observation';
    return 'general';
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
}

module.exports = EventProcessor;
