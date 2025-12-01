# 🧠 ContextIQ - Smart Context for GitHub Copilot

<div align="center">

![Version](https://img.shields.io/badge/version-1.3.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![VS Code](https://img.shields.io/badge/VS%20Code-1.74%2B-orange.svg)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)
![SQLite](https://img.shields.io/badge/storage-SQLite%20FTS5-yellow.svg)

**Give your GitHub Copilot a brain! Persistent memory, automatic coding rules, and smart context awareness.**

*"Smart context for smarter code"*

[Features](#-features) • [Installation](#-installation) • [Quick Start](#-quick-start) • [Smart Context](#-smart-context-system) • [Rules](#-rules-system) • [Code Indexing](#-code-indexing)

</div>

---

## 🌟 What Makes This Special?

> **"Remember this pattern"** → Copilot stores it with related files and symbols  
> **"Save as rule: Always use TypeScript strict mode"** → Applied automatically in every chat  
> **"Find all usages of AuthService"** → Instant cross-file symbol search

### ✨ Key Highlights

| Feature | Description |
|---------|-------------|
| 🧠 **Smart Context** | Automatically tracks active files, extracts symbols, and links related code |
| 📋 **Automatic Rules** | Define coding guidelines once, applied in every chat session |
| 🔍 **Code Indexing** | 27+ language support with symbol search across your entire codebase |
| ⚡ **Blazing Fast** | SQLite FTS5 with 10-30ms response times |
| 🔒 **100% Private** | All data stored locally - no cloud required |
| 🎯 **Multi-Scope** | Project, user, and global knowledge separation |

---

## 🚀 Features

### 🧠 Intelligent Knowledge Storage

Store and retrieve coding knowledge with natural language:

```
"Remember this: React useEffect cleanup prevents memory leaks"
"Retrieve knowledge about authentication"
"What patterns did I save for error handling?"
```

**Smart Features:**
- 📁 **Auto-links active file** when storing knowledge
- 🔗 **Extracts related symbols** from content (functions, classes, imports)
- 📊 **Discovers related files** through import analysis
- 🏷️ **Tag-based organization** with full-text search

### 📋 Automatic Rules System

Define rules that Copilot follows automatically:

```
"Save as rule: Use 2-space indentation, never tabs"
"Remember rule: All API calls go through ApiService"
"Add rule: Minimum 80% test coverage required"
```

**How It Works:**
1. You define a rule → Stored with category and priority
2. Every chat session → Rules auto-loaded at start
3. Copilot writes code → Follows your rules automatically

| Category | Examples | Priority |
|----------|----------|----------|
| `security` | Never commit secrets, validate inputs | 9-10 |
| `architecture` | Repository pattern, service layers | 7-9 |
| `code-style` | Naming conventions, formatting | 5-7 |
| `testing` | Coverage requirements, test patterns | 7-8 |

### 🔍 Code Indexing & Symbol Search

Index your entire codebase for instant symbol lookup:

```
"Search for AuthService class"
"Find all functions named handleSubmit"
"What files import the UserContext?"
```

**Supported Languages (27+):**
`TypeScript` `JavaScript` `Python` `Rust` `Go` `Java` `C/C++` `C#` `Ruby` `PHP` `Swift` `Kotlin` `Scala` `Dart` `Lua` `R` `Julia` `Elixir` `Clojure` `Haskell` `OCaml` `F#` `Zig` `Nim` `Crystal` `V` `Odin`

### 🎯 Smart Context System

**NEW in v1.3.0!** The extension now automatically enriches stored knowledge:

```
┌─────────────────────────────────────────────────────────┐
│  You're editing: src/services/AuthService.ts            │
│  You say: "Remember this OAuth implementation"          │
├─────────────────────────────────────────────────────────┤
│  ✅ Content stored                                       │
│  📁 Active file: src/services/AuthService.ts            │
│  🔗 Related files: UserService.ts, TokenManager.ts      │
│  📍 Related symbols: OAuth2Client, refreshToken()       │
└─────────────────────────────────────────────────────────┘
```

**Automatic Entity Extraction:**
- File paths from code blocks and inline references
- Import statements and module dependencies  
- Function calls and class references
- Symbol names for cross-referencing

### ⚡ Performance

| Operation | Response Time | Notes |
|-----------|---------------|-------|
| Store Knowledge | 10-20ms | With auto-enrichment |
| Retrieve Knowledge | 15-30ms | FTS5 full-text search |
| Search Symbols | 5-15ms | Indexed lookup |
| Retrieve Rules | 8-15ms | Auto-loaded every chat |

**Optimizations:**
- 💾 SQLite WAL mode with 64MB cache
- 📊 Prepared statement caching
- 🔄 Persistent MCP server (no spawn overhead)
- 🗂️ Memory-mapped I/O (30GB mmap)

---

## 📦 Installation

### From VSIX (Recommended)

1. Download `contextiq-1.3.0.vsix`
2. Press `Cmd/Ctrl + Shift + P` → "Extensions: Install from VSIX"
3. Select the downloaded file
4. Reload VS Code

### From Source

```bash
# Clone and navigate to extension
cd copilot-memory-mcp/extension

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Package extension
npm run package

# Install the .vsix file
code --install-extension contextiq-1.3.0.vsix
```

---

## 🎮 Quick Start

### Step 1: Open the Sidebar

Click the **🧠 ContextIQ** icon in the VS Code activity bar.

### Step 2: One-Click Setup

Choose your preferred method:

| Button | What It Does |
|--------|--------------|
| 🚀 **Install & Configure** | Complete automated setup |
| 📋 **Copy MCP Configuration** | Manual paste into Copilot settings |
| 📝 **Update Copilot Instructions** | Add/update rules support file |

### Step 3: Start Using

Open GitHub Copilot Chat and try:

```
"Remember this: Always validate user input before database operations"

"Save as rule: Use async/await instead of .then() chains"

"Retrieve knowledge about error handling"

"Search for UserService class"
```

---

## 🎯 Smart Context System

### How It Works

When you store knowledge, the system automatically:

```
┌─────────────────────────────────────────────────────────────┐
│                    SMART CONTEXT FLOW                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. CONTENT ANALYSIS                                         │
│     ├── Extract file paths (./src/utils/helpers.ts)         │
│     ├── Parse import statements                              │
│     └── Identify function/class names                        │
│                                                              │
│  2. SYMBOL LOOKUP                                            │
│     ├── Search indexed codebase for mentioned symbols        │
│     └── Find related definitions and usages                  │
│                                                              │
│  3. FILE DISCOVERY                                           │
│     ├── Analyze import relationships                         │
│     └── Link related files through dependencies              │
│                                                              │
│  4. CONTEXT ATTACHMENT                                       │
│     ├── Active file → Automatically tracked                  │
│     ├── Related files → JSON array stored                    │
│     └── Related symbols → With file and line info            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Retrieval Enhancement

When you retrieve knowledge, you get enriched results:

```
🧠 Found 3 entries:

[PROJECT] Authentication implementation using JWT tokens
  📁 Active file: src/services/AuthService.ts
  🔗 Related: UserService.ts, TokenManager.ts, middleware/auth.ts
  📍 Symbols: verifyToken(), refreshSession(), AuthContext

[GLOBAL] Error handling patterns for async operations
  📍 Symbols: AsyncErrorBoundary, handleApiError()
```

---

## 📋 Rules System

### Creating Rules

```
"Save as rule: Never use any in TypeScript, always define proper types"
```

Copilot stores:
```typescript
{
  title: "No Any Types",
  content: "Never use 'any' in TypeScript, always define proper types",
  category: "code-style",
  priority: 8,
  enabled: true
}
```

### Rule Categories

| Category | Purpose | Example |
|----------|---------|---------|
| `code-style` | Formatting, naming | "Use camelCase for variables" |
| `architecture` | Design patterns | "Services must be stateless" |
| `testing` | Test requirements | "Every component needs a test" |
| `security` | Security guidelines | "Validate all user inputs" |
| `performance` | Optimization | "Lazy load heavy components" |
| `general` | Best practices | "Document public APIs" |

### Priority System

| Priority | Level | When to Use |
|----------|-------|-------------|
| 9-10 | 🔴 Critical | Security, must-follow rules |
| 7-8 | 🟠 Important | Architecture, standards |
| 5-6 | 🟡 Standard | Code style, conventions |
| 3-4 | 🟢 Suggested | Nice-to-have practices |
| 0-2 | ⚪ Optional | Reminders, preferences |

### Managing Rules

```
"List all my rules"           → Shows all rules with IDs
"Update rule abc123 priority to 10"
"Disable rule xyz789"
"Delete rule abc123"
```

---

## 🔍 Code Indexing

### Indexing Your Workspace

The extension can index your entire codebase:

```
"Index this workspace"        → Full workspace indexing
"Index this file"             → Single file indexing
"Get index statistics"        → View indexed files/symbols
```

### Symbol Search

```
"Search for handleSubmit"     → Find all functions named handleSubmit
"Find UserService class"      → Locate class definitions
"What files use AuthContext"  → Find imports and usages
```

### Symbol Kinds

| Kind | Code | Examples |
|------|------|----------|
| Class | 5 | `class UserService` |
| Method | 6 | `user.getName()` |
| Function | 12 | `function validateInput()` |
| Variable | 13 | `const API_URL = ...` |
| Interface | 11 | `interface UserProps` |
| Enum | 10 | `enum Status` |

---

## 🔧 MCP Tools Reference

### Knowledge Tools (3)

| Tool | Description |
|------|-------------|
| `store_knowledge` | Store information with auto-context enrichment |
| `retrieve_knowledge` | Search with FTS5 + symbol matching |
| `list_knowledge` | Browse all stored entries |

### Rules Tools (5)

| Tool | Description |
|------|-------------|
| `store_rule` | Create a new coding rule |
| `retrieve_rules` | Auto-called at chat start |
| `list_rules` | Show all rules with IDs |
| `update_rule` | Modify existing rules |
| `delete_rule` | Remove a rule permanently |

### Code Indexing Tools (6)

| Tool | Description |
|------|-------------|
| `index_file` | Index single file |
| `index_workspace` | Batch index all files |
| `search_symbols` | Full-text symbol search |
| `get_file_symbols` | List symbols in a file |
| `find_references` | Find imports and usages |
| `get_index_stats` | View indexing statistics |

---

## ⚙️ Configuration

### VS Code Settings

```json
{
  "copilotMemory.storage.local.dataDir": "~/.copilot-memory",
  "copilotMemory.storage.local.projectSpecific": true,
  "copilotMemory.mcp.autoStart": true,
  "copilotMemory.logging.level": "info"
}
```

### Multi-Scope Storage

| Scope | Database | Use Case |
|-------|----------|----------|
| `project` | `{projectName}.db` | Project-specific patterns |
| `user` | `user.db` | Personal preferences |
| `global` | `global.db` | Cross-project knowledge |

### MCP Configuration

Auto-generated when you click **Copy MCP Configuration**:

```json
{
  "mcpServers": {
    "contextiq": {
      "command": "node",
      "args": ["/path/to/server/index-sqlite.js"],
      "description": "ContextIQ - Smart context for smarter code"
    }
  }
}
```

---

## 🎮 Commands

| Command | Description |
|---------|-------------|
| `ContextIQ: Install & Configure` | One-click complete setup |
| `ContextIQ: Copy MCP Configuration` | Copy config to clipboard |
| `ContextIQ: Update Copilot Instructions` | Force update .github file |
| `ContextIQ: Select Project` | Switch project database |
| `ContextIQ: Project Statistics` | View storage stats |
| `ContextIQ: Start/Stop Server` | MCP server control |
| `ContextIQ: Export/Import Memory` | Backup and restore |
| `ContextIQ: Clear Memory` | Reset all data |
| `ContextIQ: Reset MCP Configuration` | Switch from other MCPs |

---

## 🐛 Troubleshooting

### Rules Not Applied

1. Click **📝 Update Copilot Instructions**
2. Check `.github/copilot-instructions.md` exists
3. Verify `[copilot-memory-mcp]` section is present
4. Reload VS Code

### Database Errors

```bash
# Delete corrupted database (data will be lost)
rm ~/.copilot-memory/{project}.db

# Reopen VS Code - fresh database created
```

### Server Won't Start

1. Check Node.js: `node --version` (requires 18+)
2. Verify server path in settings
3. Check Output panel for errors

### Slow Performance

```
"List knowledge with optimize: true"  → Runs VACUUM and ANALYZE
```

---

## 📁 Project Structure

```
contextiq/
├── extension/
│   ├── src/
│   │   ├── extension.ts           # Main entry point
│   │   ├── embeddedMCPServerSQLite.ts
│   │   ├── activeFileTracker.ts   # Smart context tracking
│   │   ├── memoryTreeProvider.ts  # Sidebar UI
│   │   └── configuration.ts
│   └── package.json
│
├── server/
│   ├── index-sqlite.js            # MCP server (14 tools)
│   ├── contextEnricher.js         # Entity extraction
│   └── package.json
│
└── .github/
    └── copilot-instructions.md    # Auto-generated
```

---

## 📝 Changelog

### v1.3.0 (Current) 🎉

- ✨ **Smart Context System** - Auto-tracks files, symbols, and relationships
- 🔗 **Entity Extraction** - Parses file paths, imports, and symbol names
- 📁 **Active File Tracking** - Links knowledge to current editor file
- 🔄 **Automatic Migration** - Seamless upgrade from older versions
- 🐛 **FTS5 Rebuild** - Fixed migration for existing databases

### v1.2.0

- 🔍 **Code Indexing** - 27+ language support
- 📊 **Symbol Search** - Cross-file function/class lookup
- 📈 **Index Statistics** - Workspace analysis

### v1.1.0

- 📋 **Rules System** - Automatic coding guidelines
- ⚡ **25-80x Faster** - Performance optimizations
- 🚀 **One-Click Setup** - Simplified installation

### v1.0.0

- 🎉 Initial release
- 🧠 Knowledge storage with FTS5
- 📁 Project-specific databases

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push: `git push origin feature/amazing`
5. Open Pull Request

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

<div align="center">

**Made with ❤️ by [Kiran Benny Joseph](https://kiranbennyjoseph.dev)**

⭐ **Star this repo if you find it helpful!**

[Report Bug](https://github.com/Ikolvi/ContextIQ/issues) • [Request Feature](https://github.com/Ikolvi/ContextIQ/discussions)

</div>
