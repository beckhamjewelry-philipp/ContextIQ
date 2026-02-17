# CustomerIQ Standalone Application - Deployment Guide

## Overview

CustomerIQ is now a **unified console application** that runs all services in a single process:
- ✅ MCP Server for AI assistants
- ✅ REST API for web frontends
-✅ Static web UI
- ✅ NATS event subscriber
- ✅ CRM integration

Supports **both SQLite (single instance) and MS SQL Server (multi-instance scaling)**.

---

## Quick Start

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Configure Application

```bash
# Copy configuration template
cp config.env.example config.env

# Edit configuration
nano config.env  # or use your preferred editor
```

### 3. Start Application

**Linux/Mac**:
```bash
./start.sh
```

**Windows**:
```bash
start.bat
```

**Or directly**:
```bash
cd server
node app.js
```

---

## Configuration

### Single Instance (SQLite)

Perfect for development, small teams, or single server deployments.

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

### Multi-Instance (MS SQL Server)

For production with horizontal scaling across multiple servers.

```bash
# config.env
DB_PROVIDER=mssql
MSSQL_SERVER=sql-server.example.com
MSSQL_PORT=1433
MSSQL_DATABASE=CustomerIQ
MSSQL_USER=customeriq_user
MSSQL_PASSWORD=secure_password_here
MSSQL_ENCRYPT=true

MCP_ENABLED=true
API_ENABLED=true
API_PORT=3000

# Enable NATS for event aggregation across instances
NATS_ENABLED=true
NATS_SERVERS=nats://nats1.example.com:4222,nats://nats2.example.com:4222
NATS_QUEUE_GROUP=customeriq-cluster

# Enable CRM sync (only one instance should have this enabled)
CRM_ENABLED=true
CRM_TYPE=salesforce
```

---

## Architecture

### Single Instance Architecture

```
┌─────────────────────────────────────────┐
│      CustomerIQ Console Application      │
├─────────────────────────────────────────┤
│  • MCP Server (stdio)                    │
│  • REST API Server (HTTP :3000)          │
│  • Web UI (Static files)                 │
│  • NATS Subscriber (optional)            │
│  • CRM Sync (optional)                   │
└──────────────────┬──────────────────────┘
                   ↓
           ┌──────────────┐
           │ SQLite File  │
           │  (local DB)  │
           └──────────────┘
```

### Multi-Instance Architecture

```
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│  CustomerIQ Instance 1│  │  CustomerIQ Instance 2│  │  CustomerIQ Instance 3│
│  MCP + API + NATS    │  │  MCP + API + NATS    │  │  MCP + API + NATS    │
└──────┬───────────────┘  └──────┬───────────────┘  └──────┬───────────────┘
       │                          │                          │
       └──────────────────────────┼──────────────────────────┘
                                  ↓
                    ┌─────────────────────────┐
                    │  MS SQL Server          │
                    │  (Shared Database)      │
                    └─────────────────────────┘
                                  ↑
                                  │
                    ┌─────────────────────────┐
                    │  NATS Cluster           │
                    │  (Event Distribution)   │
                    └─────────────────────────┘
```

---

## Database Setup

### SQLite (Automatic)

No setup required. Database file created automatically on first run.

### MS SQL Server Setup

1. **Create Database**:

```sql
CREATE DATABASE CustomerIQ;
GO

USE CustomerIQ;
GO

-- Create user
CREATE LOGIN customeriq_user WITH PASSWORD = 'SecurePassword123!';
CREATE USER customeriq_user FOR LOGIN customeriq_user;

-- Grant permissions
ALTER ROLE db_datareader ADD MEMBER customeriq_user;
ALTER ROLE db_datawriter ADD MEMBER customeriq_user;
ALTER ROLE db_ddladmin ADD MEMBER customeriq_user;
GO
```

2. **Configure Connection** in `config.env`:

```bash
MSSQL_SERVER=your-server.database.windows.net
MSSQL_PORT=1433
MSSQL_DATABASE=CustomerIQ
MSSQL_USER=customeriq_user
MSSQL_PASSWORD=SecurePassword123!
MSSQL_ENCRYPT=true
MSSQL_TRUST_CERT=false
```

3. **Schema Auto-Created** on first run - CustomerIQ automatically:
   - Creates all tables (customers, events, purchases, etc.)
   - Sets up indexes and foreign keys
   - Configures full-text search
   - Runs migrations

---

## Multi-Instance Scaling

### Load Balancer Configuration

Use a load balancer (nginx, HAProxy, AWS ALB) to distribute traffic:

```nginx
upstream customeriq {
    least_conn;
    server instance1:3000;
    server instance2:3000;
    server instance3:3000;
}

server {
    listen 80;
    server_name customeriq.example.com;

    location / {
        proxy_pass http://customeriq;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### NATS Queue Groups

All instances subscribe to NATS with the same queue group for automatic load balancing:

```bash
# All instances use same queue group
NATS_QUEUE_GROUP=customeriq-cluster
```

NATS ensures each event is delivered to only ONE instance in the group.

### CRM Sync (Single Instance Only)

Only enable CRM sync on ONE instance to avoid duplicate syncs:

```bash
# Instance 1 config.env
CRM_ENABLED=true
CRM_TYPE=salesforce

# Instance 2 & 3 config.env
CRM_ENABLED=false
```

---

## Service Management

### Systemd Service (Linux)

Create `/etc/systemd/system/customeriq.service`:

```ini
[Unit]
Description=CustomerIQ Customer Context Platform
After=network.target

[Service]
Type=simple
User=customeriq
WorkingDirectory=/opt/customeriq
EnvironmentFile=/opt/customeriq/config.env
ExecStart=/usr/bin/node /opt/customeriq/server/app.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start
sudo systemctl enable customeriq
sudo systemctl start customeriq

# View logs
sudo journalctl -u customeriq -f
```

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY server/package*.json ./
RUN npm ci --production

# Copy application
COPY server ./

# Expose API port
EXPOSE 3000

# Start application
CMD ["node", "app.js"]
```

```bash
# Build
docker build -t customeriq:latest .

# Run (SQLite)
docker run -d \
  --name customeriq \
  -p 3000:3000 \
  -v ~/.customeriq:/root/.customeriq \
  -e DB_PROVIDER=sqlite \
  -e API_PORT=3000 \
  customeriq:latest

# Run (MS SQL)
docker run -d \
  --name customeriq \
  -p 3000:3000 \
  -e DB_PROVIDER=mssql \
  -e MSSQL_SERVER=sql-server \
  -e MSSQL_DATABASE=CustomerIQ \
  -e MSSQL_USER=customeriq_user \
  -e MSSQL_PASSWORD=password \
  customeriq:latest
```

### Docker Compose (Full Stack)

```yaml
version: '3.8'

services:
  mssql:
    image: mcr.microsoft.com/mssql/server:2022-latest
    environment:
      SA_PASSWORD: "YourStrong!Passw0rd"
      ACCEPT_EULA: "Y"
    ports:
      - "1433:1433"
    volumes:
      - mssql-data:/var/opt/mssql

  nats:
    image: nats:latest
    ports:
      - "4222:4222"
      - "8222:8222"

  customeriq-1:
    build: .
    environment:
      DB_PROVIDER: mssql
      MSSQL_SERVER: mssql
      MSSQL_DATABASE: CustomerIQ
      MSSQL_USER: sa
      MSSQL_PASSWORD: "YourStrong!Passw0rd"
      NATS_ENABLED: "true"
      NATS_SERVERS: "nats://nats:4222"
      CRM_ENABLED: "true"
    ports:
      - "3001:3000"
    depends_on:
      - mssql
      - nats

  customeriq-2:
    build: .
    environment:
      DB_PROVIDER: mssql
      MSSQL_SERVER: mssql
      MSSQL_DATABASE: CustomerIQ
      MSSQL_USER: sa
      MSSQL_PASSWORD: "YourStrong!Passw0rd"
      NATS_ENABLED: "true"
      NATS_SERVERS: "nats://nats:4222"
      CRM_ENABLED: "false"
    ports:
      - "3002:3000"
    depends_on:
      - mssql
      - nats

volumes:
  mssql-data:
```

Start:
```bash
docker-compose up -d
```

---

## Monitoring & Health Checks

### Health Check Endpoint

```bash
curl http://localhost:3000/api/health

# Response:
{
  "status": "healthy",
  "timestamp": "2026-01-25T12:00:00.000Z"
}
```

### Logging

All services log to stderr with prefixes:
- `[Database]` - Database operations
- `[MCP]` - MCP server events
- `[API]` - REST API requests
- `[NATS]` - NATS event processing
- `[CRM]` - CRM synchronization
- `[Shutdown]` - Graceful shutdown

### Service Status

Application displays status on startup:

```
┌─────────────────────────────────────────────┐
│            Service Status                    │
├─────────────────────────────────────────────┤
│ Database:     ✓ MSSQL                       │
│ MCP Server:   ✓ Enabled (stdio)             │
│ REST API:     ✓ http://localhost:3000       │
│ NATS Events:  ✓ Connected                   │
│ CRM Sync:     ✓ SALESFORCE                  │
└─────────────────────────────────────────────┘
```

---

## Performance Tuning

### MS SQL Database

```sql
-- Optimize for read-heavy workloads
ALTER DATABASE CustomerIQ SET READ_COMMITTED_SNAPSHOT ON;

-- Add additional indexes for frequently queried fields
CREATE INDEX idx_events_date_type ON customer_events(event_date, event_type);
CREATE INDEX idx_purchases_date_customer ON purchases(purchase_date, customer_id);
```

### Application Settings

```bash
# Increase Node.js memory limit for large datasets
NODE_OPTIONS="--max-old-space-size=4096" node app.js
```

---

## Security

### Database Security

- ✅ Use encrypted connections (`MSSQL_ENCRYPT=true`)
- ✅ Rotate credentials regularly
- ✅ Use least-privilege database user
- ✅ Enable firewall rules for database access

### API Security

- ✅ Run behind reverse proxy with HTTPS
- ✅ Implement API authentication (add middleware)
- ✅ Rate limiting (add express-rate-limit)
- ✅ CORS configuration for production

### Environment Variables

- ✅ Never commit `config.env` to git
- ✅ Use secrets management (AWS Secrets Manager, HashiCorp Vault)
- ✅ Encrypt sensitive config in production

---

## Troubleshooting

### Database Connection Failed

```bash
# Test MS SQL connectivity
sqlcmd -S your-server.database.windows.net -U customeriq_user -P password -d CustomerIQ -Q "SELECT 1"

# Check firewall rules
telnet your-server.database.windows.net 1433
```

### NATS Not Connecting

```bash
# Test NATS connectivity
nc -zv nats-server 4222

#Check NATS server logs
docker logs nats-container
```

### Port Already in Use

```bash
# Find process using port
lsof -i :3000  # Linux/Mac
netstat -ano | findstr :3000  # Windows

# Change API port
API_PORT=8080 node app.js
```

---

## Upgrading

### From SQLite to MS SQL

1. Export SQLite data:
```bash
sqlite3 ~/.customeriq/customeriq.db .dump > backup.sql
```

2. Convert and import to MS SQL (use migration tool)

3. Update `config.env`:
```bash
DB_PROVIDER=mssql
MSSQL_SERVER=...
```

4. Restart application

### Rolling Update (Zero Downtime)

With load balancer:
1. Update instance 1 → deploy → verify
2. Update instance 2 → deploy → verify
3. Update instance 3 → deploy → verify

---

## Support

- **Documentation**: See `API_REFERENCE.md` and `NATS_INTEGRATION.md`
- **Issues**: https://github.com/anthropics/CustomerIQ/issues

---

**CustomerIQ is now production-ready with multi-instance scaling!** 🚀
