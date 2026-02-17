# CustomerIQ - Complete Rebranding & DevOps Control Interface

## ✅ Rebranding Complete

The codebase has been successfully rebranded from **ContextIQ** to **CustomerIQ** across all files:

### Files Updated

#### Core Application
- ✅ `server/app.js` - Main application class renamed to `CustomerIQApplication`
- ✅ `server/package.json` - Package name and description updated
- ✅ `server/apiServer.js` - Header comment updated
- ✅ `server/public/index.html` - Web UI title and branding
- ✅ `config.env.example` - All configuration references

#### Scripts
- ✅ `build.sh` & `build.bat` - Build scripts
- ✅ `start.sh` & `start.bat` - Startup scripts

#### Documentation
- ✅ `README.md` - Main documentation
- ✅ `TRANSFORMATION_COMPLETE.md` - Transformation summary
- ✅ `DEPLOYMENT_GUIDE.md` - Deployment documentation
- ✅ `API_REFERENCE.md` - API documentation
- ✅ `CUSTOMER_PLATFORM_README.md` - Platform overview
- ✅ `NATS_INTEGRATION.md` - NATS integration guide

### Key Changes

- **Application Name**: ContextIQ → CustomerIQ
- **Database Path**: `~/.copilot-memory/ContextIQ.db` → `~/.customeriq/customeriq.db`
- **Database Name**: ContextIQ → CustomerIQ
- **Queue Group**: `contextiq-service` → `customeriq-service`
- **MCP Server Name**: `contextiq-mcp` → `customeriq-mcp`
- **SQL User**: `contextiq_user` → `customeriq_user`

---

## 🚀 DevOps Control Interface

A comprehensive DevOps control API has been added for production management and monitoring.

### New Files Created

#### Control Server
- ✅ `server/devopsControl.js` - Complete DevOps control server implementation
- ✅ `DEVOPS_CONTROL_API.md` - Comprehensive API documentation (700+ lines)

### Features Implemented

#### 1. Health & Status Monitoring
- `GET /health` - Application health with service status
- `GET /info` - Application metadata and version info
- `GET /metrics` - Operational metrics and statistics

#### 2. Configuration Management
- `GET /config` - View current configuration (secrets redacted)
- `PUT /config` - Update configuration dynamically
- `GET /env` - Environment variables (secrets redacted)

#### 3. Runtime Management
- `GET /runtime` - Runtime information (memory, CPU, uptime)
- `POST /runtime` - Manipulate runtime variables

#### 4. Logging & Monitoring
- `GET /logs` - Buffered application logs with filtering
- `GET /logs/stream` - Real-time log streaming (Server-Sent Events)

#### 5. Control Operations
- `POST /control/restart` - Graceful application restart
- `POST /control/stop` - Graceful shutdown

### Integration Points

The control interface is integrated into the main application:

```javascript
// server/app.js
class CustomerIQApplication {
  constructor() {
    this.controlServer = null; // DevOps control server
  }

  async start() {
    // ... other services
    if (this.config.control.enabled) {
      await this.startControlInterface();
    }
  }
}
```

### Configuration

```bash
# config.env
CONTROL_ENABLED=true
CONTROL_PORT=9000
CONTROL_HOST=0.0.0.0
```

### Security Features

1. **Automatic Secret Redaction**
   - Passwords, API keys, tokens automatically hidden
   - Shown as `***REDACTED***` in responses

2. **Access Control** (documented)
   - Firewall rules
   - Reverse proxy with auth
   - VPN/private network options

### Use Cases

#### 1. Health Checks
```bash
curl http://localhost:9000/health
```

#### 2. Log Aggregation
```bash
curl "http://localhost:9000/logs?limit=100&level=error"
```

#### 3. Real-time Monitoring
```bash
curl -N http://localhost:9000/logs/stream
```

#### 4. Automated Deployment
```bash
# Check health
curl -f http://localhost:9000/health || exit 1

# Deploy
git pull && npm install

# Restart
curl -X POST http://localhost:9000/control/restart
```

#### 5. Prometheus Integration
```yaml
scrape_configs:
  - job_name: 'customeriq'
    static_configs:
      - targets: ['localhost:9000']
    metrics_path: '/metrics'
```

### Client Libraries

Documentation includes complete examples for:
- **Node.js** - Full client class with axios
- **Python** - Client class with requests & SSE support
- **Bash** - Shell scripts for automation

---

## 📊 Architecture Overview

```
CustomerIQ Application (app.js)
│
├── MCP Server (stdio:N/A)
├── REST API (HTTP:3000)
├── DevOps Control (HTTP:9000)  ← NEW
├── NATS Subscriber (optional)
├── CRM Integration (optional)
│
└── Database Provider
    ├── SQLite (single instance)
    └── MS SQL (multi-instance)
```

### Service Status Display

The application now shows all running services:

```
┌─────────────────────────────────────────────┐
│            Service Status                    │
├─────────────────────────────────────────────┤
│ Database:     ✓ SQLITE                      │
│ MCP Server:   ✓ Enabled (stdio)             │
│ REST API:     ✓ http://localhost:3000       │
│ NATS Events:  ✗ Disabled                    │
│ CRM Sync:     ✗ Disabled                    │
│ Control API:  ✓ http://localhost:9000       │
└─────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
CustomerIQ/
├── server/
│   ├── app.js                    # Main application (CustomerIQApplication)
│   ├── apiServer.js              # REST API server
│   ├── devopsControl.js          # DevOps control server ← NEW
│   ├── eventProcessor.js         # Event processing
│   ├── customerContextBuilder.js # Context aggregation
│   ├── natsSubscriber.js        # NATS integration
│   ├── crmIntegration.js        # CRM sync
│   ├── database/
│   │   ├── DatabaseProvider.js   # Abstract provider
│   │   ├── SQLiteProvider.js     # SQLite implementation
│   │   └── MSSQLProvider.js      # MS SQL implementation
│   └── public/                   # Web UI
│       ├── index.html            # Customer dashboard
│       ├── app.js                # Frontend application
│       └── styles.css            # Styling
├── config.env.example            # Configuration template
├── build.sh / build.bat          # Build scripts
├── start.sh / start.bat          # Startup scripts
└── Documentation/
    ├── README.md                 # Main documentation
    ├── API_REFERENCE.md          # MCP & REST API docs
    ├── DEVOPS_CONTROL_API.md     # DevOps control docs ← NEW
    ├── NATS_INTEGRATION.md       # Event integration
    ├── DEPLOYMENT_GUIDE.md       # Production deployment
    └── CUSTOMER_PLATFORM_README.md
```

---

## 🎯 Quick Start

### 1. Installation

```bash
git clone <repository-url>
cd CustomerIQ
./build.sh
```

### 2. Configuration

```bash
cp config.env.example config.env
nano config.env
```

### 3. Start Application

```bash
./start.sh
```

### 4. Access Services

- **Web UI**: http://localhost:3000
- **REST API**: http://localhost:3000/api/
- **Control API**: http://localhost:9000
- **MCP**: Configure in Claude Desktop

---

## 🔧 Configuration Reference

```bash
# Database
DB_PROVIDER=sqlite
SQLITE_PATH=~/.customeriq/customeriq.db

# Services
MCP_ENABLED=true
API_ENABLED=true
API_PORT=3000
CONTROL_ENABLED=true
CONTROL_PORT=9000

# Integrations
NATS_ENABLED=false
CRM_ENABLED=false
```

---

## 📊 Monitoring & Management

### Health Monitoring

```bash
# Check application health
curl http://localhost:9000/health

# Get metrics
curl http://localhost:9000/metrics
```

### Log Management

```bash
# View recent logs
curl http://localhost:9000/logs?limit=100

# Stream logs in real-time
curl -N http://localhost:9000/logs/stream

# Filter error logs
curl "http://localhost:9000/logs?level=error&limit=50"
```

### Runtime Control

```bash
# Get runtime information
curl http://localhost:9000/runtime

# Restart application
curl -X POST http://localhost:9000/control/restart

# Stop application
curl -X POST http://localhost:9000/control/stop
```

---

## 📚 Complete Documentation

1. **README.md** - Main documentation with quick start
2. **DEVOPS_CONTROL_API.md** - Complete DevOps API reference
3. **API_REFERENCE.md** - MCP tools and REST endpoints
4. **NATS_INTEGRATION.md** - Event integration guide
5. **DEPLOYMENT_GUIDE.md** - Production deployment
6. **CUSTOMER_PLATFORM_README.md** - Platform overview

---

## ✅ Summary

### What Was Accomplished

1. **Complete Rebranding**
   - All 30+ files updated
   - Consistent naming across codebase
   - Database paths and queue groups renamed

2. **DevOps Control Interface**
   - Full-featured management API
   - Real-time monitoring and metrics
   - Log streaming and aggregation
   - Runtime control operations
   - 700+ lines of documentation

3. **Production-Ready**
   - Health checks for load balancers
   - Metrics for Prometheus/Datadog
   - Log streaming for ELK stack
   - Kubernetes-ready endpoints
   - Automated deployment support

### Key Features

- ✅ Multi-database support (SQLite/MS SQL)
- ✅ Horizontal scaling with queue groups
- ✅ MCP integration (20+ tools)
- ✅ REST API for frontends
- ✅ Web UI dashboard
- ✅ NATS event processing
- ✅ CRM integration (Salesforce/HubSpot)
- ✅ **DevOps control interface** (NEW)
- ✅ Production monitoring
- ✅ Automated management

---

**CustomerIQ is now a production-ready, enterprise-grade customer context platform with comprehensive DevOps tooling for modern cloud deployments.**
