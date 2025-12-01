#!/bin/bash

# Development script for Copilot Memory MCP project

set -e

echo "🚀 Starting development mode..."

# Function to handle cleanup
cleanup() {
    echo "🛑 Stopping development servers..."
    jobs -p | xargs -r kill
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start development servers in parallel
echo "🔧 Starting TypeScript compilation in watch mode..."

# Build shared types first
cd shared
npm run build
cd ..

# Start watching processes
echo "👁️  Starting watchers..."

# Watch shared types
cd shared
npm run dev &
SHARED_PID=$!
cd ..

# Watch server
cd server
npm run dev &
SERVER_PID=$!
cd ..

# Watch extension
cd extension
npm run watch &
EXTENSION_PID=$!
cd ..

echo "✅ Development servers started!"
echo "📝 Processes:"
echo "   - Shared types watcher: $SHARED_PID"
echo "   - Server watcher: $SERVER_PID"  
echo "   - Extension watcher: $EXTENSION_PID"
echo ""
echo "💡 Press Ctrl+C to stop all watchers"

# Wait for all background processes
wait