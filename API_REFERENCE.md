# CustomerIQ Customer Platform - Complete API Reference

## Overview

CustomerIQ is now a complete customer context platform with:
1. **MCP Tools** - For AI assistants to query customer data
2. **REST API** - For web frontends and external integrations
3. **Web UI** - Interactive dashboard for customer management
4. **NATS Integration** - Event-driven customer profile aggregation
5. **CRM Sync** - Bidirectional integration with Salesforce/HubSpot

---

## MCP Tools (AI Assistant Integration)

### Customer Management Tools

#### `get_customer_context`
Get comprehensive customer context for AI engagement.

**Parameters**:
- `customer_id` (string, optional): Customer ID
- `email` (string, optional): Customer email (alternative to ID)
- `include_events` (boolean, default: true): Include event timeline
- `include_purchases` (boolean, default: true): Include purchase history
- `include_work_orders` (boolean, default: true): Include work orders
- `include_knowledge` (boolean, default: true): Include customer notes
- `events_limit` (number, default: 20): Max events to retrieve
- `purchases_limit` (number, default: 10): Max purchases to retrieve

**Example**:
```javascript
await use_mcp_tool('get_customer_context', {
  email: 'john@example.com',
  include_events: true
});
```

**Returns**:
```
# Customer Context: John Smith

Name: John Smith
Email: john@example.com
Status: active
Lifetime Value: $1,250.00
Customer Since: Jan 15, 2024

Recent Activity:
- Jan 25, 2026: [purchase] Premium Widget ($99.99)
- Jan 20, 2026: [support_ticket] Product Question
...
```

---

#### `search_customers`
Search for customers by name, email, company, or tags.

**Parameters**:
- `query` (string, required): Search query
- `limit` (number, default: 10): Maximum results

**Example**:
```javascript
await use_mcp_tool('search_customers', {
  query: 'john',
  limit: 5
});
```

---

#### `get_customer_timeline`
Get chronological timeline of all customer interactions.

**Parameters**:
- `customer_id` (string, required): Customer ID
- `event_types` (string[], optional): Filter by event types
- `limit` (number, default: 50): Maximum events

**Example**:
```javascript
await use_mcp_tool('get_customer_timeline', {
  customer_id: 'cust_001',
  event_types: ['purchase', 'support_ticket'],
  limit: 20
});
```

---

#### `create_customer_profile`
Create a new customer profile.

**Parameters**:
- `name` (string, required): Customer name
- `email` (string, optional): Customer email
- `phone` (string, optional): Phone number
- `company` (string, optional): Company name
- `status` (string, default: 'active'): active | inactive | vip | at-risk
- `tags` (string[], optional): Tags for categorization
- `custom_fields` (object, optional): Custom key-value pairs

**Example**:
```javascript
await use_mcp_tool('create_customer_profile', {
  name: 'Jane Doe',
  email: 'jane@example.com',
  status: 'active',
  tags: ['premium', 'enterprise']
});
```

---

#### `update_customer_profile`
Update an existing customer profile.

**Parameters**:
- `customer_id` (string, required): Customer ID to update
- `name` (string, optional): Updated name
- `email` (string, optional): Updated email
- `phone` (string, optional): Updated phone
- `company` (string, optional): Updated company
- `status` (string, optional): Updated status
- `tags` (string[], optional): Updated tags
- `custom_fields` (object, optional): Updated custom fields

---

#### `add_customer_note`
Add an important note or observation about a customer.

**Parameters**:
- `customer_id` (string, required): Customer ID
- `content` (string, required): Note content
- `category` (string, default: 'other'): preference | complaint | praise | technical | other
- `importance` (string, default: 'medium'): low | medium | high | critical
- `tags` (string[], optional): Note tags

**Example**:
```javascript
await use_mcp_tool('add_customer_note', {
  customer_id: 'cust_001',
  content: 'Prefers morning appointments between 9-11 AM',
  category: 'preference',
  importance: 'high',
  tags: ['scheduling', 'preferences']
});
```

---

## REST API Endpoints

Base URL: `http://localhost:3000/api`

### Health Check

**GET** `/api/health`

Returns server health status.

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-25T12:00:00.000Z"
}
```

---

### Customers

#### List Customers

**GET** `/api/customers?limit=50&offset=0&status=active`

**Query Parameters**:
- `limit` (number, default: 50): Maximum results
- `offset` (number, default: 0): Pagination offset
- `status` (string, optional): Filter by status

**Response**:
```json
{
  "customers": [
    {
      "id": "cust_001",
      "name": "John Smith",
      "email": "john@example.com",
      "phone": "+1-555-0100",
      "company": "Acme Corp",
      "status": "active",
      "customer_since": 1705276800,
      "lifetime_value": 1250.00,
      "tags": ["vip", "enterprise"],
      "custom_fields": {},
      "created_at": 1705276800,
      "updated_at": 1705356800
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

---

#### Get Customer

**GET** `/api/customers/:customerId`

**Response**:
```json
{
  "customer": {
    "id": "cust_001",
    "name": "John Smith",
    ...
  }
}
```

---

#### Create Customer

**POST** `/api/customers`

**Request Body**:
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "+1-555-0101",
  "company": "TechCo",
  "status": "active",
  "tags": ["premium"],
  "custom_fields": {
    "account_manager": "Sarah"
  }
}
```

**Response**:
```json
{
  "customer": {
    "id": "cust_002",
    "name": "Jane Doe",
    ...
  }
}
```

---

#### Update Customer

**PUT** `/api/customers/:customerId`

**Request Body**:
```json
{
  "status": "vip",
  "tags": ["premium", "enterprise"]
}
```

---

#### Delete Customer

**DELETE** `/api/customers/:customerId`

**Response**:
```json
{
  "message": "Customer deleted successfully"
}
```

---

### Customer Context

#### Get Customer Context

**GET** `/api/customers/:customerId/context?include_events=true&include_purchases=true&include_work_orders=true&include_knowledge=true&events_limit=20&purchases_limit=10`

Returns complete customer context including AI-ready summary.

**Response**:
```json
{
  "context": {
    "customer": { ... },
    "relationship": {
      "duration_days": 365,
      "status": "active",
      "lifetime_value": 1250.00,
      "tags": ["vip"]
    },
    "recent_activity": [ ... ],
    "purchases": {
      "recent": [ ... ],
      "stats": {
        "total_purchases": 15,
        "total_spent": 1250.00,
        "avg_purchase": 83.33
      }
    },
    "work_orders": {
      "recent": [ ... ],
      "open": [ ... ]
    },
    "knowledge": {
      "all": [ ... ],
      "critical": [ ... ]
    },
    "ai_context_summary": "..."
  }
}
```

---

#### Get Customer Timeline

**GET** `/api/customers/:customerId/timeline?limit=50&event_types=purchase,support_ticket`

**Response**:
```json
{
  "timeline": [
    {
      "id": "evt_001",
      "customer_id": "cust_001",
      "event_type": "purchase",
      "event_date": 1705276800,
      "title": "Premium Widget",
      "description": "...",
      "amount": 99.99,
      "status": "completed",
      "metadata": {},
      "source_service": "e-commerce"
    }
  ]
}
```

---

#### Add Customer Note

**POST** `/api/customers/:customerId/notes`

**Request Body**:
```json
{
  "content": "Customer prefers email communication",
  "category": "preference",
  "importance": "high",
  "tags": ["communication"]
}
```

**Response**:
```json
{
  "note": {
    "id": "note_001",
    "customer_id": "cust_001",
    "content": "...",
    "category": "preference",
    "importance": "high",
    "tags": ["communication"],
    "source": "api",
    "created_at": 1705276800,
    "updated_at": 1705276800
  }
}
```

---

### Events

#### Create Event

**POST** `/api/events`

**Request Body**:
```json
{
  "customer_id": "cust_001",
  "event_type": "purchase",
  "timestamp": 1705276800,
  "source_service": "api",
  "data": {
    "title": "Premium Widget Purchase",
    "description": "Customer purchased Premium Widget",
    "product_name": "Premium Widget",
    "total": 99.99,
    "status": "completed"
  },
  "metadata": {
    "payment_method": "credit_card"
  }
}
```

**Response**:
```json
{
  "result": {
    "event_id": "evt_001",
    "purchase_id": "ord_001"
  }
}
```

---

### Search

#### Search Customers

**GET** `/api/search/customers?q=john&limit=10`

**Query Parameters**:
- `q` (string, required): Search query
- `limit` (number, default: 10): Maximum results

**Response**:
```json
{
  "results": [ ... ],
  "total": 5
}
```

---

### Statistics

#### Get Stats

**GET** `/api/stats`

**Response**:
```json
{
  "stats": {
    "customers": {
      "total": 1250,
      "by_status": [
        { "status": "active", "count": 1000 },
        { "status": "vip", "count": 150 },
        { "status": "inactive", "count": 100 }
      ]
    },
    "events": {
      "total": 15000,
      "by_type": [
        { "event_type": "purchase", "count": 5000 },
        { "event_type": "support_ticket", "count": 3000 }
      ]
    },
    "purchases": {
      "total": 5000,
      "total_revenue": 125000.00
    },
    "work_orders": {
      "total": 500,
      "open": 50
    }
  }
}
```

---

## Web UI Usage

Access the web interface at: `http://localhost:3000`

### Features

1. **Customers Tab**
   - Search customers by name, email, company, tags
   - View customer cards with status and lifetime value
   - Click customer to view full context
   - Create new customers

2. **Timeline Tab**
   - Enter customer ID to view chronological event timeline
   - See all interactions: purchases, support tickets, repairs, etc.

3. **Statistics Tab**
   - Overview of total customers, events, revenue
   - Distribution by status, event types
   - Open work orders

4. **Events Tab**
   - Manually publish customer events
   - Select event type: purchase, support, repair, etc.
   - Add title, description, amount

---

## Starting the Services

### Start MCP Server with NATS (Customer Events)

```bash
# Set environment variables
export NATS_ENABLED=true
export NATS_SERVERS=nats://localhost:4222

# Start server
node server/index-sqlite.js
```

### Start REST API Server (Web Frontend)

```bash
# Start API server standalone
node server/apiServer.js

# Or with custom port
API_PORT=8080 node server/apiServer.js
```

Access web UI at: `http://localhost:3000`

---

## CRM Integration

###  Salesforce Integration

```javascript
const CRMIntegration = require('./server/crmIntegration');

const salesforce = new CRMIntegration(db, {
  type: 'salesforce',
  config: {
    loginUrl: 'https://login.salesforce.com',
    instanceUrl: 'https://your-instance.salesforce.com',
    clientId: 'YOUR_CLIENT_ID',
    clientSecret: 'YOUR_CLIENT_SECRET',
    username: 'your@email.com',
    password: 'yourpassword',
    securityToken: 'YOUR_SECURITY_TOKEN'
  },
  syncInterval: 300000 // 5 minutes
});

// Start automatic sync
salesforce.startSync();

// Manually sync from Salesforce
await salesforce.syncFromCRM();

// Push customer to Salesforce
await salesforce.pushToCRM('cust_001');
```

### HubSpot Integration

```javascript
const hubspot = new CRMIntegration(db, {
  type: 'hubspot',
  config: {
    apiKey: 'YOUR_HUBSPOT_API_KEY'
  },
  syncInterval: 300000
});

hubspot.startSync();
```

### Generic API Integration

```javascript
const genericCRM = new CRMIntegration(db, {
  type: 'generic',
  config: {
    apiUrl: 'https://your-crm.com',
    apiKey: 'YOUR_API_KEY',
    customersEndpoint: '/api/v1/customers',
    updateMethod: 'PUT',
    authHeader: 'Bearer YOUR_API_KEY',
    fieldMap: {
      id: 'customer_id',
      name: 'full_name',
      email: 'email_address',
      phone: 'phone_number',
      company: 'company_name',
      status: 'account_status',
      lifetime_value: 'total_value'
    }
  }
});

genericCRM.startSync();
```

---

## Example: Complete AI Customer Support Flow

```javascript
// 1. Customer calls/messages
const customerEmail = 'john@example.com';

// 2. AI retrieves customer context
const context = await use_mcp_tool('get_customer_context', {
  email: customerEmail,
  include_events: true,
  include_knowledge: true
});

// 3. AI receives full context:
/*
Customer: John Smith
Status: VIP | LTV: $1,250.00
Recent Activity: 15 purchases, 2 open support tickets
Important Notes:
- Prefers morning appointments
- Has extended warranty through 2026
- VIP customer since Jan 2024
*/

// 4. AI provides context-aware response:
"Hi John! I see you're a valued VIP customer with us since January 2024.
I notice you have 2 open support tickets. Let me help you with those first..."

// 5. AI logs the interaction
await use_mcp_tool('add_customer_note', {
  customer_id: 'cust_001',
  content: 'Customer called about extended warranty renewal pricing',
  category: 'inquiry',
  importance: 'medium'
});
```

---

## Environment Variables

### NATS Configuration
```bash
NATS_ENABLED=true
NATS_SERVERS=nats://localhost:4222
NATS_SUBJECTS=customer.events.>
NATS_QUEUE_GROUP=contextiq-service
NATS_AUTO_CREATE_CUSTOMER=true
NATS_SUMMARIZE_THRESHOLD=500
```

### API Server Configuration
```bash
API_PORT=3000
```

---

## Database Tables

### customers
- `id` - Primary key
- `name` - Customer name
- `email` - Email address
- `phone` - Phone number
- `company` - Company name
- `status` - active | inactive | vip | at-risk
- `customer_since` - Unix timestamp
- `lifetime_value` - Total value
- `tags` - JSON array
- `custom_fields` - JSON object
- `created_at`, `updated_at` - Timestamps

### customer_events
- `id` - Primary key
- `customer_id` - Foreign key
- `event_type` - Type of event
- `event_date` - Unix timestamp
- `title` - Event title
- `description` - Event description
- `amount` - Dollar amount (if applicable)
- `status` - Event status
- `metadata` - JSON object
- `source_service` - Originating service
- `raw_event_data` - Original event

### purchases, work_orders, customer_knowledge
See NATS_INTEGRATION.md for full schema details.

---

## Support

For issues or questions:
- GitHub: https://github.com/anthropics/CustomerIQ/issues
- Documentation: See NATS_INTEGRATION.md for event integration details

---

**Version**: 2.0.0
**Last Updated**: January 2026
