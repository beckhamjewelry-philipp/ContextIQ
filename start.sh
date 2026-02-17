#!/bin/bash

# CustomerIQ Startup Script

set -e

echo "╔═══════════════════════════════════════════════════╗"
echo "║         CustomerIQ Customer Context Platform      ║"
echo "║                 Startup Script                    ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

# Check if config exists
if [ ! -f "config.env" ]; then
    echo "⚠️  config.env not found. Creating from template..."
    cp config.env.example config.env
    echo "✅ Created config.env - Please edit with your settings"
    echo ""
fi

# Load configuration
export $(cat config.env | grep -v '#' | xargs)

echo "📋 Configuration:"
echo "   Database: $DB_PROVIDER"
echo "   MCP Server: $MCP_ENABLED"
echo "   REST API: $API_ENABLED (port $API_PORT)"
echo "   NATS Events: $NATS_ENABLED"
echo "   CRM Sync: $CRM_ENABLED ($CRM_TYPE)"
echo ""

# Check database connectivity
if [ "$DB_PROVIDER" = "mssql" ]; then
    echo "🔍 Checking MS SQL Server connectivity..."
    # You could add sqlcmd test here
    echo "   Server: $MSSQL_SERVER:$MSSQL_PORT"
    echo "   Database: $MSSQL_DATABASE"
fi

# Check NATS connectivity (if enabled)
if [ "$NATS_ENABLED" = "true" ]; then
    echo "🔍 Checking NATS connectivity..."
    if command -v nc &> /dev/null; then
        NATS_HOST=$(echo $NATS_SERVERS | sed 's/nats:\/\///' | cut -d':' -f1)
        NATS_PORT=$(echo $NATS_SERVERS | cut -d':' -f3)
        if nc -z $NATS_HOST ${NATS_PORT:-4222} 2>/dev/null; then
            echo "   ✅ NATS server reachable"
        else
            echo "   ⚠️  NATS server not reachable at $NATS_SERVERS"
            echo "   Start NATS with: docker run -d -p 4222:4222 nats:latest"
        fi
    fi
fi

echo ""
echo "🚀 Starting CustomerIQ..."
echo ""

# Start the application
cd server
node app.js
