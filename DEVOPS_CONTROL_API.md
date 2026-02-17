# CustomerIQ DevOps Control Interface

**Complete API reference for DevOps automation, monitoring, and runtime management**

The DevOps Control Interface is a REST API that allows external DevOps systems to manage, monitor, and control CustomerIQ instances. It runs on port 9000 by default and provides comprehensive access to application state, configuration, logs, and control operations.

## 🚀 Quick Start

### Enable Control Interface

```bash
# config.env
CONTROL_ENABLED=true
CONTROL_PORT=9000
CONTROL_HOST=0.0.0.0
```

### Access Control API

```bash
# Health check
curl http://localhost:9000/health

# Get application info
curl http://localhost:9000/info

# View recent logs
curl http://localhost:9000/logs?limit=50

# Stream logs in real-time
curl http://localhost:9000/logs/stream
```

## 📡 API Endpoints

### Health & Status

#### `GET /health`

Get application health status and service availability.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "services": {
    "database": true,
    "api": true,
    "mcp": true,
    "nats": false,
    "crm": false
  }
}
```

**Use Cases:**
- Load balancer health checks
- Monitoring systems (Prometheus, Datadog, etc.)
- Automated health verification

---

#### `GET /info`

Get application information and metadata.

**Response:**
```json
{
  "name": "CustomerIQ",
  "version": "2.0.0",
  "description": "Customer Context Platform",
  "node_version": "v18.17.0",
  "platform": "linux",
  "arch": "x64",
  "pid": 12345,
  "started_at": "2024-01-15T10:00:00.000Z",
  "uptime_seconds": 3600
}
```

**Use Cases:**
- Version tracking
- Deployment verification
- System inventory

---

### Configuration Management

#### `GET /config`

Get current application configuration (secrets redacted).

**Response:**
```json
{
  "config": {
    "database": {
      "provider": "mssql",
      "mssql": {
        "server": "sql.example.com",
        "port": 1433,
        "database": "CustomerIQ",
        "user": "customeriq_user",
        "password": "***REDACTED***"
      }
    },
    "mcp": {
      "enabled": true,
      "name": "customeriq-mcp"
    },
    "api": {
      "enabled": true,
      "port": 3000
    },
    "nats": {
      "enabled": true,
      "servers": "nats://nats.example.com:4222"
    }
  }
}
```

**Use Cases:**
- Configuration auditing
- Troubleshooting
- Compliance verification

---

#### `PUT /config`

Update configuration (requires restart to apply).

**Request Body:**
```json
{
  "api": {
    "port": 3001
  }
}
```

**Response:**
```json
{
  "message": "Configuration updated. Restart required to apply changes.",
  "requires_restart": true
}
```

**Use Cases:**
- Dynamic configuration updates
- CI/CD pipeline integration
- Configuration management automation

---

### Environment & Runtime

#### `GET /env`

Get environment variables (secrets redacted).

**Response:**
```json
{
  "env": {
    "NODE_ENV": "production",
    "DB_PROVIDER": "mssql",
    "API_PORT": "3000",
    "MSSQL_PASSWORD": "***REDACTED***",
    "PATH": "/usr/local/bin:/usr/bin:/bin"
  }
}
```

**Use Cases:**
- Environment verification
- Configuration debugging
- Security auditing

---

#### `GET /runtime`

Get runtime information and metrics.

**Response:**
```json
{
  "memory": {
    "rss": 134217728,
    "heapTotal": 67108864,
    "heapUsed": 45088768,
    "external": 2097152
  },
  "cpu": {
    "user": 1234567,
    "system": 234567
  },
  "uptime": 3600.5,
  "pid": 12345,
  "platform": "linux",
  "arch": "x64",
  "node_version": "v18.17.0",
  "cwd": "/app/customeriq",
  "database": {
    "provider": "mssql",
    "connected": true
  },
  "services": {
    "mcp_enabled": true,
    "api_enabled": true,
    "api_port": 3000,
    "nats_enabled": true,
    "crm_enabled": false
  }
}
```

**Use Cases:**
- Performance monitoring
- Memory leak detection
- Capacity planning

---

#### `POST /runtime`

Manipulate runtime variables.

**Request Body:**
```json
{
  "env_set": {
    "LOG_LEVEL": "debug",
    "CUSTOM_VAR": "value"
  }
}
```

**Response:**
```json
{
  "message": "Runtime variables updated",
  "updated": {
    "LOG_LEVEL": "debug",
    "CUSTOM_VAR": "value"
  }
}
```

**Use Cases:**
- Dynamic log level adjustment
- Feature flag toggle
- Runtime debugging

---

### Logging & Monitoring

#### `GET /logs`

Get buffered application logs.

**Query Parameters:**
- `limit` (default: 100) - Number of log entries to return
- `level` (optional) - Filter by log level (info, warn, error)

**Example:**
```bash
# Get last 50 logs
curl http://localhost:9000/logs?limit=50

# Get only errors
curl http://localhost:9000/logs?level=error
```

**Response:**
```json
{
  "total": 1000,
  "returned": 50,
  "logs": [
    {
      "timestamp": "2024-01-15T10:30:00.000Z",
      "level": "info",
      "message": "[API] REST API Server running on http://0.0.0.0:3000"
    },
    {
      "timestamp": "2024-01-15T10:30:05.000Z",
      "level": "error",
      "message": "[Database] Connection timeout"
    }
  ]
}
```

**Use Cases:**
- Log aggregation (ELK, Splunk, etc.)
- Error tracking
- Debugging production issues

---

#### `GET /logs/stream`

Stream logs in real-time using Server-Sent Events (SSE).

**Example:**
```bash
# Stream logs continuously
curl -N http://localhost:9000/logs/stream
```

**Response (SSE Stream):**
```
data: {"type":"connected","timestamp":"2024-01-15T10:30:00.000Z"}

data: {"timestamp":"2024-01-15T10:30:01.000Z","level":"info","message":"[API] Request received"}

data: {"timestamp":"2024-01-15T10:30:02.000Z","level":"warn","message":"[Database] Slow query detected"}
```

**Use Cases:**
- Real-time log monitoring
- Live debugging sessions
- DevOps dashboards

---

### Control Operations

#### `POST /control/restart`

Restart the application gracefully.

**Response:**
```json
{
  "message": "Application restart initiated",
  "pid": 12345
}
```

**Behavior:**
- Graceful shutdown of all services
- Exit with code 0
- Process manager (PM2, systemd) restarts automatically

**Use Cases:**
- Configuration reload
- Automated recovery
- Blue-green deployments

---

#### `POST /control/stop`

Stop the application gracefully.

**Response:**
```json
{
  "message": "Application shutdown initiated",
  "pid": 12345
}
```

**Behavior:**
- Graceful shutdown of all services
- Database connections closed
- Exit with code 0

**Use Cases:**
- Maintenance windows
- Controlled shutdowns
- Deployment automation

---

#### `GET /metrics`

Get operational metrics.

**Response:**
```json
{
  "metrics": {
    "requests": 12345,
    "errors": 23,
    "restarts": 1,
    "uptime_seconds": 3600,
    "memory_usage": {
      "rss": 134217728,
      "heapTotal": 67108864,
      "heapUsed": 45088768
    },
    "cpu_usage": {
      "user": 1234567,
      "system": 234567
    },
    "log_buffer_size": 1000,
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

**Use Cases:**
- Prometheus scraping
- Performance monitoring
- SLA tracking

---

## 🔧 Integration Examples

### Node.js Client

```javascript
const axios = require('axios');

class CustomerIQControl {
  constructor(baseUrl = 'http://localhost:9000') {
    this.baseUrl = baseUrl;
  }

  async getHealth() {
    const { data } = await axios.get(`${this.baseUrl}/health`);
    return data;
  }

  async getLogs(limit = 100, level = null) {
    const params = { limit };
    if (level) params.level = level;
    const { data } = await axios.get(`${this.baseUrl}/logs`, { params });
    return data;
  }

  async restart() {
    const { data } = await axios.post(`${this.baseUrl}/control/restart`);
    return data;
  }

  streamLogs(callback) {
    const EventSource = require('eventsource');
    const es = new EventSource(`${this.baseUrl}/logs/stream`);

    es.onmessage = (event) => {
      const log = JSON.parse(event.data);
      callback(log);
    };

    return es;
  }
}

// Usage
const control = new CustomerIQControl();

// Check health
const health = await control.getHealth();
console.log('Services:', health.services);

// Stream logs
control.streamLogs((log) => {
  console.log(`[${log.level}] ${log.message}`);
});
```

---

### Python Client

```python
import requests
from sseclient import SSEClient

class CustomerIQControl:
    def __init__(self, base_url='http://localhost:9000'):
        self.base_url = base_url

    def get_health(self):
        response = requests.get(f'{self.base_url}/health')
        return response.json()

    def get_logs(self, limit=100, level=None):
        params = {'limit': limit}
        if level:
            params['level'] = level
        response = requests.get(f'{self.base_url}/logs', params=params)
        return response.json()

    def restart(self):
        response = requests.post(f'{self.base_url}/control/restart')
        return response.json()

    def stream_logs(self, callback):
        messages = SSEClient(f'{self.base_url}/logs/stream')
        for msg in messages:
            if msg.data:
                log = json.loads(msg.data)
                callback(log)

# Usage
control = CustomerIQControl()

# Check health
health = control.get_health()
print(f"Services: {health['services']}")

# Get recent errors
logs = control.get_logs(limit=50, level='error')
for log in logs['logs']:
    print(f"[{log['level']}] {log['message']}")
```

---

### Bash/cURL Scripts

```bash
#!/bin/bash

CONTROL_API="http://localhost:9000"

# Health check function
check_health() {
  curl -s "$CONTROL_API/health" | jq '.services'
}

# Get logs
get_logs() {
  local limit=${1:-100}
  curl -s "$CONTROL_API/logs?limit=$limit" | jq '.logs'
}

# Stream logs to file
stream_logs() {
  curl -N "$CONTROL_API/logs/stream" >> customeriq-stream.log
}

# Restart application
restart_app() {
  curl -X POST -s "$CONTROL_API/control/restart" | jq
}

# Get metrics
get_metrics() {
  curl -s "$CONTROL_API/metrics" | jq '.metrics'
}

# Main
case "$1" in
  health)
    check_health
    ;;
  logs)
    get_logs ${2:-100}
    ;;
  stream)
    stream_logs
    ;;
  restart)
    restart_app
    ;;
  metrics)
    get_metrics
    ;;
  *)
    echo "Usage: $0 {health|logs|stream|restart|metrics}"
    exit 1
    ;;
esac
```

---

## 🔒 Security Considerations

### Access Control

The Control Interface does **NOT** include authentication by default. For production:

1. **Use Firewall Rules**
   ```bash
   # Only allow from specific IPs
   iptables -A INPUT -p tcp --dport 9000 -s 10.0.0.0/8 -j ACCEPT
   iptables -A INPUT -p tcp --dport 9000 -j DROP
   ```

2. **Run Behind Reverse Proxy**
   ```nginx
   # nginx with basic auth
   location /control/ {
     auth_basic "CustomerIQ Control";
     auth_basic_user_file /etc/nginx/.htpasswd;
     proxy_pass http://localhost:9000/;
   }
   ```

3. **Use VPN/Private Network**
   - Run control interface on private interface only
   - Access via VPN tunnel

4. **Network Segmentation**
   ```bash
   # Bind to localhost only
   CONTROL_HOST=127.0.0.1
   ```

### Secret Redaction

The control interface automatically redacts:
- Passwords
- API keys
- Tokens
- Secrets

These appear as `***REDACTED***` in responses.

---

## 📊 Monitoring Integration

### Prometheus

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'customeriq'
    static_configs:
      - targets: ['localhost:9000']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

### Datadog

```javascript
const StatsD = require('node-statsd');
const control = new CustomerIQControl();

const dogstatsd = new StatsD({ host: 'datadog-agent', port: 8125 });

setInterval(async () => {
  const health = await control.getHealth();
  const metrics = await control.getMetrics();

  dogstatsd.gauge('customeriq.uptime', health.uptime);
  dogstatsd.gauge('customeriq.memory.used', metrics.memory_usage.heapUsed);
  dogstatsd.gauge('customeriq.requests.total', metrics.requests);
  dogstatsd.gauge('customeriq.errors.total', metrics.errors);
}, 10000);
```

### ELK Stack

```javascript
// Logstash HTTP input
const control = new CustomerIQControl();

control.streamLogs(async (log) => {
  await axios.post('http://logstash:5000', {
    ...log,
    app: 'customeriq',
    environment: 'production'
  });
});
```

---

## 🚀 Deployment Automation

### PM2 Ecosystem

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'customeriq',
    script: './server/app.js',
    instances: 4,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      CONTROL_ENABLED: 'true',
      CONTROL_PORT: 9000
    }
  }]
};
```

### Kubernetes Health Checks

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: customeriq
spec:
  containers:
  - name: customeriq
    image: customeriq:2.0.0
    ports:
    - containerPort: 3000
      name: api
    - containerPort: 9000
      name: control
    livenessProbe:
      httpGet:
        path: /health
        port: 9000
      initialDelaySeconds: 30
      periodSeconds: 10
    readinessProbe:
      httpGet:
        path: /health
        port: 9000
      initialDelaySeconds: 5
      periodSeconds: 5
```

### Docker Health Check

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY . .
RUN npm install

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:9000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "server/app.js"]
```

---

## 📈 Use Cases

### Automated Deployment

```bash
#!/bin/bash
# deploy.sh

# 1. Check health of existing instance
curl -f http://localhost:9000/health || exit 1

# 2. Deploy new version
git pull origin main
npm install

# 3. Restart application
curl -X POST http://localhost:9000/control/restart

# 4. Wait for health
sleep 10
curl -f http://localhost:9000/health
```

### Log Aggregation

```python
# Aggregate logs from multiple instances
import asyncio
import aiohttp

instances = [
    'http://app1:9000',
    'http://app2:9000',
    'http://app3:9000'
]

async def aggregate_logs():
    async with aiohttp.ClientSession() as session:
        tasks = [session.get(f'{url}/logs?limit=100') for url in instances]
        responses = await asyncio.gather(*tasks)

        all_logs = []
        for resp in responses:
            data = await resp.json()
            all_logs.extend(data['logs'])

        # Sort by timestamp
        all_logs.sort(key=lambda x: x['timestamp'])
        return all_logs
```

### Health Monitoring Dashboard

```javascript
// Real-time dashboard
const express = require('express');
const app = express();

const instances = [
  'http://app1:9000',
  'http://app2:9000',
  'http://app3:9000'
];

app.get('/dashboard', async (req, res) => {
  const health = await Promise.all(
    instances.map(async (url) => {
      try {
        const resp = await axios.get(`${url}/health`);
        return { url, status: 'healthy', ...resp.data };
      } catch (err) {
        return { url, status: 'unhealthy', error: err.message };
      }
    })
  );

  res.json({ instances: health, timestamp: new Date() });
});
```

---

## ⚙️ Configuration Reference

```bash
# Enable/disable control interface
CONTROL_ENABLED=true

# Port for control API
CONTROL_PORT=9000

# Host to bind (0.0.0.0 for all interfaces)
CONTROL_HOST=0.0.0.0

# Maximum log buffer size (default: 1000)
MAX_LOG_BUFFER=1000
```

---

## 🆘 Support

- **API Issues**: Check `/health` and `/logs` endpoints
- **Connection Issues**: Verify `CONTROL_PORT` and firewall rules
- **Performance**: Monitor `/metrics` endpoint
- **Debugging**: Use `/logs/stream` for real-time output

---

**The DevOps Control Interface makes CustomerIQ production-ready with comprehensive monitoring, management, and automation capabilities.**
