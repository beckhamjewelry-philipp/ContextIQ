#!/usr/bin/env node

/**
 * NATS Test Event Publisher
 *
 * Publishes sample customer events to NATS for testing the ContextIQ integration.
 *
 * Usage:
 *   node test-publisher.js
 *   node test-publisher.js --event purchase
 *   node test-publisher.js --customer cust_123 --event support_ticket
 */

const { connect, StringCodec } = require('nats');

const sc = StringCodec();

// Sample event templates
const eventTemplates = {
  purchase: {
    customer_id: 'cust_001',
    event_type: 'purchase',
    timestamp: Math.floor(Date.now() / 1000),
    source_service: 'e-commerce-service',
    data: {
      purchase_id: 'ord_' + Date.now(),
      product_name: 'Wireless Headphones Pro',
      product_sku: 'WHP-2000',
      quantity: 1,
      price: 299.99,
      total: 299.99,
      status: 'completed',
      customer_name: 'John Smith',
      email: 'john.smith@example.com'
    },
    metadata: {
      session_id: 'sess_' + Math.random().toString(36).substring(7),
      user_agent: 'Mozilla/5.0',
      payment_method: 'credit_card'
    }
  },

  support_ticket: {
    customer_id: 'cust_001',
    event_type: 'support_ticket',
    timestamp: Math.floor(Date.now() / 1000),
    source_service: 'support-system',
    data: {
      ticket_id: 'TKT-' + Date.now(),
      title: 'Product not working as expected',
      description: 'Customer reports that the wireless headphones are not connecting to their phone properly. Bluetooth pairing seems inconsistent.',
      status: 'open',
      priority: 'high',
      category: 'technical',
      customer_name: 'John Smith',
      email: 'john.smith@example.com',
      important: true
    },
    metadata: {
      channel: 'email',
      source_email: 'support@example.com'
    }
  },

  work_order: {
    customer_id: 'cust_001',
    event_type: 'repair',
    timestamp: Math.floor(Date.now() / 1000),
    source_service: 'repair-service',
    data: {
      work_order_id: 'WO-' + Date.now(),
      order_type: 'repair',
      title: 'Headphone Bluetooth Module Replacement',
      issue_description: 'Bluetooth connectivity issues. Module needs replacement.',
      status: 'open',
      priority: 'medium',
      assigned_to: 'technician_05',
      product_id: 'WHP-2000',
      customer_name: 'John Smith',
      email: 'john.smith@example.com'
    },
    metadata: {
      warranty_status: 'in_warranty',
      estimated_completion: '2024-12-20'
    }
  },

  contact: {
    customer_id: 'cust_001',
    event_type: 'contact',
    timestamp: Math.floor(Date.now() / 1000),
    source_service: 'crm-system',
    data: {
      title: 'Customer inquiry about warranty',
      message: 'Customer called to ask about extended warranty options for their recent purchase.',
      status: 'completed',
      agent_notes: 'Customer is interested in 3-year extended warranty. Will follow up with pricing.',
      customer_name: 'John Smith',
      email: 'john.smith@example.com',
      save_as_memory: true,
      category: 'inquiry'
    },
    metadata: {
      channel: 'phone',
      duration_minutes: 8,
      agent_id: 'agent_12'
    }
  },

  profile_update: {
    customer_id: 'cust_001',
    event_type: 'profile_update',
    timestamp: Math.floor(Date.now() / 1000),
    source_service: 'customer-portal',
    data: {
      updates: {
        phone: '+1-555-0199',
        tags: ['vip', 'tech-savvy', 'warranty-holder']
      },
      notes: 'Customer updated contact information and preferences'
    },
    metadata: {
      source: 'self-service-portal'
    }
  },

  note: {
    customer_id: 'cust_001',
    event_type: 'note',
    timestamp: Math.floor(Date.now() / 1000),
    source_service: 'sales-agent',
    data: {
      title: 'Customer Preference',
      content: 'Prefers to be contacted via email. Available for calls only between 9 AM - 5 PM PST.',
      category: 'preference',
      importance: 'high',
      tags: ['communication', 'scheduling']
    },
    metadata: {
      recorded_by: 'agent_05'
    }
  }
};

async function publishEvent(eventType, customerId) {
  try {
    console.log(`Connecting to NATS server...`);
    const nc = await connect({
      servers: process.env.NATS_SERVERS || 'nats://localhost:4222'
    });

    console.log(`Connected to NATS`);

    // Get event template
    const template = eventTemplates[eventType];
    if (!template) {
      console.error(`Unknown event type: ${eventType}`);
      console.log(`Available types: ${Object.keys(eventTemplates).join(', ')}`);
      await nc.close();
      return;
    }

    // Customize event
    const event = JSON.parse(JSON.stringify(template)); // Deep clone
    if (customerId) {
      event.customer_id = customerId;
      if (event.data) {
        event.data.customer_id = customerId;
      }
    }
    event.timestamp = Math.floor(Date.now() / 1000);

    // Determine subject
    const subject = `customer.events.${event.customer_id}.${event.event_type}`;

    // Publish event
    console.log(`\nPublishing event to subject: ${subject}`);
    console.log('Event data:', JSON.stringify(event, null, 2));

    nc.publish(subject, sc.encode(JSON.stringify(event)));

    console.log(`\n✅ Event published successfully!`);

    // Close connection
    await nc.drain();
    await nc.close();
  } catch (error) {
    console.error('❌ Error publishing event:', error);
    process.exit(1);
  }
}

async function publishAllSamples() {
  console.log('📤 Publishing all sample events...\n');

  for (const eventType of Object.keys(eventTemplates)) {
    console.log(`\n--- Publishing ${eventType} event ---`);
    await publishEvent(eventType, 'cust_001');
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay between events
  }

  console.log('\n✅ All sample events published!');
}

// Parse command line arguments
const args = process.argv.slice(2);
let eventType = 'purchase';
let customerId = null;
let publishAll = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--event' && args[i + 1]) {
    eventType = args[i + 1];
    i++;
  } else if (args[i] === '--customer' && args[i + 1]) {
    customerId = args[i + 1];
    i++;
  } else if (args[i] === '--all') {
    publishAll = true;
  } else if (args[i] === '--help') {
    console.log(`
NATS Test Event Publisher

Usage:
  node test-publisher.js [options]

Options:
  --event <type>      Event type to publish (default: purchase)
  --customer <id>     Customer ID (default: cust_001)
  --all               Publish all sample event types
  --help              Show this help message

Available event types:
  ${Object.keys(eventTemplates).join(', ')}

Examples:
  node test-publisher.js
  node test-publisher.js --event support_ticket
  node test-publisher.js --customer cust_123 --event purchase
  node test-publisher.js --all
    `);
    process.exit(0);
  }
}

// Run
if (publishAll) {
  publishAllSamples().catch(console.error);
} else {
  publishEvent(eventType, customerId).catch(console.error);
}
