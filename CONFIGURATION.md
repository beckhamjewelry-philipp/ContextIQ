# Copilot Memory MCP - Configuration Guide

## 🎯 Quick Start

To use Copilot Memory with GitHub Copilot, you need to configure GitHub Copilot to use this MCP server.

## 📋 Prerequisites

- ✅ Node.js 18+ installed
- ✅ GitHub Copilot extension in VS Code
- ✅ Copilot Memory MCP extension installed

## 🚀 Setup Steps

### 1. Install Dependencies

```bash
cd /Users/admin/NodeMCPs/copilot-memory-mcp/server
npm install
```

### 2. Configure GitHub Copilot MCP

GitHub Copilot needs to know about your MCP server. Add this configuration:

#### macOS/Linux Configuration

Create or edit: `~/.config/github-copilot/mcp-config.json`

```json
{
  "mcpServers": {
    "copilot-memory": {
      "command": "node",
      "args": [
        "/Users/admin/NodeMCPs/copilot-memory-mcp/server/index.js"
      ],
      "description": "Persistent memory with SQLite, FTS5 search, and multi-scope organization"
    }
  }
}
```

**Important:** Replace `/Users/admin/NodeMCPs` with your actual workspace path!

#### Windows Configuration

Create or edit: `%APPDATA%\github-copilot\mcp-config.json`

```json
{
  "mcpServers": {
    "copilot-memory": {
      "command": "node",
      "args": [
        "C:\\Users\\YourUsername\\NodeMCPs\\copilot-memory-mcp\\server\\index.js"
      ],
      "description": "Persistent memory with SQLite, FTS5 search, and multi-scope organization"
    }
  }
}
```

### 3. Verify Configuration

Check the config file exists:

```bash
# macOS/Linux
cat ~/.config/github-copilot/mcp-config.json

# Windows
type %APPDATA%\github-copilot\mcp-config.json
```

### 4. Restart VS Code

Complete restart required for GitHub Copilot to load the MCP server:
1. Close **all** VS Code windows
2. Reopen VS Code
3. Wait for GitHub Copilot to initialize

### 5. Test the Integration

Open GitHub Copilot Chat and try:

```
remember that we use TypeScript for this project
```

Then verify:

```
retrieve information about TypeScript
```

You should get back the stored information! 🎉

## 🎮 Usage Examples

### Store Knowledge

Use natural language in Copilot Chat:

```
remember that the API endpoint is https://api.example.com
remember [user] I prefer tabs over spaces
remember [global] use semantic versioning for all releases
```

**Scopes:**
- `remember` - PROJECT scope (default, current project only)
- `remember [user]` - USER scope (across all your projects)
- `remember [global]` - GLOBAL scope (universal best practices)

### Retrieve Knowledge

```
retrieve API configuration
retrieve from user scope my preferences
what do you remember about versioning?
list all knowledge
```

### Advanced Examples

```
remember [user] my debugging preference: always use console.log with timestamps
remember [global] SOLID principles: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion
remember the database connection uses connection pooling with max 10 connections
```

## 📂 Data Storage

### Database Location

All knowledge is stored in SQLite databases:

```
~/.copilot-memory/
├── {project-name}.db  # Project-specific knowledge
├── user.db            # User preferences
├── global.db          # Global best practices
└── ...
```

### Database Features

Each database includes:
- ✅ **FTS5 Full-Text Search** - Fast, accurate multi-keyword search
- ✅ **BM25 Ranking** - Results sorted by relevance
- ✅ **Automatic Indexing** - No manual maintenance needed
- ✅ **Triggers** - Keep search index in sync automatically

## 🔧 Advanced Configuration

### Environment Variables

You can customize behavior with environment variables:

```bash
# Custom storage location
export COPILOT_MEMORY_DIR="$HOME/my-custom-location"

# Enable verbose logging
export COPILOT_MEMORY_DEBUG="true"

# Custom SQLite options
export COPILOT_MEMORY_SQLITE_CACHE_SIZE="10000"
```

### MCP Server Options

You can pass options via the config:

```json
{
  "mcpServers": {
    "copilot-memory": {
      "command": "node",
      "args": [
        "/path/to/server/index.js"
      ],
      "env": {
        "COPILOT_MEMORY_DIR": "/custom/path",
        "COPILOT_MEMORY_DEBUG": "true"
      },
      "description": "Copilot Memory with custom settings"
    }
  }
}
```

## 🔍 Troubleshooting

### Server Not Starting

**Check Node.js version:**
```bash
node --version  # Should be 18+
```

**Test server manually:**
```bash
cd /path/to/copilot-memory-mcp/server
node index.js
```

Expected output: Server should start and wait for connections.

### Config File Not Found

**Create directory:**
```bash
# macOS/Linux
mkdir -p ~/.config/github-copilot

# Windows
mkdir %APPDATA%\github-copilot
```

**Then create the config file** as shown in step 2 above.

### Copilot Not Using MCP

1. **Verify config path:**
   ```bash
   # macOS/Linux
   ls -la ~/.config/github-copilot/mcp-config.json
   ```

2. **Check JSON syntax:**
   ```bash
   # Validate JSON
   cat ~/.config/github-copilot/mcp-config.json | python3 -m json.tool
   ```

3. **Check VS Code output:**
   - Open: View → Output
   - Select: GitHub Copilot
   - Look for MCP-related messages

### Knowledge Not Storing

**Check storage directory:**
```bash
ls -la ~/.copilot-memory/
```

**Check permissions:**
```bash
mkdir -p ~/.copilot-memory
chmod 755 ~/.copilot-memory
```

**Enable debug logging:**
```json
{
  "mcpServers": {
    "copilot-memory": {
      "command": "node",
      "args": ["/path/to/server/index.js"],
      "env": {
        "COPILOT_MEMORY_DEBUG": "true"
      }
    }
  }
}
```

### Search Not Working

**Run migration script:**
```bash
cd /path/to/copilot-memory-mcp/scripts
node migrate-to-fts5.js
```

This ensures all databases have FTS5 enabled.

## 🆙 Upgrading from Previous Versions

### From v1.0.5 or Earlier

Run the migration script:

```bash
cd /path/to/copilot-memory-mcp/scripts
node migrate-to-fts5.js
```

This adds:
- ✅ FTS5 full-text search
- ✅ Multi-scope support
- ✅ Better search accuracy

See [FTS5_MIGRATION.md](./FTS5_MIGRATION.md) for details.

### From v1.0.6

Migration script will add multi-scope support:
- Existing data becomes PROJECT scope
- User and global scopes created on first use
- No data loss

## 📊 Monitoring

### Check Database Status

```bash
# List all databases
ls -lh ~/.copilot-memory/

# Check database size
du -sh ~/.copilot-memory/*.db

# Count entries
sqlite3 ~/.copilot-memory/your-project.db "SELECT COUNT(*) FROM knowledge"
```

### View Recent Entries

```bash
sqlite3 ~/.copilot-memory/your-project.db "SELECT created_at, content FROM knowledge ORDER BY created_at DESC LIMIT 10"
```

### Search Performance Test

```bash
cd /path/to/copilot-memory-mcp/scripts
node test-fts5-search.js
```

## 🔒 Security & Privacy

### Local Storage Only

- ✅ All data stored locally on your machine
- ✅ No cloud synchronization
- ✅ You control all data
- ✅ No API keys required

### Data Location

```
~/.copilot-memory/  # Your home directory only
```

### Backup Your Knowledge

```bash
# Backup all databases
cp -r ~/.copilot-memory ~/.copilot-memory-backup

# Or backup specific project
cp ~/.copilot-memory/myproject.db ~/backups/
```

## 📚 Learn More

- [Multi-Scope Guide](./MULTI_SCOPE_GUIDE.md) - Using project/user/global scopes
- [FTS5 Migration](./FTS5_MIGRATION.md) - Search improvements
- [README](./README.md) - Full documentation
- [CHANGELOG](./extension/changelog.md) - Version history

## 🎯 Quick Reference

### Config File Locations

| OS | Path |
|----|------|
| macOS | `~/.config/github-copilot/mcp-config.json` |
| Linux | `~/.config/github-copilot/mcp-config.json` |
| Windows | `%APPDATA%\github-copilot\mcp-config.json` |

### Data Storage Locations

| OS | Path |
|----|------|
| macOS | `~/.copilot-memory/*.db` |
| Linux | `~/.copilot-memory/*.db` |
| Windows | `%USERPROFILE%\.copilot-memory\*.db` |

### Essential Commands

```bash
# Install dependencies
cd server && npm install

# Test server
node server/index.js

# Migrate databases
node scripts/migrate-to-fts5.js

# Test search
node scripts/test-fts5-search.js

# Check databases
ls -la ~/.copilot-memory/
```

---

**You're all set!** 🚀 GitHub Copilot will now remember everything you tell it and retrieve information when you need it.
