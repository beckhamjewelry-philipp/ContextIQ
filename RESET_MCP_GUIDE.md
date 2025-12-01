# 🔄 Reset MCP Configuration - Easy Switch from ByteRover to SQLite

## What is this?

The **"Reset MCP Configuration"** command automatically switches your GitHub Copilot from using ByteRover MCP to our high-performance SQLite MCP server. No more manual configuration!

## How to Use

### Method 1: Command Palette
1. Press `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows/Linux)
2. Type: `Copilot Memory: Reset MCP Configuration`
3. Click the command
4. Confirm when prompted
5. Restart VS Code when prompted

### Method 2: Sidebar
1. Look for the **Copilot Memory** icon in the sidebar (database icon)
2. Click the **🔄 Reset** button in the Memory Explorer
3. Confirm the reset
4. Restart VS Code

## What it Does Automatically

✅ **Backs up existing configurations** (creates .backup files)  
✅ **Updates VS Code MCP config** at `~/Library/Application Support/Code/User/mcp.json`  
✅ **Updates GitHub Copilot config** at `~/.config/github-copilot/mcp-config.json`  
✅ **Updates extension config** in VS Code global storage  
✅ **Replaces ByteRover HTTP server** with local SQLite server  

## Before Reset (ByteRover)
```json
{
  "servers": {
    "byterover-mcp": {
      "type": "http",
      "url": "https://mcp.byterover.dev/mcp?machineId=..."
    }
  }
}
```

## After Reset (SQLite)
```json
{
  "servers": {
    "copilot-memory-sqlite": {
      "type": "stdio",
      "command": "node",
      "args": ["/Users/admin/NodeMCPs/copilot-memory-mcp/server/index.js"],
      "description": "GitHub Copilot Memory SQLite - High performance local storage"
    }
  }
}
```

## Benefits of SQLite vs ByteRover

| Feature | ByteRover (HTTP) | SQLite (Local) |
|---------|------------------|----------------|
| **Speed** | Network dependent | Lightning fast |
| **Privacy** | Sends to cloud | 100% local |
| **Offline** | Requires internet | Works offline |
| **Storage** | Cloud storage | Local SQLite DB |
| **Performance** | ~500ms response | ~5ms response |
| **Data Control** | Remote | Your computer |

## Testing After Reset

After the reset, test with GitHub Copilot Chat:

```
"What do you remember about my TypeScript preferences?"
```

Should return: *"I prefer using TypeScript for all my projects"*

## Troubleshooting

**If the reset fails:**
1. Check VS Code has write permissions to config directories
2. Manually backup and replace config files
3. Restart VS Code completely
4. Check the console for specific error messages

**If GitHub Copilot doesn't see the changes:**
1. Reload VS Code window (`Cmd+R`)
2. Restart VS Code completely
3. Check that the server path exists and is correct

## Recovery

If you want to go back to ByteRover:
1. Your original config is backed up as `.backup` files
2. Copy them back to restore ByteRover configuration
3. Or use the extension to switch back

---

**🚀 One-click solution to switch from ByteRover to high-performance SQLite!**