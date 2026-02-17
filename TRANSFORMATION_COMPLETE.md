# CustomerIQ Transformation Complete

## What Was Accomplished

CustomerIQ has been successfully transformed from a code knowledge management system into a **production-ready, standalone customer context platform** with horizontal scaling capabilities.

## Key Changes

### 1. Unified Standalone Application (`server/app.js`)

**Before**: Separate processes for MCP server, API server, NATS subscriber, CRM sync
**After**: Single console application that orchestrates all services

```bash
# Start everything with one command
./start.sh  # or npm start in server/
```

### 2. Multi-Database Support

**New Database Abstraction Layer**:
- `server/database/DatabaseProvider.js` - Abstract interface
- `server/database/SQLiteProvider.js` - Single-instance implementation
- `server/database/MSSQLProvider.js` - Multi-instance with MS SQL

**Benefits**:
- Development: Use SQLite (no external dependencies)
- Production: Use MS SQL for horizontal scaling
- Switch between databases with one config change

### 3. Horizontal Scaling Architecture

**Single Instance (SQLite)**:
```bash
DB_PROVIDER=sqlite
./start.sh
```

**Multiple Instances (MS SQL + NATS Queue Groups)**:
```bash
# Instance 1
DB_PROVIDER=mssql ./start.sh

# Instance 2
DB_PROVIDER=mssql API_PORT=3001 ./start.sh

# Instance 3
DB_PROVIDER=mssql API_PORT=3002 ./start.sh
```

All instances share:
- Same MS SQL database
- NATS queue group for load balancing
- Synchronized customer data

## Application Architecture

```
 CustomerIQ Application (app.js)
│
├── Database Provider Layer
│   ├── SQLiteProvider (single instance)
│   └── MSSQLProvider (multi-instance)
│
├── MCP Server (stdio)
│   ├── 6 customer management tools
│   └── 15+ knowledge management tools
│
├── REST API Server (HTTP:3000)
│   ├── Customer CRUD endpoints
│   ├── Context & timeline endpoints
│   ├── Event processing endpoints
│   ├── Search & statistics
│   └── Static web UI serving
│
├── NATS Subscriber (optional)
│   ├── Event consumption from microservices
│   ├── Queue groups for load balancing
│   └── Auto-customer profile creation
│
└── CRM Integration (optional)
    ├── Salesforce OAuth sync
    ├── HubSpot API sync
    └── Generic REST API sync
```

## File Structure

### Core Application
- `server/app.js` - Main entry point (unified console app)
- `server/package.json` - Updated to use app.js
- `config.env.example` - Complete configuration template
- `start.sh` / `start.bat` - Cross-platform startup scripts
- `build.sh` / `build.bat` - Dependency installation scripts

### Database Layer
- `server/database/DatabaseProvider.js` - Abstract provider interface
- `server/database/SQLiteProvider.js` - SQLite implementation
- `server/database/MSSQLProvider.js` - MS SQL implementation
- `server/customerSchema.js` - Customer tables schema

### Customer Platform
- `server/customerContextBuilder.js` - Context aggregation engine
- `server/eventProcessor.js` - Event processing with 7+ types
- `server/apiServer.js` - REST API (updated for database providers)
- `server/natsSubscriber.js` - NATS event subscriber
- `server/crmIntegration.js` - Salesforce/HubSpot/Generic CRM sync

### Web Frontend
- `server/public/index.html` - Customer management dashboard
- `server/public/app.js` - Frontend application
- `server/public/styles.css` - Responsive styling

### Documentation
- `README.md` - Main documentation (updated)
- `DEPLOYMENT_GUIDE.md` - Production deployment guide
- `API_REFERENCE.md` - Complete MCP tools and REST API reference
- `NATS_INTEGRATION.md` - Event integration guide
- `CUSTOMER_PLATFORM_README.md` - Platform overview

## Quick Start

### 1. Install Dependencies

```bash
./build.sh  # or build.bat on Windows
```

### 2. Configure

```bash
cp config.env.example config.env
nano config.env
```

### 3. Start Application

```bash
./start.sh  # or start.bat on Windows
```

### 4. Access Services

- **Web UI**: http://localhost:3000
- **API**: http://localhost:3000/api/
- **MCP**: Configure in Claude Desktop:

```json
{
  "mcpServers": {
    "customeriq": {
      "command": "node",
      "args": ["C:/Users/PhilippBecker/src/CustomerIQ/server/app.js"]
    }
  }
}
```

## Configuration Examples

### Development (SQLite)

```bash
# config.env
DB_PROVIDER=sqlite
SQLITE_PATH=~/.customeriq/customeriq.db
MCP_ENABLED=true
API_ENABLED=true
API_PORT=3000
NATS_ENABLED=false
CRM_ENABLED=false
```

### Production (MS SQL + NATS + CRM)

```bash
# config.env
DB_PROVIDER=mssql
MSSQL_SERVER=sql.production.com
MSSQL_PORT=1433
MSSQL_DATABASE=CustomerIQ
MSSQL_USER=customeriq_user
MSSQL_PASSWORD=SecurePassword123!
MSSQL_ENCRYPT=true

MCP_ENABLED=true
API_ENABLED=true
API_PORT=3000

NATS_ENABLED=true
NATS_SERVERS=nats://nats.production.com:4222
NATS_SUBJECTS=customer.events.>
NATS_QUEUE_GROUP=customeriq-service

CRM_ENABLED=true
CRM_TYPE=salesforce
SALESFORCE_CLIENT_ID=your_client_id
SALESFORCE_CLIENT_SECRET=your_client_secret
SALESFORCE_USERNAME=your@email.com
SALESFORCE_PASSWORD=your_password
SALESFORCE_SECURITY_TOKEN=your_token
```

## Testing

### Test the API

```bash
# Health check
curl http://localhost:3000/api/health

# Get statistics
curl http://localhost:3000/api/stats
```

### Test NATS Integration

```bash
# 1. Start NATS
docker run -d -p 4222:4222 nats:latest

# 2. Enable NATS in config.env
NATS_ENABLED=true

# 3. Start CustomerIQ
./start.sh

# 4. Publish test events
node server/test-publisher.js --all

# 5. View in web UI
open http://localhost:3000
```

### Test MCP Tools

Use Claude Desktop or any MCP client to test the tools:

```javascript
// Get customer context
get_customer_context({ email: "customer@example.com" })

// Search customers
search_customers({ query: "enterprise" })

// Create customer
create_customer_profile({
  name: "John Doe",
  email: "john@example.com",
  status: "vip"
})
```

## Customer Data Model

### Tables Created

1. **customers** - Customer profiles
   - id, name, email, phone, company, status
   - customer_since, lifetime_value, tags, custom_fields

2. **customer_events** - Event history
   - id, customer_id, event_type, summary, metadata
   - source_service, timestamp

3. **purchases** - Purchase records
   - id, customer_id, product/service, amount
   - status, purchase_date

4. **work_orders** - Service/repair work
   - id, customer_id, work_type, description
   - status, priority, assigned_to

5. **customer_knowledge** - Important notes
   - id, customer_id, content, category
   - importance, tags, source

All tables have full-text search (FTS5) enabled for fast lookups.

## Event Types Supported

The system processes 7+ event types:

1. **purchase** - Product/service purchases
2. **support_ticket** - Customer support interactions
3. **repair** / **work_order** - Service requests
4. **contact** - Customer communications
5. **profile_update** - Customer info changes
6. **note** - Manual notes
7. **generic** - Other events

Events are automatically stored, categorized, and made searchable.

## Scaling Strategy

### Single Instance (Development)
- SQLite database
- All services in one process
- No external dependencies

### Multi-Instance (Production)
- MS SQL Server (shared)
- NATS queue groups (load balancing)
- Multiple app instances
- Load balancer (nginx/HAProxy)

```
┌─────────────┐
│   Nginx LB  │
└──────┬──────┘
       │
   ┌───┴───┬───────┬───────┐
   │       │       │       │
┌──▼──┐ ┌──▼──┐ ┌──▼──┐ ┌──▼──┐
│App:1│ │App:2│ │App:3│ │App:N│
└──┬──┘ └──┬──┘ └──┬──┘ └──┬──┘
   │       │       │       │
   └───┬───┴───┬───┴───┬───┘
       │       │       │
    ┌──▼───────▼───────▼──┐
    │    MS SQL Server    │
    └─────────────────────┘
```

## What's Next?

1. **Configure**: Edit `config.env` for your environment
2. **Test locally**: Use SQLite for development
3. **Deploy**: Use MS SQL + multiple instances for production
4. **Integrate**: Connect microservices via NATS
5. **Sync CRM**: Enable Salesforce/HubSpot integration

## Support

- **Main docs**: `README.md`
- **API docs**: `API_REFERENCE.md`
- **NATS integration**: `NATS_INTEGRATION.md`
- **Deployment**: `DEPLOYMENT_GUIDE.md`

---

**Status**: ✅ Production Ready

The transformation is complete. CustomerIQ is now a standalone, scalable customer context platform ready for deployment.
