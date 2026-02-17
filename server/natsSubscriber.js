/**
 * NATS Subscriber Service
 *
 * Subscribes to NATS subjects for customer events and processes them
 * using the EventProcessor.
 */

const { connect, StringCodec } = require('nats');
const EventProcessor = require('./eventProcessor');

class NATSSubscriberService {
  constructor(db, options = {}) {
    this.db = db;
    this.options = {
      servers: options.servers || process.env.NATS_SERVERS || 'nats://localhost:4222',
      subjects: options.subjects || ['customer.events.>'],
      queueGroup: options.queueGroup || 'contextiq-service',
      maxReconnectAttempts: options.maxReconnectAttempts || -1, // -1 = infinite
      reconnectTimeWait: options.reconnectTimeWait || 2000, // 2 seconds
      ...options
    };

    this.nc = null; // NATS connection
    this.sc = StringCodec(); // String codec for encoding/decoding
    this.subscriptions = [];
    this.processor = new EventProcessor(db, options.eventProcessor || {});
    this.isConnected = false;
    this.stats = {
      received: 0,
      processed: 0,
      errors: 0,
      lastEvent: null
    };
  }

  /**
   * Connect to NATS and start subscribing
   */
  async start() {
    try {
      console.log('[NATS] Connecting to NATS server(s):', this.options.servers);

      // Parse servers string into array if needed
      const servers = typeof this.options.servers === 'string'
        ? this.options.servers.split(',')
        : this.options.servers;

      // Connect to NATS
      this.nc = await connect({
        servers: servers,
        name: 'contextiq-customer-service',
        maxReconnectAttempts: this.options.maxReconnectAttempts,
        reconnectTimeWait: this.options.reconnectTimeWait,
        reconnect: true,
        pingInterval: 60000, // 60 seconds
        maxPingOut: 3
      });

      this.isConnected = true;
      console.log('[NATS] Connected successfully');

      // Setup connection event handlers
      this.setupConnectionHandlers();

      // Subscribe to configured subjects
      await this.subscribe();

      // Setup graceful shutdown
      this.setupShutdown();

      return true;
    } catch (error) {
      console.error('[NATS] Failed to connect:', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Subscribe to NATS subjects
   */
  async subscribe() {
    for (const subject of this.options.subjects) {
      try {
        console.log(`[NATS] Subscribing to: ${subject} (queue: ${this.options.queueGroup})`);

        const subscription = this.nc.subscribe(subject, {
          queue: this.options.queueGroup
        });

        // Process messages asynchronously
        (async () => {
          for await (const msg of subscription) {
            await this.handleMessage(msg);
          }
        })();

        this.subscriptions.push(subscription);
        console.log(`[NATS] Successfully subscribed to: ${subject}`);
      } catch (error) {
        console.error(`[NATS] Failed to subscribe to ${subject}:`, error);
      }
    }
  }

  /**
   * Handle incoming NATS message
   */
  async handleMessage(msg) {
    this.stats.received++;

    try {
      // Decode message
      const data = this.sc.decode(msg.data);
      const event = JSON.parse(data);

      console.log(`[NATS] Received event on ${msg.subject}:`, event.event_type, event.customer_id || event.data?.email);

      // Add subject to event for tracking
      event._nats_subject = msg.subject;

      // Process event
      const result = await this.processor.processEvent(event);

      this.stats.processed++;
      this.stats.lastEvent = new Date().toISOString();

      // Optionally acknowledge (if using JetStream)
      if (msg.ack) {
        msg.ack();
      }

      // Optionally reply with result
      if (msg.reply) {
        this.nc.publish(msg.reply, this.sc.encode(JSON.stringify({
          success: true,
          result: result
        })));
      }
    } catch (error) {
      this.stats.errors++;
      console.error('[NATS] Error processing message:', error);
      console.error('[NATS] Message subject:', msg.subject);
      console.error('[NATS] Message data:', this.sc.decode(msg.data));

      // Optionally send error response
      if (msg.reply) {
        this.nc.publish(msg.reply, this.sc.encode(JSON.stringify({
          success: false,
          error: error.message
        })));
      }

      // Don't ack if using JetStream and want redelivery
      // msg.nak(); // Negative acknowledge for redelivery
    }
  }

  /**
   * Setup connection event handlers
   */
  setupConnectionHandlers() {
    // Handle disconnections
    (async () => {
      for await (const status of this.nc.status()) {
        const timestamp = new Date().toISOString();

        switch (status.type) {
          case 'disconnect':
            console.log(`[NATS] ${timestamp} - Disconnected from server`);
            this.isConnected = false;
            break;

          case 'reconnecting':
            console.log(`[NATS] ${timestamp} - Reconnecting to server...`);
            break;

          case 'reconnect':
            console.log(`[NATS] ${timestamp} - Reconnected to server`);
            this.isConnected = true;
            break;

          case 'error':
            console.error(`[NATS] ${timestamp} - Connection error:`, status.error);
            break;

          case 'pingTimer':
            // Optional: log ping activity for debugging
            // console.log(`[NATS] ${timestamp} - Ping timer`);
            break;
        }
      }
    })();

    // Handle errors
    (async () => {
      const done = this.nc.closed();
      const err = await done;
      if (err) {
        console.error('[NATS] Connection closed with error:', err);
      } else {
        console.log('[NATS] Connection closed cleanly');
      }
    })();
  }

  /**
   * Setup graceful shutdown on process signals
   */
  setupShutdown() {
    const gracefulShutdown = async (signal) => {
      console.log(`[NATS] Received ${signal}, shutting down gracefully...`);
      await this.stop();
      process.exit(0);
    };

    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
  }

  /**
   * Stop NATS subscriptions and close connection
   */
  async stop() {
    try {
      console.log('[NATS] Stopping subscriptions...');

      // Unsubscribe from all subjects
      for (const sub of this.subscriptions) {
        await sub.unsubscribe();
      }
      this.subscriptions = [];

      // Drain and close connection
      if (this.nc) {
        await this.nc.drain();
        await this.nc.close();
        this.nc = null;
      }

      this.isConnected = false;
      console.log('[NATS] Service stopped successfully');
    } catch (error) {
      console.error('[NATS] Error during shutdown:', error);
    }
  }

  /**
   * Publish a test event (for testing)
   */
  async publishTestEvent(event) {
    if (!this.nc || !this.isConnected) {
      throw new Error('Not connected to NATS');
    }

    const subject = event.subject || `customer.events.${event.customer_id}.${event.event_type}`;
    const data = this.sc.encode(JSON.stringify(event));

    this.nc.publish(subject, data);
    console.log(`[NATS] Published test event to ${subject}`);
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      connected: this.isConnected,
      subjects: this.options.subjects,
      queueGroup: this.options.queueGroup,
      stats: this.stats,
      subscriptions: this.subscriptions.length
    };
  }

  /**
   * Check if service is healthy
   */
  isHealthy() {
    return this.isConnected && this.nc !== null;
  }
}

module.exports = NATSSubscriberService;
