# 🚀 One-Click Setup for Copilot Memory

## Quick Start with New Buttons

The Copilot Memory extension now includes **two powerful buttons** for instant setup:

### 📋 Copy MCP Configuration
- **Location**: Copilot Memory Explorer sidebar
- **What it does**: 
  - Copies the MCP JSON configuration to your clipboard
  - Shows you where to paste it
  - Provides step-by-step instructions
  
**Usage:**
1. Open VS Code sidebar
2. Find "Copilot Memory Explorer" 
3. Click "📋 Copy MCP Configuration"
4. Paste into GitHub Copilot settings
5. Done! 🎉

### 🚀 Install & Configure (One-Click Setup)
- **Location**: Copilot Memory Explorer sidebar
- **What it does**:
  - ✅ Copies MCP configuration to clipboard
  - ✅ Creates `.github/copilot-instructions.md`
  - ✅ Sets up all configuration files
  - ✅ Guides you through final steps
  
**Usage:**
1. Click "🚀 Install & Configure"
2. Wait for progress indicator to complete
3. Follow the popup instructions
4. Reload VS Code
5. Start using Copilot Memory! 🎊

## MCP Configuration Format

The generated configuration looks like this:

```json
{
  "mcpServers": {
    "copilot-memory-sqlite": {
      "command": "node",
      "args": ["/path/to/server/index-sqlite.js"],
      "env": {},
      "description": "GitHub Copilot Memory SQLite - High-performance knowledge storage"
    }
  }
}
```

## Where to Paste Configuration

### Method 1: VS Code Settings UI
1. Press `Cmd+,` (Mac) or `Ctrl+,` (Windows)
2. Search for "GitHub Copilot"
3. Look for "MCP Servers" or "Model Context Protocol"
4. Paste the JSON configuration
5. Save and reload VS Code

### Method 2: settings.json
1. Press `Cmd+Shift+P` → "Preferences: Open User Settings (JSON)"
2. Add the configuration under appropriate section
3. Save and reload VS Code

### Method 3: Copilot Chat Settings
1. Open GitHub Copilot Chat
2. Click settings icon (⚙️)
3. Find MCP configuration section
4. Paste and save

## What Happens After Setup

Once configured, you can use these commands in GitHub Copilot Chat:

### 💾 Store Knowledge
```
"remember that I prefer TypeScript strict mode"
"remember this code pattern for future use"
"store this API endpoint configuration"
```

### 🔍 Retrieve Knowledge
```
"what do you remember about my preferences?"
"retrieve information about TypeScript settings"
"show me what you know about my API patterns"
```

### 📊 List Knowledge
```
"show me all stored knowledge"
"list what you remember about this project"
```

## Sidebar Features

After installation, the Copilot Memory Explorer shows:

### Quick Setup Section (Always Visible)
- **📋 Copy MCP Configuration** - Copy JSON to clipboard
- **🚀 Install & Configure** - Automated one-click setup

### Project Management
- **Project** - Select/switch between projects
- **Server** - Start/stop MCP server
- **View Memories** - Browse stored knowledge
- **Statistics** - View project stats
- **Export/Import** - Backup and restore
- **ByteRover Import** - Import knowledge base

## Troubleshooting

### Button Not Showing?
- Reload VS Code window
- Check that extension is activated
- Look in "Copilot Memory Explorer" sidebar

### Configuration Not Working?
- Verify the server path is correct
- Check Node.js is installed (`node --version`)
- Look for errors in Extension Host output

### Copilot Not Recognizing Commands?
- Make sure you pasted the configuration
- Reload VS Code completely
- Check Copilot Chat settings

## Commands Reference

All commands are available via Command Palette (`Cmd+Shift+P`):

| Command | Description |
|---------|-------------|
| `📋 Copy MCP Configuration for Copilot` | Copy JSON config |
| `⚡ Install & Configure Copilot Memory Extension` | One-click setup |
| `Setup Copilot MCP Integration` | Manual setup |
| `Reset MCP Configuration` | Switch from ByteRover |
| `Update Copilot Instructions File` | Refresh instructions |

## Benefits

✅ **No manual JSON editing** - Just click a button  
✅ **Automatic path resolution** - Works on any system  
✅ **Guided setup** - Step-by-step instructions  
✅ **Clipboard integration** - Easy paste workflow  
✅ **Configuration validation** - Ensures correct format  
✅ **Progress indicators** - See what's happening  

## Advanced Usage

### Custom Server Path
If you need to customize the server path:

1. Use "Copy MCP Configuration" button
2. Edit the copied JSON before pasting
3. Update the `args` array with your path

### Multiple Projects
The extension supports project-specific databases:

1. Select different projects via sidebar
2. Each gets its own SQLite database
3. Knowledge is isolated per project

### Environment Variables
Add custom environment variables to the MCP config:

```json
{
  "mcpServers": {
    "copilot-memory-sqlite": {
      "command": "node",
      "args": ["/path/to/server"],
      "env": {
        "CUSTOM_VAR": "value"
      }
    }
  }
}
```

## What's Next?

After successful setup:

1. ✅ Try storing some knowledge
2. ✅ Test retrieval with Copilot Chat
3. ✅ Import ByteRover knowledge (optional)
4. ✅ Export/backup your knowledge
5. ✅ Share configuration with team

## Support

Need help? 

- Check Extension Host output (Help → Toggle Developer Tools)
- Review `.github/copilot-instructions.md` in your workspace
- Open an issue on GitHub

---

**Enjoy your enhanced Copilot experience! 🚀**
