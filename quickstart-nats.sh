#!/bin/bash

# ContextIQ NATS Integration Quick Start
# This script helps you quickly set up and test the NATS integration

set -e

echo "🚀 ContextIQ NATS Integration Quick Start"
echo "=========================================="
echo ""

# Check if NATS server is running
echo "📡 Checking NATS server..."
if ! curl -s http://localhost:8222/varz > /dev/null 2>&1; then
    echo "❌ NATS server is not running on port 4222"
    echo ""
    echo "Starting NATS server with Docker..."
    if command -v docker &> /dev/null; then
        docker run -d --name nats-contextiq -p 4222:4222 -p 8222:8222 nats:latest
        echo "✅ NATS server started"
        sleep 2
    else
        echo "⚠️  Docker not found. Please install NATS server manually:"
        echo "   https://docs.nats.io/running-a-nats-service/introduction/installation"
        exit 1
    fi
else
    echo "✅ NATS server is running"
fi

echo ""
echo "📝 Creating .env file..."
if [ ! -f server/.env ]; then
    cat > server/.env << 'EOF'
NATS_ENABLED=true
NATS_SERVERS=nats://localhost:4222
NATS_SUBJECTS=customer.events.>
NATS_QUEUE_GROUP=contextiq-service
NATS_AUTO_CREATE_CUSTOMER=true
NATS_SUMMARIZE_THRESHOLD=500
EOF
    echo "✅ .env file created"
else
    echo "⚠️  .env file already exists, skipping..."
fi

echo ""
echo "🔧 Installing dependencies..."
cd server
npm install nats better-sqlite3 > /dev/null 2>&1
cd ..
echo "✅ Dependencies installed"

echo ""
echo "🎯 Starting ContextIQ server in background..."
export NATS_ENABLED=true
export NATS_SERVERS=nats://localhost:4222
node server/index-sqlite.js 2>&1 | tee contextiq.log &
SERVER_PID=$!
echo "✅ Server started (PID: $SERVER_PID)"
sleep 3

echo ""
echo "📤 Publishing test events..."
node server/test-publisher.js --all

echo ""
echo "✅ Setup complete!"
echo ""
echo "📊 Next steps:"
echo "   1. Check logs: tail -f contextiq.log"
echo "   2. Query customer data:"
echo "      sqlite3 ~/.copilot-memory/ContextIQ.db 'SELECT * FROM customers;'"
echo "   3. Publish more events:"
echo "      node server/test-publisher.js --event purchase"
echo "   4. Stop server: kill $SERVER_PID"
echo ""
echo "📖 Full documentation: NATS_INTEGRATION.md"
