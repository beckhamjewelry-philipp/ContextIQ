#!/bin/bash

# CustomerIQ Release Package Script
# Creates a distributable release archive

set -e

VERSION="2.0.0"
PACKAGE_NAME="customeriq-v${VERSION}"
BUILD_DIR="dist"
RELEASE_DIR="${BUILD_DIR}/${PACKAGE_NAME}"

echo "╔═══════════════════════════════════════════════════╗"
echo "║         CustomerIQ Release Packaging             ║"
echo "║                 Version ${VERSION}                    ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf "${BUILD_DIR}"
mkdir -p "${RELEASE_DIR}"

# Copy application files
echo "📦 Copying application files..."
cp -r server "${RELEASE_DIR}/"
cp -r extension "${RELEASE_DIR}/" 2>/dev/null || true

# Copy configuration and scripts
echo "⚙️  Copying configuration..."
cp config.env.example "${RELEASE_DIR}/"
cp build.sh "${RELEASE_DIR}/"
cp build.bat "${RELEASE_DIR}/"
cp start.sh "${RELEASE_DIR}/"
cp start.bat "${RELEASE_DIR}/"
cp quickstart-nats.sh "${RELEASE_DIR}/" 2>/dev/null || true

# Copy documentation
echo "📚 Copying documentation..."
cp README.md "${RELEASE_DIR}/"
cp API_REFERENCE.md "${RELEASE_DIR}/"
cp DEPLOYMENT_GUIDE.md "${RELEASE_DIR}/"
cp DEVOPS_CONTROL_API.md "${RELEASE_DIR}/"
cp NATS_INTEGRATION.md "${RELEASE_DIR}/"
cp CUSTOMER_PLATFORM_README.md "${RELEASE_DIR}/"
cp REBRANDING_SUMMARY.md "${RELEASE_DIR}/"
cp TRANSFORMATION_COMPLETE.md "${RELEASE_DIR}/"
cp LICENSE "${RELEASE_DIR}/" 2>/dev/null || true

# Create installation instructions
cat > "${RELEASE_DIR}/INSTALL.md" << 'EOF'
# CustomerIQ v2.0.0 - Installation Guide

## Quick Start

1. **Install dependencies**:
   ```bash
   ./build.sh  # or build.bat on Windows
   ```

2. **Configure**:
   ```bash
   cp config.env.example config.env
   nano config.env
   ```

3. **Start**:
   ```bash
   ./start.sh  # or start.bat on Windows
   ```

4. **Access**:
   - Web UI: http://localhost:3000
   - Control API: http://localhost:9000

## Documentation

- README.md - Main documentation
- DEPLOYMENT_GUIDE.md - Production deployment
- DEVOPS_CONTROL_API.md - DevOps control interface
- API_REFERENCE.md - Complete API reference
- NATS_INTEGRATION.md - Event integration

## Support

For issues and questions, see README.md
EOF

# Remove node_modules from package
echo "🗑️  Removing node_modules..."
rm -rf "${RELEASE_DIR}/server/node_modules"
rm -rf "${RELEASE_DIR}/extension/node_modules" 2>/dev/null || true

# Create .gitignore for release
cat > "${RELEASE_DIR}/.gitignore" << 'EOF'
node_modules/
*.log
config.env
.env
*.db
.customeriq/
dist/
EOF

# Create tarball
echo "📦 Creating release archive..."
cd "${BUILD_DIR}"
tar -czf "${PACKAGE_NAME}.tar.gz" "${PACKAGE_NAME}"
zip -r -q "${PACKAGE_NAME}.zip" "${PACKAGE_NAME}"

echo ""
echo "✅ Release package created successfully!"
echo ""
echo "📦 Files created:"
echo "   - ${BUILD_DIR}/${PACKAGE_NAME}.tar.gz"
echo "   - ${BUILD_DIR}/${PACKAGE_NAME}.zip"
echo "   - ${BUILD_DIR}/${PACKAGE_NAME}/ (directory)"
echo ""
echo "📊 Package size:"
du -sh "${PACKAGE_NAME}.tar.gz" "${PACKAGE_NAME}.zip"
echo ""
echo "🚀 Ready for distribution!"
