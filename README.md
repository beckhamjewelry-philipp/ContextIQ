# CustomerIQ Customer Context Platform

**A standalone, production-ready customer context platform for AI-powered customer service and CRM integration.**

CustomerIQ aggregates customer information from multiple sources (events, purchases, support tickets, work orders) into a unified context that AI assistants and web frontends can query. Built on the Model Context Protocol (MCP), it provides a complete solution for customer knowledge management.

## 🌟 Features

- **Unified Console Application** - Single application serving all services
- **Multi-Database Support** - SQLite for single instances, MS SQL for horizontal scaling
- **MCP Integration** - 20+ tools for AI assistants to query customer context
- **REST API** - Complete HTTP API for web frontends and integrations
- **DevOps Control Interface** - Production-grade management and monitoring API
- **Web UI** - Modern dashboard for customer management
- **NATS Event Integration** - Automatic profile aggregation from microservices
- **CRM Sync** - Bidirectional integration with Salesforce, HubSpot, and custom CRMs
- **Horizontal Scaling** - Multiple instances with shared MS SQL database

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│              CustomerIQ Application (app.js)            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  MCP      REST API    NATS       CRM      DevOps       │
│ (stdio)  (HTTP:3000) (Events)   (Sync)  (HTTP:9000)    │
│   │          │          │          │          │         │
│   └──────────┴──────────┴──────────┴──────────┘         │
│                         │                               │
│              Database Provider Layer                    │
│         (SQLite for single / MS SQL for multi)          │
└─────────────────────────────────────────────────────────┘
```

### Components

1. **Database Layer**
   - Abstraction layer supporting SQLite and MS SQL
   - Schema: customers, events, purchases, work_orders, knowledge
   - Full-text search with FTS5 indexes

2. **MCP Server**
   - 20+ tools for AI assistant integration
   - Customer context retrieval
   - Knowledge management
   - Event processing

3. **REST API Server**
   - Customer CRUD operations
   - Context and timeline endpoints
   - Search and statistics
   - Static file serving for web UI

4. **NATS Subscriber**
   - Event consumption from microservices
   - Queue groups for load balancing
   - Auto-customer creation
   - 7+ event types supported

5. **CRM Integration**
   - Salesforce OAuth integration
   - HubSpot API key integration
   - Generic REST API support
   - Scheduled bidirectional sync

6. **DevOps Control Interface**
   - Health monitoring and metrics
   - Real-time log streaming
   - Configuration management
   - Runtime control (start/stop/restart)
   - Production-grade management API

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm 8+
- (Optional) Docker for NATS
- (Optional) MS SQL Server for scaling

### Installation

1. **Clone and install dependencies**:
   ```bash
   git clone <repository-url>
   cd CustomerIQ
   ./build.sh
   ```

2. **Configure the application**:
   ```bash
   # Copy config template
   cp config.env.example config.env

   # Edit configuration
   nano config.env
   ```

3. **Start the application**:
   ```bash
   # Using startup script (recommended)
   ./start.sh  # or start.bat on Windows

   # Or directly with npm
   cd server
   npm start
   ```

4. **Access the services**:
   - Web UI: http://localhost:3000
   - MCP: Available via stdio for AI assistants
   - API: http://localhost:3000/api/
   - Control API: http://localhost:9000

## ⚙️ Configuration

All configuration is done via `config.env` file:

```bash
# Database Configuration
DB_PROVIDER=sqlite              # 'sqlite' or 'mssql'
SQLITE_PATH=~/.customeriq/customeriq.db

# For multi-instance scaling with MS SQL
# DB_PROVIDER=mssql
# MSSQL_SERVER=localhost
# MSSQL_PORT=1433
# MSSQL_DATABASE=CustomerIQ
# MSSQL_USER=customeriq_user
# MSSQL_PASSWORD=your_password

# Service Configuration
MCP_ENABLED=true               # MCP Server for AI
API_ENABLED=true               # REST API Server
API_PORT=3000

# NATS Event Integration
NATS_ENABLED=false             # Enable NATS subscriber
NATS_SERVERS=nats://localhost:4222
NATS_SUBJECTS=customer.events.>
NATS_QUEUE_GROUP=customeriq-service

# CRM Integration
CRM_ENABLED=false              # Enable CRM sync
CRM_TYPE=salesforce            # 'salesforce', 'hubspot', or 'generic'
CRM_SYNC_INTERVAL=300000       # 5 minutes

# DevOps Control Interface
CONTROL_ENABLED=true           # Enable DevOps control API
CONTROL_PORT=9000              # Control API port
```

See `config.env.example` for all available options.

## 📖 Usage

### 1. Using MCP Tools (AI Assistants)

Configure in Claude Desktop or MCP client:

```json
{
  "mcpServers": {
    "customeriq": {
      "command": "node",
      "args": ["/path/to/CustomerIQ/server/app.js"]
    }
  }
}
```

Example MCP tool usage:

```javascript
// Get comprehensive customer context
get_customer_context({
  email: "customer@example.com",
  include_events: true,
  include_purchases: true,
  include_work_orders: true
})

// Search customers
search_customers({
  query: "enterprise vip customers",
  limit: 10
})

// Create customer profile
create_customer_profile({
  name: "John Doe",
  email: "john@example.com",
  company: "Acme Corp",
  status: "vip",
  tags: ["enterprise", "premium"]
})
```

### 2. Using REST API

```bash
# Get customer context
curl http://localhost:3000/api/customers/cust_001/context

# Search customers
curl "http://localhost:3000/api/search/customers?q=enterprise"

# Create event
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "cust_001",
    "event_type": "purchase",
    "amount": 1299.99,
    "product": "Enterprise License"
  }'

# Get statistics
curl http://localhost:3000/api/stats
```

See `API_REFERENCE.md` for complete API documentation.

### 3. Using Web UI

Open http://localhost:3000 in your browser to access:

- Customer search and management
- Event timeline visualization
- Statistics dashboard
- Event creation interface

### 4. NATS Event Integration

Publish customer events from your microservices:

```javascript
// Node.js example
const { connect } = require('nats');

const nc = await connect({ servers: 'nats://localhost:4222' });

// Publish purchase event
nc.publish('customer.events.purchase', JSON.stringify({
  customer_id: 'cust_001',
  event_type: 'purchase',
  amount: 1299.99,
  product: 'Enterprise License',
  timestamp: Math.floor(Date.now() / 1000)
}));
```

See `NATS_INTEGRATION.md` for integration examples in multiple languages.

### 5. Using DevOps Control Interface

Monitor and manage CustomerIQ instances:

```bash
# Health check
curl http://localhost:9000/health

# Get application info
curl http://localhost:9000/info

# View logs
curl http://localhost:9000/logs?limit=100

# Stream logs in real-time
curl -N http://localhost:9000/logs/stream

# Get metrics
curl http://localhost:9000/metrics

# Restart application
curl -X POST http://localhost:9000/control/restart
```

See `DEVOPS_CONTROL_API.md` for complete documentation.

## 📊 Deployment

### Single Instance (SQLite)

Perfect for development or small deployments:

```bash
# config.env
DB_PROVIDER=sqlite
SQLITE_PATH=~/.customeriq/customeriq.db

# Start
./start.sh
```

### Multi-Instance (MS SQL)

For production with horizontal scaling:

1. **Setup MS SQL Server**:
   ```sql
   CREATE DATABASE CustomerIQ;
   CREATE LOGIN customeriq_user WITH PASSWORD = 'SecurePassword123!';
   USE CustomerIQ;
   CREATE USER customeriq_user FOR LOGIN customeriq_user;
   ALTER ROLE db_owner ADD MEMBER customeriq_user;
   ```

2. **Configure instances**:
   ```bash
   # config.env (same on all instances)
   DB_PROVIDER=mssql
   MSSQL_SERVER=sql.example.com
   MSSQL_PORT=1433
   MSSQL_DATABASE=CustomerIQ
   MSSQL_USER=customeriq_user
   MSSQL_PASSWORD=SecurePassword123!

   # NATS queue group for load balancing
   NATS_ENABLED=true
   NATS_QUEUE_GROUP=customeriq-service
   ```

3. **Start multiple instances**:
   ```bash
   # Instance 1
   ./start.sh

   # Instance 2
   API_PORT=3001 ./start.sh

   # Instance 3
   API_PORT=3002 ./start.sh
   ```

4. **Setup load balancer** (nginx, HAProxy, etc.)

See `DEPLOYMENT_GUIDE.md` for complete production deployment instructions.

## 🔌 Integration Examples

### Salesforce Integration

```bash
# config.env
CRM_ENABLED=true
CRM_TYPE=salesforce
SALESFORCE_CLIENT_ID=your_client_id
SALESFORCE_CLIENT_SECRET=your_client_secret
SALESFORCE_USERNAME=your@email.com
SALESFORCE_PASSWORD=your_password
SALESFORCE_SECURITY_TOKEN=your_token
```

### HubSpot Integration

```bash
# config.env
CRM_ENABLED=true
CRM_TYPE=hubspot
HUBSPOT_API_KEY=your_api_key
```

### Generic REST API

```bash
# config.env
CRM_ENABLED=true
CRM_TYPE=generic
CRM_API_URL=https://your-crm.com
CRM_API_KEY=your_api_key
CRM_CUSTOMERS_ENDPOINT=/api/v1/customers
```

## 🧪 Testing

### Test NATS Integration

```bash
# Start NATS
docker run -d -p 4222:4222 nats:latest

# Enable NATS in config.env
NATS_ENABLED=true

# Start CustomerIQ
./start.sh

# Publish test events
node server/test-publisher.js --all
```

### Test API

```bash
# Health check
curl http://localhost:3000/api/health

# Get stats
curl http://localhost:3000/api/stats
```

## 📚 Documentation

- **API Reference**: `API_REFERENCE.md` - Complete MCP tools and REST API documentation
- **NATS Integration**: `NATS_INTEGRATION.md` - Event schema and integration examples
- **Deployment Guide**: `DEPLOYMENT_GUIDE.md` - Production deployment and scaling
- **Customer Platform**: `CUSTOMER_PLATFORM_README.md` - Platform overview and use cases
- **DevOps Control**: `DEVOPS_CONTROL_API.md` - Management and monitoring API reference

## 🔧 Development

```bash
# Install dependencies
./build.sh

# Start in development mode
cd server
npm start

# Run with specific configuration
DB_PROVIDER=sqlite API_PORT=3000 npm start
```

## 🛠️ Tools Reference

### Customer Management Tools
- `get_customer_context` - Get comprehensive customer profile for AI
- `search_customers` - Full-text customer search
- `get_customer_timeline` - Get chronological event history
- `create_customer_profile` - Create new customer
- `update_customer_profile` - Update customer information
- `add_customer_note` - Add important customer notes

### Knowledge Management Tools (Original)
- `store-knowledge` - Store knowledge entries
- `retrieve-knowledge` - Search knowledge base
- `manage-knowledge` - Update/delete entries
- `get-all-scopes` - List all scopes
- `get-scope-stats` - Get statistics per scope
- And 15+ more tools

See `API_REFERENCE.md` for complete tool documentation.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- 📚 Documentation: `docs/` folder
- 🐛 Issues: GitHub Issues
- 💬 Discussions: GitHub Discussions

## 🗺️ Roadmap

- [x] Customer context platform
- [x] NATS event integration
- [x] REST API and web UI
- [x] CRM integration (Salesforce, HubSpot)
- [x] Multi-database support (SQLite, MS SQL)
- [x] Horizontal scaling support
- [ ] Vector embeddings for semantic search
- [ ] LLM-powered event summarization
- [ ] Advanced analytics dashboard
- [ ] Webhook support for real-time integrations
- [ ] Multi-tenant support
- [ ] GraphQL API
