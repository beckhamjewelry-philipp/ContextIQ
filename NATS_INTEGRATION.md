# CustomerIQ NATS Integration

## Customer Context Platform with Event-Driven Architecture

CustomerIQ now supports **automatic customer profile aggregation** through NATS messaging. Microservices across your infrastructure can publish customer events to NATS, and CustomerIQ automatically stores them in comprehensive customer profiles.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Microservices Ecosystem                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ E-Commerce   │  │ Support      │  │ Billing      │      │
│  │ Service      │  │ System       │  │ Service      │ ...  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│         └──────────────────┼──────────────────┘              │
│                            │ Publish Events                  │
└────────────────────────────┼─────────────────────────────────┘
                             ↓
                    ┌────────────────┐
                    │  NATS Server   │
                    │  (Message Bus) │
                    └────────┬───────┘
                             │ Subscribe: customer.events.>
                             ↓
                    ┌────────────────────────┐
                    │  CustomerIQ Service    │
                    │  - NATS Subscriber     │
                    │  - Event Processor     │
                    │  - Customer DB         │
                    └────────┬───────────────┘
                             │
                             ↓
        ┌─────────────────────────────────────────────┐
        │      SQLite Customer Profile Database       │
        ├─────────────────────────────────────────────┤
        │ • Customers                                 │
        │ • Customer Events (timeline)                │
        │ • Purchases                                 │
        │ • Work Orders / Repairs                     │
        │ • Customer Knowledge / Notes                │
        │ • Full-text search (FTS5)                   │
        └─────────────────────────────────────────────┘
```

---

## Features

### ✅ Automatic Event Ingestion
- Subscribe to NATS subjects using wildcard patterns
- Queue groups for load balancing across multiple instances
- Automatic reconnection and error handling
- Real-time event processing

### ✅ Comprehensive Customer Profiles
- **Customer metadata**: Name, email, phone, company, status, lifetime value
- **Event timeline**: Chronological history of all interactions
- **Purchase history**: Products, amounts, warranties
- **Work orders**: Repairs, service requests, technical issues
- **Customer knowledge**: Preferences, notes, important information

### ✅ Intelligent Event Processing
- **Auto-create customers**: Profiles created automatically from events
- **Event summarization**: Long descriptions can be auto-summarized
- **Relationship tracking**: Links events to customers and related records
- **Full-text search**: Fast retrieval across all customer data

### ✅ Event Types Supported

| Event Type | Description | Creates |
|------------|-------------|---------|
| `purchase` | Customer purchase/order | Purchase record + Event |
| `support_ticket` | Customer support request | Event + Knowledge (if important) |
| `repair` / `work_order` | Repair or service request | Work Order + Event |
| `contact` | General customer contact | Event |
| `profile_update` | Customer profile changes | Updates customer record |
| `note` / `observation` | Important customer notes | Knowledge entry + Event |
| Custom types | Any other event type | Generic event record |

---

## Quick Start

### 1. Install NATS Server

```bash
# Using Docker
docker run -d --name nats -p 4222:4222 -p 8222:8222 nats:latest

# Or install locally (macOS)
brew install nats-server
nats-server

# Or install locally (Linux)
# Download from https://github.com/nats-io/nats-server/releases
```

### 2. Configure CustomerIQ

Create `.env` file in the `server/` directory:

```bash
# Copy example configuration
cp .env.example .env

# Edit configuration
NATS_ENABLED=true
NATS_SERVERS=nats://localhost:4222
NATS_SUBJECTS=customer.events.>
NATS_QUEUE_GROUP=customeriq-service
NATS_AUTO_CREATE_CUSTOMER=true
```

### 3. Start CustomerIQ Server

```bash
# Set environment variables
export NATS_ENABLED=true
export NATS_SERVERS=nats://localhost:4222

# Start server
node server/index-sqlite.js
```

You should see:
```
[NATS] Starting NATS subscriber service...
[NATS] Connected successfully
[NATS] Subscribing to: customer.events.>
[NATS] Service started successfully
```

### 4. Test with Sample Events

```bash
# Publish a single purchase event
node server/test-publisher.js --event purchase

# Publish a support ticket
node server/test-publisher.js --event support_ticket

# Publish all sample event types
node server/test-publisher.js --all

# Publish event for specific customer
node server/test-publisher.js --customer cust_999 --event purchase
```

---

## Event Schema

### Standard Event Format

All events published to NATS should follow this schema:

```json
{
  "customer_id": "cust_001",
  "event_type": "purchase",
  "timestamp": 1734134400,
  "source_service": "e-commerce-service",
  "data": {
    "// Event-specific fields"
  },
  "metadata": {
    "// Optional metadata"
  }
}
```

### Required Fields

- `customer_id` (string): Unique customer identifier OR
- `data.email` (string): Customer email (for auto-lookup/creation)
- `event_type` (string): Type of event
- `timestamp` (number): Unix timestamp in seconds
- `source_service` (string): Service that generated the event

### Purchase Event Example

```json
{
  "customer_id": "cust_001",
  "event_type": "purchase",
  "timestamp": 1734134400,
  "source_service": "e-commerce-service",
  "data": {
    "purchase_id": "ord_12345",
    "product_name": "Wireless Headphones Pro",
    "product_sku": "WHP-2000",
    "quantity": 1,
    "price": 299.99,
    "total": 299.99,
    "warranty_expires": 1765670400,
    "customer_name": "John Smith",
    "email": "john.smith@example.com"
  },
  "metadata": {
    "session_id": "sess_abc123",
    "payment_method": "credit_card"
  }
}
```

### Support Ticket Event Example

```json
{
  "customer_id": "cust_001",
  "event_type": "support_ticket",
  "timestamp": 1734220800,
  "source_service": "support-system",
  "data": {
    "ticket_id": "TKT-5678",
    "title": "Product not working",
    "description": "Bluetooth pairing is inconsistent...",
    "status": "open",
    "priority": "high",
    "category": "technical",
    "important": true,
    "save_as_memory": true
  },
  "metadata": {
    "channel": "email"
  }
}
```

### Work Order Event Example

```json
{
  "customer_id": "cust_001",
  "event_type": "repair",
  "timestamp": 1734307200,
  "source_service": "repair-service",
  "data": {
    "work_order_id": "WO-9999",
    "order_type": "repair",
    "issue_description": "Bluetooth module needs replacement",
    "status": "open",
    "priority": "medium",
    "assigned_to": "technician_05",
    "product_id": "WHP-2000"
  }
}
```

---

## NATS Subject Structure

CustomerIQ subscribes to customer events using wildcard patterns:

### Subject Patterns

```
customer.events.>                    → Matches all customer events
customer.events.{customer_id}.>      → Events for specific customer
customer.events.*.{event_type}       → Specific event type across all customers
```

### Publishing Events

Microservices should publish to structured subjects:

```
customer.events.cust_001.purchase
customer.events.cust_001.support_ticket
customer.events.cust_001.repair
customer.events.cust_002.contact
```

**Pattern**: `customer.events.{customer_id}.{event_type}`

---

## Configuration Options

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NATS_ENABLED` | `false` | Enable/disable NATS integration |
| `NATS_SERVERS` | `nats://localhost:4222` | NATS server URLs (comma-separated) |
| `NATS_SUBJECTS` | `customer.events.>` | Subjects to subscribe to (comma-separated) |
| `NATS_QUEUE_GROUP` | `customeriq-service` | Queue group for load balancing |
| `NATS_SUMMARIZE_THRESHOLD` | `500` | Character threshold for auto-summarization |
| `NATS_AUTO_CREATE_CUSTOMER` | `true` | Auto-create customer profiles from events |

### High Availability Setup

```bash
# Multiple NATS servers for failover
NATS_SERVERS=nats://server1:4222,nats://server2:4222,nats://server3:4222

# Multiple subjects
NATS_SUBJECTS=customer.events.>,billing.events.>,support.events.>

# Multiple CustomerIQ instances with same queue group (load balancing)
# Instance 1:
NATS_QUEUE_GROUP=customeriq-cluster

# Instance 2:
NATS_QUEUE_GROUP=customeriq-cluster
```

---

## Integration Examples

### Node.js Microservice

```javascript
const { connect, StringCodec } = require('nats');

async function publishCustomerEvent(customerId, eventType, data) {
  const nc = await connect({ servers: 'nats://localhost:4222' });
  const sc = StringCodec();

  const event = {
    customer_id: customerId,
    event_type: eventType,
    timestamp: Math.floor(Date.now() / 1000),
    source_service: 'my-service',
    data: data,
    metadata: {}
  };

  const subject = `customer.events.${customerId}.${eventType}`;
  nc.publish(subject, sc.encode(JSON.stringify(event)));

  await nc.drain();
}

// Example usage
await publishCustomerEvent('cust_123', 'purchase', {
  purchase_id: 'ord_456',
  product_name: 'Premium Widget',
  total: 99.99,
  email: 'customer@example.com'
});
```

### Python Microservice

```python
import asyncio
import json
import time
from nats.aio.client import Client as NATS

async def publish_customer_event(customer_id, event_type, data):
    nc = NATS()
    await nc.connect("nats://localhost:4222")

    event = {
        "customer_id": customer_id,
        "event_type": event_type,
        "timestamp": int(time.time()),
        "source_service": "my-python-service",
        "data": data,
        "metadata": {}
    }

    subject = f"customer.events.{customer_id}.{event_type}"
    await nc.publish(subject, json.dumps(event).encode())
    await nc.drain()

# Example usage
asyncio.run(publish_customer_event('cust_123', 'support_ticket', {
    'ticket_id': 'TKT-789',
    'title': 'Need help',
    'description': 'Customer needs assistance',
    'priority': 'high'
}))
```

### Go Microservice

```go
package main

import (
    "encoding/json"
    "time"
    "github.com/nats-io/nats.go"
)

type CustomerEvent struct {
    CustomerID    string                 `json:"customer_id"`
    EventType     string                 `json:"event_type"`
    Timestamp     int64                  `json:"timestamp"`
    SourceService string                 `json:"source_service"`
    Data          map[string]interface{} `json:"data"`
    Metadata      map[string]interface{} `json:"metadata"`
}

func publishCustomerEvent(nc *nats.Conn, customerId, eventType string, data map[string]interface{}) error {
    event := CustomerEvent{
        CustomerID:    customerId,
        EventType:     eventType,
        Timestamp:     time.Now().Unix(),
        SourceService: "my-go-service",
        Data:          data,
        Metadata:      make(map[string]interface{}),
    }

    eventJSON, _ := json.Marshal(event)
    subject := "customer.events." + customerId + "." + eventType

    return nc.Publish(subject, eventJSON)
}

func main() {
    nc, _ := nats.Connect(nats.DefaultURL)
    defer nc.Close()

    publishCustomerEvent(nc, "cust_123", "contact", map[string]interface{}{
        "title":   "Customer inquiry",
        "message": "When will my order arrive?",
    })
}
```

---

## Database Schema

### Customers Table
```sql
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  status TEXT DEFAULT 'active',
  customer_since INTEGER NOT NULL,
  lifetime_value REAL DEFAULT 0,
  tags TEXT,              -- JSON array
  custom_fields TEXT,     -- JSON object
  created_at INTEGER,
  updated_at INTEGER
);
```

### Customer Events Table
```sql
CREATE TABLE customer_events (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_date INTEGER NOT NULL,
  title TEXT,
  description TEXT,
  amount REAL,
  status TEXT,
  metadata TEXT,
  agent_notes TEXT,
  source_service TEXT,
  raw_event_data TEXT,    -- Original NATS event
  created_at INTEGER,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);
```

### Purchases Table
```sql
CREATE TABLE purchases (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  product_sku TEXT,
  quantity INTEGER,
  price REAL,
  total REAL,
  purchase_date INTEGER,
  warranty_expires INTEGER,
  metadata TEXT,
  created_at INTEGER,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);
```

### Work Orders Table
```sql
CREATE TABLE work_orders (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  order_type TEXT NOT NULL,
  issue_description TEXT,
  resolution TEXT,
  status TEXT,
  priority TEXT,
  assigned_to TEXT,
  created_date INTEGER,
  completed_date INTEGER,
  cost REAL,
  metadata TEXT,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);
```

### Customer Knowledge Table
```sql
CREATE TABLE customer_knowledge (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  importance TEXT,
  tags TEXT,
  source TEXT,
  created_at INTEGER,
  updated_at INTEGER,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);
```

---

## Monitoring & Debugging

### Check NATS Connection Status

```bash
# View NATS server info
curl http://localhost:8222/varz

# View connections
curl http://localhost:8222/connz

# View subscriptions
curl http://localhost:8222/subsz
```

### CustomerIQ Logs

The server logs NATS activity to stderr:

```
[NATS] Connecting to NATS server(s): nats://localhost:4222
[NATS] Connected successfully
[NATS] Subscribing to: customer.events.> (queue: contextiq-service)
[NATS] Received event on customer.events.cust_001.purchase: purchase cust_001
[EventProcessor] Processed purchase for customer cust_001: ord_12345
```

### Query Customer Data

You can directly query the SQLite database:

```bash
# Open database
sqlite3 ~/.customeriq/customeriq.db

# List customers
SELECT * FROM customers;

# Get customer timeline
SELECT event_type, title, event_date FROM customer_events
WHERE customer_id = 'cust_001'
ORDER BY event_date DESC;

# Get purchase history
SELECT product_name, total, purchase_date FROM purchases
WHERE customer_id = 'cust_001';
```

---

## Troubleshooting

### NATS Connection Failed

```
[NATS] Failed to connect: connect ECONNREFUSED
```

**Solution**: Ensure NATS server is running:
```bash
docker run -d -p 4222:4222 nats:latest
```

### No Events Being Received

1. Check if NATS is enabled: `NATS_ENABLED=true`
2. Verify subject pattern matches your published events
3. Check NATS server subscriptions:
   ```bash
   curl http://localhost:8222/subsz
   ```

### Customer Not Auto-Created

Ensure event has either:
- `customer_id` field, OR
- `data.email` or `data.customer_email` field

And `NATS_AUTO_CREATE_CUSTOMER=true` is set.

---

## Performance Considerations

### Scalability

- **Queue Groups**: Multiple CustomerIQ instances can share the same queue group for load balancing
- **Batch Processing**: Events are processed asynchronously to avoid blocking
- **SQLite WAL Mode**: Enables concurrent reads during writes
- **FTS5 Indexing**: Fast full-text search across millions of records

### Resource Usage

- **Memory**: ~50-100 MB per CustomerIQ instance
- **CPU**: Minimal (event-driven, not polling)
- **Disk**: SQLite database grows with customer data (~1KB per event average)

### Best Practices

1. **Use queue groups** for horizontal scaling
2. **Set appropriate summarization threshold** to control storage size
3. **Monitor database size** and archive old events if needed
4. **Use specific subject patterns** instead of wildcards when possible
5. **Include customer email** in events for automatic profile creation

---

## Roadmap

### Planned Features

- [ ] AI-powered event summarization using LLM integration
- [ ] Customer context retrieval API for AI assistants
- [ ] Real-time customer profile updates via WebSocket
- [ ] Data export to external CRMs (Salesforce, HubSpot)
- [ ] Advanced analytics and customer insights
- [ ] Event replay and audit logging
- [ ] Multi-tenant support with isolated customer databases

---

## License

Part of the CustomerIQ project.
