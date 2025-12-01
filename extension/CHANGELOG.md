# Change Log

All notable changes to **ContextIQ** (formerly "Copilot Memory SQLite") extension will be documented in this file.

## [1.3.0] - 2025-12-02

### 🎉 Rebranded to ContextIQ
- New name: **ContextIQ** - "Smart context for smarter code"
- Updated branding across all UI elements, commands, and documentation
- Fresh visual identity with improved README

### 🧠 Smart Context-Aware Knowledge System
- ✨ **Automatic Context Enrichment** - Knowledge is now automatically enriched with related files, symbols, and the active file you're working on
- 📁 **Active File Tracking** - The extension tracks which file you're editing and attaches it to stored knowledge
- 🔗 **Symbol Extraction** - Function calls, class names, and imports are automatically extracted and linked
- 📊 **Related File Discovery** - Files are linked through import analysis and symbol references
- 🔍 **Enhanced Retrieval** - Search results now include related files and symbols for better context

### New Features
- `related_files` - Automatically populated array of related file paths in stored knowledge
- `related_symbols` - Automatically populated array of related symbols (name, kind, file, line)
- `active_file` - The file that was active when knowledge was stored
- `include_related` parameter in retrieve_knowledge - Include related context in results (default: true)
- ActiveFileTracker class for real-time file tracking in VS Code
- ContextEnricher class for intelligent entity extraction and symbol lookup

### Technical Changes
- New database columns: `related_files`, `related_symbols`, `active_file` in knowledge table
- FTS5 index updated to include new columns for full-text search
- Auto-migration for existing databases to add new columns
- Entity extraction with regex patterns for file paths, imports, functions, and classes
- Symbol lookup integration with code indexing for cross-reference

### Use Cases
```
# Store knowledge while editing a file - context is auto-attached
"Remember this TypeScript pattern for error handling"
→ Stores: content + active file (extension.ts) + related symbols (handleError, ErrorHandler)

# Retrieve with context - see related code
"Retrieve error handling patterns"
→ Returns: knowledge + related files + matching symbols from codebase
```

## [1.2.0] - 2025-01-19

### 🔍 Code Indexing System
- ✨ **Symbol Indexing** - Extract and index functions, classes, methods across the codebase
- 📊 **Import Tracking** - Track import relationships between files
- 🔎 **Symbol Search** - Full-text search across all indexed symbols
- 📁 **File Symbols** - Get all symbols and imports for a specific file
- 🔗 **Find References** - Find files that import a module or define a symbol
- 📈 **Index Statistics** - Get codebase size and language breakdown

### New Tools
- `mcp_copilot-memor_index_file` - Index a single file
- `mcp_copilot-memor_index_workspace` - Batch index all files
- `mcp_copilot-memor_search_symbols` - Search for symbols
- `mcp_copilot-memor_get_file_symbols` - Get file structure
- `mcp_copilot-memor_find_references` - Find importers and definitions
- `mcp_copilot-memor_get_index_stats` - Get index statistics

## [1.0.7] - 2025-11-06

### 🎯 Major Feature: Multi-Scope Knowledge Management
- ✨ **Project Scope** - Knowledge specific to current project only
- 👤 **User Scope** - Personal preferences across all projects
- 🌐 **Global Scope** - Universal best practices shared globally
- 🔍 **Search All Scopes** - Query across project/user/global or specific scope
- 📊 **Multi-Scope Listing** - View knowledge from all scopes at once

### New Features
- `scope` parameter in store_knowledge: 'project', 'user', or 'global' (default: project)
- `scope` parameter in retrieve_knowledge: 'project', 'user', 'global', or 'all' (default: all)
- `scope` parameter in list_knowledge: 'project', 'user', 'global', or 'all' (default: all)
- Separate databases for each scope: `{project}.db`, `user.db`, `global.db`
- Scope labels in search results showing where knowledge came from

### Use Cases
```
# Project-specific: "Remember this React project uses TypeScript"
scope: project

# Personal preferences: "Remember I prefer tabs over spaces"
scope: user

# Universal knowledge: "Remember semantic versioning best practices"
scope: global

# Search everywhere: "Retrieve TypeScript knowledge"
scope: all (default)
```

### Technical Changes
- Multiple database support with separate connections
- Scope-based database initialization
- Cross-scope search with result aggregation
- Graceful shutdown of all database connections

## [1.0.6] - 2025-11-06

### 🚀 Major Improvements
- ⚡ **FTS5 Full-Text Search** - Implemented SQLite FTS5 for dramatically improved search accuracy
- 🎯 **Multi-Keyword Search** - Now properly handles queries with multiple keywords
- 📊 **BM25 Ranking** - Results ranked by relevance using industry-standard BM25 algorithm
- 🔍 **Better Keyword Matching** - Partial words and compound terms now match correctly
- 🛡️ **Fallback Search** - Automatic fallback to LIKE search if FTS5 unavailable

### Fixed
- ❌ Keywords not returning correct content - Now finds all relevant matches
- ❌ Multi-word queries failing - Split into individual keywords with OR logic
- ❌ Poor result ordering - Results now ranked by relevance first, then date

### Technical Changes
- Added `knowledge_fts` virtual table using FTS5
- Implemented automatic sync triggers (INSERT, UPDATE, DELETE)
- Added BM25 relevance scoring to search queries
- Migration script included for existing databases (`scripts/migrate-to-fts5.js`)

## [1.0.5] - 2025-11-05

### Changed
- Version bump for marketplace publication

## [1.0.4] - 2025-11-05

### Added
- 🎯 **Auto-create `.github/copilot-instructions.md`** - Extension now automatically creates/updates this file on activation
- 📝 **GitHub Copilot integration instructions** - Tells Copilot about the 3 MCP tools (store, retrieve, list)
- 🔄 **Seamless ByteRover compatibility** - Adds Copilot Memory instructions while preserving existing ByteRover instructions
- 🛠 **Manual update command** - `Copilot Memory: Update Copilot Instructions File` for on-demand updates

### Changed
- Enhanced extension activation to automatically configure workspace for Copilot
- Improved user experience by eliminating manual setup of copilot-instructions.md

## [1.0.3] - 2025-11-05

### Added
- 🎨 **Professional marketplace icon** - Hexagonal brain+database+circuit design
- 🖼 **Visual identity** - Blue gradient icon for better marketplace visibility

## [1.0.0] - 2025-11-05

### Added
- 🚀 **Initial release** of Copilot Memory SQLite extension
- 🧠 **Natural language memory** for GitHub Copilot with "remember" and "retrieve" commands
- ⚡ **High-performance SQLite storage** (10x faster than JSON)
- 🔄 **One-click MCP configuration reset** to switch from ByteRover
- 📚 **Comprehensive pre-loaded knowledge** across 9+ programming categories
- 🎯 **Project-specific databases** for workspace isolation
- 🔒 **100% local storage** for privacy and offline support
- 📊 **Memory Explorer** sidebar for browsing stored knowledge
- 🔧 **Command palette integration** with intuitive commands
- 📦 **ByteRover knowledge import** for seamless migration
- 🛠 **MCP server configuration management**
- 📈 **Project statistics** and database optimization
- 💾 **Export/import functionality** for knowledge backup
- 🔍 **Advanced search capabilities** with SQLite indexing

### Features
- SQLite database with full-text search and indexing
- Model Context Protocol (MCP) server integration
- GitHub Copilot Chat natural language interface
- Automatic configuration backup and restore
- Cross-platform support (macOS, Windows, Linux)
- TypeScript implementation for reliability
- Zero external dependencies for core functionality

### Knowledge Categories Included
- VSCode Extension Development
- TypeScript & Node.js Advanced Patterns
- Database & Storage Optimization
- MCP Protocol Implementation
- Mobile Development (Flutter/React Native)
- API Development (REST/GraphQL)
- DevOps & Deployment Strategies
- Frontend Development (React/Next.js)
- Security Practices & Authentication

### Commands Added
- `Copilot Memory: Reset MCP Configuration` - One-click ByteRover to SQLite migration
- `Copilot Memory: Setup Copilot MCP Integration` - Configure GitHub Copilot
- `Copilot Memory: Import ByteRover Knowledge` - Import existing knowledge
- `Copilot Memory: View Memory` - Browse stored knowledge
- `Copilot Memory: Project Statistics` - Database metrics
- `Copilot Memory: Export/Import Memory` - Backup functionality

### Technical Specifications
- **Performance**: 5ms response time vs 500ms cloud solutions
- **Storage**: Local SQLite with VACUUM optimization
- **Protocol**: JSON-RPC 2.0 MCP compliance
- **Compatibility**: VS Code 1.74+
- **Privacy**: 100% local data storage

---

**Author**: KIRAN BENNY JOSEPH  
**License**: MIT  
**Repository**: https://github.com/kiranbennyjoseph/copilot-memory-sqlite