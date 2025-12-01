#!/bin/bash

# Deployment script for Copilot Memory MCP Server
# Supports multiple deployment targets

set -e

echo "🚀 Copilot Memory MCP Deployment Script"
echo ""

# Function to show usage
show_usage() {
    echo "Usage: $0 [target]"
    echo ""
    echo "Targets:"
    echo "  local     - Run locally (default)"
    echo "  firebase  - Deploy to Firebase (requires Blaze plan)"
    echo "  docs      - Deploy documentation to Firebase Hosting (free)"
    echo "  docker    - Build Docker image"
    echo "  vercel    - Deploy to Vercel"
    echo "  build     - Build all components"
    echo ""
    echo "Examples:"
    echo "  $0 local     # Run server locally"
    echo "  $0 docs      # Deploy documentation site"
    echo "  $0 docker    # Build Docker image"
}

# Parse arguments
TARGET=${1:-local}

case $TARGET in
    "local")
        echo "📍 Deploying locally..."
        echo "🔨 Building project..."
        ./build.sh
        
        echo "🌐 Starting local server..."
        cd server
        echo "Server will be available at: http://localhost:3000"
        npm start
        ;;
        
    "firebase")
        echo "📍 Deploying to Firebase..."
        echo "⚠️  Note: Requires Firebase Blaze (paid) plan"
        
        read -p "Do you want to continue? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "🔨 Building functions..."
            cd functions && npm run build && cd ..
            
            echo "🚀 Deploying to Firebase..."
            firebase deploy
        else
            echo "❌ Deployment cancelled"
            exit 0
        fi
        ;;
        
    "docs")
        echo "📍 Deploying documentation to Firebase Hosting..."
        echo "🚀 Deploying..."
        firebase deploy --only hosting
        echo ""
        echo "✅ Documentation deployed!"
        echo "🌐 URL: https://copilot-memory-mcp.web.app"
        echo "🔗 API URL: https://aimem-q9cgj9973-kiranbjms-projects.vercel.app"
        ;;
        
    "docker")
        echo "📍 Building Docker image..."
        
        # Create Dockerfile if it doesn't exist
        if [ ! -f "Dockerfile" ]; then
            cat > Dockerfile << EOF
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY server/package*.json ./
COPY shared/package*.json ./shared/

# Install dependencies
RUN npm install --only=production

# Copy built application
COPY server/dist ./dist/
COPY shared/dist ./shared/dist/

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start the application
CMD ["npm", "start"]
EOF
        fi
        
        echo "🔨 Building project..."
        ./build.sh
        
        echo "🐳 Building Docker image..."
        docker build -t copilot-memory-mcp:latest .
        
        echo "✅ Docker image built: copilot-memory-mcp:latest"
        echo ""
        echo "🚀 To run: docker run -p 3000:3000 copilot-memory-mcp:latest"
        ;;
        
    "vercel")
        echo "📍 Deploying API to Vercel..."
        
        echo "🔨 Building API..."
        cd api && npm run build && cd ..
        
        echo "🚀 Deploying to Vercel..."
        npx vercel --prod
        
        echo ""
        echo "✅ API deployed successfully!"
        echo "🔗 You can now configure your VSCode extension to use the deployed API"
        echo "� Visit the deployment URL to see the API documentation"
        ;;
        
    "build")
        echo "📍 Building all components..."
        ./build.sh
        echo "✅ Build complete!"
        ;;
        
    "help"|"-h"|"--help")
        show_usage
        ;;
        
    *)
        echo "❌ Unknown target: $TARGET"
        echo ""
        show_usage
        exit 1
        ;;
esac