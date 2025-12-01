#!/bin/bash

# Package script for Copilot Memory MCP project

set -e

echo "📦 Packaging Copilot Memory MCP..."

# Build everything first
echo "🔨 Building project..."
./build.sh

# Package VSCode extension
echo "🔌 Packaging VSCode extension..."
cd extension
npx vsce package
cd ..

# Create server distribution
echo "🖥️  Creating server distribution..."
cd server
npm pack
cd ..

# Create distribution directory
echo "📂 Creating distribution directory..."
mkdir -p dist

# Copy packages
cp extension/*.vsix dist/ 2>/dev/null || echo "No VSIX files found"
cp server/*.tgz dist/ 2>/dev/null || echo "No TGZ files found"

# Create installation script
cat > dist/install.sh << 'EOF'
#!/bin/bash

echo "🚀 Installing Copilot Memory MCP..."

# Check for VSCode
if ! command -v code &> /dev/null; then
    echo "❌ VSCode not found. Please install VSCode first."
    exit 1
fi

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+ first."
    exit 1
fi

# Install extension
echo "🔌 Installing VSCode extension..."
for vsix in *.vsix; do
    if [ -f "$vsix" ]; then
        code --install-extension "$vsix"
        echo "✅ Extension installed: $vsix"
    fi
done

# Install server globally (optional)
echo "🖥️  Installing MCP server..."
for tgz in *.tgz; do
    if [ -f "$tgz" ]; then
        npm install -g "$tgz"
        echo "✅ Server installed: $tgz"
    fi
done

echo ""
echo "🎉 Installation complete!"
echo ""
echo "📋 Next steps:"
echo "1. Restart VSCode"
echo "2. Open Command Palette (Cmd+Shift+P)"
echo "3. Run 'Copilot Memory: Configure Storage'"
echo "4. Start using Copilot Memory!"
EOF

chmod +x dist/install.sh

# Create README for distribution
cat > dist/README.md << 'EOF'
# Copilot Memory MCP - Distribution

This directory contains the packaged distribution of Copilot Memory MCP.

## Files

- `*.vsix` - VSCode extension package
- `*.tgz` - MCP server package  
- `install.sh` - Automated installation script

## Quick Install

```bash
chmod +x install.sh
./install.sh
```

## Manual Install

### VSCode Extension
```bash
code --install-extension copilot-memory-extension-1.0.0.vsix
```

### MCP Server (optional global install)
```bash
npm install -g copilot-memory-mcp-server-1.0.0.tgz
```

## Configuration

After installation, configure storage by:
1. Opening VSCode Command Palette (`Cmd+Shift+P`)
2. Running `Copilot Memory: Configure Storage`
3. Selecting your preferred storage type

For more information, see the main README.md file.
EOF

echo "✅ Packaging complete!"
echo ""
echo "📦 Distribution created in ./dist/"
echo "📋 Contents:"
ls -la dist/
echo ""
echo "🚀 To install: cd dist && ./install.sh"