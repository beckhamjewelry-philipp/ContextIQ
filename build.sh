#!/bin/bash

# Build script for CustomerIQ Customer Context Platform

set -e

echo "╔═══════════════════════════════════════════════════╗"
echo "║         CustomerIQ Customer Context Platform      ║"
echo "║                   Build Script                    ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

# Install server dependencies
echo "📦 Installing server dependencies..."
cd server
npm install
cd ..

# Install extension dependencies (if extension exists)
if [ -d "extension" ]; then
  echo "📦 Installing extension dependencies..."
  cd extension
  npm install
  cd ..
fi

echo ""
echo "✅ Build completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Configure settings: cp config.env.example config.env"
echo "2. Edit config.env with your database and service settings"
echo "3. Start the application: ./start.sh"
echo "4. Access web UI at: http://localhost:3000"
echo ""
echo "For production deployment, see DEPLOYMENT_GUIDE.md"
