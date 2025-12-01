# Copilot Memory - Project-Specific Local Storage Setup

## 🎯 Perfect Solution for Local Project Memory!

You're absolutely right - storing memories locally for each project is the ideal approach! Here's what I've implemented:

### ✅ **Project-Specific Database Files**
- Each project gets its own SQLite database file
- Database location: `~/.copilot-memory/project_name.db`
- Fast local access with full SQLite power
- No network dependencies

### 📁 **Automatic Project Detection** 
The server now automatically detects your current project by looking for:
- `package.json` (Node.js projects)
- `.git` directory (Git repositories)  
- `pyproject.toml` (Python projects)
- `Cargo.toml` (Rust projects)
- `pom.xml` / `build.gradle` (Java projects)
- `composer.json` (PHP projects)

### 🚀 **Quick Setup**

#### 1. Build the Server
```bash
cd /Users/admin/NodeMCPs/copilot-memory-mcp/server
npm install
npm run build
```

#### 2. Run Project-Specific Server
```bash
# From any project directory
/Users/admin/NodeMCPs/copilot-memory-mcp/server/dist/run-server.js
```

#### 3. Install VSCode Extension
```bash
code --install-extension /Users/admin/NodeMCPs/copilot-memory-mcp/copilot-memory-extension-1.0.0.vsix
```

#### 4. Configure Extension
In VS Code Settings:
- **Storage Type**: `local`
- **Project Specific**: `true` ✅
- **Local Data Dir**: `~/.copilot-memory`

### 🗄️ **Database Structure**

Each project gets a dedicated database with tables:
- `knowledge_entries` - Your stored memories
- `conflict_resolutions` - Handles conflicts
- Full-text search indexes
- Timestamps and metadata

### 📊 **Benefits**

✅ **Fast Access** - Local SQLite is extremely fast  
✅ **Project Isolation** - Memories don't mix between projects  
✅ **Offline Work** - No internet required  
✅ **Privacy** - All data stays on your machine  
✅ **Easy Backup** - Just copy the `.db` files  
✅ **Team Sharing** - Share project databases via git or cloud  

### 📁 **File Organization**
```
~/.copilot-memory/
├── my_react_app.db      # React project memories
├── python_ml_project.db # ML project memories  
├── rust_game.db         # Game project memories
└── config.json          # MCP server config
```

### 🎮 **Usage Example**

1. Navigate to your project:
   ```bash
   cd /path/to/your/project
   ```

2. Start the MCP server:
   ```bash
   /Users/admin/NodeMCPs/copilot-memory-mcp/server/dist/run-server.js
   ```

3. Use GitHub Copilot in VS Code - memories automatically save to `~/.copilot-memory/your_project.db`

### 🔧 **Advanced Configuration**

Set custom project path:
```bash
COPILOT_MEMORY_PROJECT_PATH=/custom/path node dist/run-server.js
```

Custom database location:
```bash  
COPILOT_MEMORY_DATA_DIR=/custom/db/path node dist/run-server.js
```

This gives you exactly what you wanted - fast, local, project-specific memory storage! 🎉