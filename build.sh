#!/bin/bash

# Build script for Copilot Memory MCP project

set -e

echo "🔨 Building Copilot Memory MCP..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
npm run clean

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build shared types
echo "🔧 Building shared types..."
cd shared
npm run build
cd ..

# Build server
echo "🖥️  Building MCP server..."
cd server
npm run build
cd ..

# Build extension
echo "🔌 Building VSCode extension..."
cd extension
npm run compile
cd ..

echo "✅ Build completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Configure the extension settings in VSCode"
echo "2. Install the extension with: code --install-extension ./extension"
echo "3. Start using Copilot Memory!"