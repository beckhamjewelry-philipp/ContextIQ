# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial project setup and architecture
- MCP server with flexible storage backends
- VSCode extension with full UI integration
- Local SQLite storage backend
- Server-side HTTP storage backend  
- Hybrid storage combining local and server
- Intelligent search with fuzzy matching
- Conflict detection and resolution system
- Memory explorer tree view in VSCode
- Configuration management system
- Export/import functionality
- Comprehensive documentation

### Changed
- N/A (initial release)

### Deprecated
- N/A (initial release)

### Removed
- N/A (initial release)

### Fixed
- N/A (initial release)

### Security
- N/A (initial release)

## [1.0.0] - 2025-11-05

### Added
- **MCP Server Implementation**
  - TypeScript-based MCP server with latest dependencies
  - Three storage backend options: local, server, hybrid
  - SQLite local storage with full-text search
  - HTTP server storage with authentication
  - Hybrid storage for best of both worlds
  - Fuzzy search using Fuse.js for content matching
  - Conflict detection using content similarity
  - Comprehensive error handling and logging

- **VSCode Extension**
  - Complete VSCode extension for Copilot integration
  - Memory explorer tree view with categorization
  - Configuration management through VSCode settings
  - Command palette integration
  - Webview for memory visualization
  - Export/import functionality
  - Real-time memory synchronization

- **MCP Tools**
  - `store-knowledge`: Store memories with tags and metadata
  - `retrieve-knowledge`: Search memories with intelligent ranking
  - `manage-knowledge`: Full CRUD operations on memory entries
  - Conflict resolution with automated suggestions
  - Context-aware storage (workspace, project, source)

- **Developer Experience**
  - Complete TypeScript setup with strict mode
  - Comprehensive build and development scripts
  - Automated packaging for distribution
  - Extensive documentation and examples
  - Contributing guidelines and code of conduct

- **Configuration System**
  - Flexible storage configuration
  - Environment variable support
  - VSCode settings integration
  - Automatic configuration generation
  - Runtime configuration updates

### Technical Details

#### Storage Backends

**Local Storage**
- SQLite database with indexed search
- Automatic schema migration
- JSON metadata storage
- File-based configuration

**Server Storage**  
- RESTful HTTP API client
- Bearer token authentication
- Request timeout handling
- Automatic retry logic

**Hybrid Storage**
- Local-first architecture
- Background server synchronization
- Fallback mechanisms
- Conflict resolution

#### Search and Indexing

- Full-text search on content
- Tag-based filtering
- Source and context filtering
- Fuzzy matching with configurable thresholds
- Score-based result ranking
- Highlighting of matching terms

#### Security

- API key authentication for server storage
- Local database file permissions
- Input validation with Zod schemas
- Sanitized error messages
- No sensitive data in logs

### Performance

- Optimized SQLite queries with proper indexing
- Lazy loading of large result sets
- Efficient memory usage in VSCode extension
- Background processing for non-critical operations
- Configurable limits and timeouts

### Compatibility

- Node.js 18+ required
- VSCode 1.85+ required
- Cross-platform (macOS, Windows, Linux)
- MCP SDK 1.0.4 compatible
- Latest TypeScript 5.6 support

### Known Issues

- TypeScript compilation warnings for missing node/vscode types
- Manual dependency installation required (Node.js ecosystem)
- Server storage requires separate API implementation
- Memory export limited by VSCode API constraints

### Migration Guide

N/A (initial release)

### Breaking Changes

N/A (initial release)

---

## Release Notes Format

### Types of Changes
- **Added** for new features
- **Changed** for changes in existing functionality  
- **Deprecated** for soon-to-be removed features
- **Removed** for now removed features
- **Fixed** for any bug fixes
- **Security** for vulnerability fixes

### Version Numbers
Following semantic versioning (MAJOR.MINOR.PATCH):
- MAJOR: incompatible API changes
- MINOR: functionality additions (backward compatible)
- PATCH: bug fixes (backward compatible)