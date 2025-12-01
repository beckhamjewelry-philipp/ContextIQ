# Copilot Memory MCP - Quick Start Guide

## ⚡ 3-Minute Setup

### Step 1: Install Dependencies (30 seconds)

```bash
cd /Users/admin/NodeMCPs/copilot-memory-mcp/server
npm install
```

### Step 2: Configure GitHub Copilot (1 minute)

Create the MCP config file:

```bash
# macOS/Linux
mkdir -p ~/.config/github-copilot
nano ~/.config/github-copilot/mcp-config.json
```

Paste this configuration (update the path!):

```json
{
  "mcpServers": {
    "copilot-memory": {
      "command": "node",
      "args": [
        "/Users/admin/NodeMCPs/copilot-memory-mcp/server/index.js"
      ],
      "description": "Persistent memory with SQLite, FTS5 search, and multi-scope"
    }
  }
}
```

**⚠️ Important:** Replace `/Users/admin/NodeMCPs` with your actual path!

### Step 3: Restart VS Code (30 seconds)

1. Close **all** VS Code windows
2. Reopen VS Code
3. Wait for GitHub Copilot to load

### Step 4: Test It! (1 minute)

Open **Copilot Chat** and try:

```
remember that we use TypeScript for this project
```

Then verify:

```
what do you remember about TypeScript?
```

✅ **Success!** If Copilot returns your stored information, you're all set!

---

## 🎮 Usage

### Store Knowledge

```
remember that the API endpoint is https://api.example.com
remember [user] I prefer tabs over spaces
remember [global] use semantic versioning
```

**Scopes:**
- Default → PROJECT (current project only)
- `[user]` → USER (all your projects)
- `[global]` → GLOBAL (universal best practices)

### Retrieve Knowledge

```
retrieve API configuration
what do you remember about my preferences?
list all knowledge
```

---

## 🔧 Troubleshooting

### Can't find config file?

```bash
# macOS/Linux
echo "Config location: ~/.config/github-copilot/mcp-config.json"

# Windows
echo "Config location: %APPDATA%\github-copilot\mcp-config.json"
```

### Server not starting?

```bash
# Test manually
cd /Users/admin/NodeMCPs/copilot-memory-mcp/server
node index.js
```

Should see server waiting for connections (press Ctrl+C to stop).

### Knowledge not storing?

```bash
# Check storage directory
ls -la ~/.copilot-memory/

# Should show .db files for each project
```

---

## 📚 Learn More

- **Full Configuration Guide:** [CONFIGURATION.md](./CONFIGURATION.md)
- **Multi-Scope Usage:** [MULTI_SCOPE_GUIDE.md](./MULTI_SCOPE_GUIDE.md)
- **Search Features:** [FTS5_MIGRATION.md](./FTS5_MIGRATION.md)
- **Complete Docs:** [README.md](./README.md)

---

**That's it!** 🚀 You now have persistent memory for GitHub Copilot with:
- ✅ FTS5 full-text search
- ✅ Multi-scope organization
- ✅ Local SQLite storage
- ✅ Natural language interface
