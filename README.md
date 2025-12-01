# Copilot Memory MCP

A complete Model Context Protocol (MCP) server and VSCode extension for storing and retrieving Copilot and AI agent memory across conversations.

## 🌟 Features

- **Flexible Storage**: Choose between local storage, server-side storage, or both
- **Intelligent Search**: Semantic search with fuzzy matching and scoring
- **Conflict Detection**: Automatic detection and resolution of conflicting knowledge entries
- **VSCode Integration**: Seamless integration with GitHub Copilot through dedicated extension
- **Memory Management**: Full CRUD operations on knowledge entries with tags and metadata
- **Multi-Source Support**: Store memories from different AI agents and sources
- **Context Awareness**: Associate memories with specific workspaces or projects

## 🏗️ Architecture

```
copilot-memory-mcp/
├── server/          # MCP server implementation
├── extension/       # VSCode extension
├── shared/         # Shared types and utilities
└── docs/           # Documentation
```

### Components

1. **MCP Server** (`server/`)
   - TypeScript-based MCP server
   - Multiple storage backends (local SQLite, remote server, hybrid)
   - Fuzzy search with Fuse.js
   - Conflict detection and resolution

2. **VSCode Extension** (`extension/`)
   - Configuration management
   - Memory explorer tree view
   - Command palette integration
   - Webview for memory visualization

3. **Shared Types** (`shared/`)
   - Common interfaces and types
   - Validation schemas with Zod

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm 8+
- VSCode 1.85+

### Installation

1. **Clone and build**:
   ```bash
   git clone <repository-url>
   cd copilot-memory-mcp
   chmod +x build.sh dev.sh deploy.sh
   ./build.sh
   ```

2. **Deploy server** (choose one):
   ```bash
   # Local development (recommended for testing)
   ./deploy.sh local
   
   # Deploy documentation site (free)
   ./deploy.sh docs
   
   # Deploy to Firebase Functions (requires paid plan)
   ./deploy.sh firebase
   
   # Build Docker image
   ./deploy.sh docker
   ```

3. **Install VSCode extension**:
   ```bash
   code --install-extension ./extension/copilot-memory-extension-1.0.0.vsix
   ```

4. **Configure storage**:
   - Open VSCode Command Palette (`Cmd+Shift+P`)
   - Run `Copilot Memory: Configure Storage`
   - Choose your preferred storage type

## 📖 Usage

### Storage Types

#### Local Storage
- Stores data in SQLite database locally
- Default location: `~/.copilot-memory/`
- Fast access, no network dependency
- Good for single-machine usage

#### Server Storage  
- Stores data on remote server via HTTP API
- Requires server URL and optional API key
- Enables sharing across devices
- Good for team collaboration

#### Hybrid Storage (Both)
- Combines local and server storage
- Local-first with server sync
- Fallback capability
- Best of both worlds

### Commands

- **Configure Storage** - Set up storage preferences
- **View Memory** - Browse stored memories in webview
- **Clear Memory** - Remove all stored memories  
- **Resolve Conflicts** - Handle conflicting entries
- **Export Memory** - Export memories to JSON file
- **Import Memory** - Import memories from JSON file

### MCP Tools

The server provides these MCP tools:

#### `store-knowledge`
Store new knowledge entries:
```json
{
  "messages": "React hooks allow functional components to use state",
  "tags": ["react", "hooks", "frontend"],
  "source": "copilot", 
  "context": "my-react-project",
  "metadata": {"language": "javascript"}
}
```

#### `retrieve-knowledge`
Search and retrieve knowledge:
```json
{
  "query": "react hooks state",
  "limit": 5,
  "tags": ["react"],
  "source": "copilot",
  "minScore": 0.7
}
```

#### `manage-knowledge`
Update, delete, or get specific entries:
```json
{
  "operation": "update",
  "id": "uuid-here", 
  "updates": {"tags": ["react", "hooks", "updated"]}
}
```

## ⚙️ Configuration

### VSCode Settings

Access via `Settings > Extensions > Copilot Memory`:

```json
{
  "copilotMemory.storage.type": "local",
  "copilotMemory.storage.local.dataDir": "~/.copilot-memory",
  "copilotMemory.storage.server.url": "https://api.example.com",
  "copilotMemory.storage.server.apiKey": "your-api-key",
  "copilotMemory.mcp.autoStart": true,
  "copilotMemory.logging.level": "info"
}
```

### Server Configuration

Create `~/.copilot-memory/config.json`:

```json
{
  "storage": {
    "type": "local",
    "local": {
      "dataDir": "~/.copilot-memory"
    }
  },
  "logging": {
    "level": "info"
  }
}
```

## 🔧 Development

### Setup Development Environment

```bash
# Start development servers
./dev.sh

# This starts:
# - Shared types watcher
# - MCP server in dev mode  
# - Extension compilation watcher
```

### Project Structure

```
server/src/
├── index.ts           # Main MCP server entry point
├── storage/           # Storage backend implementations
│   ├── LocalStorageBackend.ts
│   ├── ServerStorageBackend.ts  
│   ├── HybridStorageBackend.ts
│   └── index.ts
├── tools/             # MCP tool implementations
│   ├── KnowledgeTools.ts
│   └── index.ts
└── types/             # Server-specific types
    └── index.ts

extension/src/
├── extension.ts       # Main extension entry point
├── mcpClient.ts      # MCP client wrapper
├── configuration.ts   # Configuration management
└── memoryExplorer.ts # Tree view provider
```

### Testing

```bash
# Run server tests
cd server
npm test

# Run extension tests  
cd extension
npm test

# Test MCP server manually
cd server
npm run dev
```

## 🔌 MCP Integration

### Adding to MCP Client

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "copilot-memory": {
      "command": "node",
      "args": ["/path/to/copilot-memory-mcp/server/dist/index.js"]
    }
  }
}
```

### Environment Variables

```bash
# Server configuration
COPILOT_MEMORY_CONFIG=/path/to/config.json
LOG_LEVEL=info

# Server storage (if using server backend)
SERVER_URL=https://your-server.com/api  
SERVER_API_KEY=your-api-key
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -am 'Add amazing feature'`)  
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## � Deployment Options

### Local Development
```bash
./deploy.sh local
# Server available at http://localhost:3000
```

### Firebase Hosting (Free - Documentation)
```bash
./deploy.sh docs
# Available at https://copilot-memory-mcp.web.app
```

### Firebase Functions (Paid Plan Required)
```bash
./deploy.sh firebase
# Full cloud functionality with API endpoints
```

### Docker
```bash
./deploy.sh docker
docker run -p 3000:3000 copilot-memory-mcp:latest
```

### Other Platforms
- **Vercel**: `./deploy.sh vercel`
- **Railway**: Connect GitHub repository
- **Heroku**: Use Docker deployment
- **DigitalOcean**: Use Docker or Node.js app platform

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

## �📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- 📚 [Documentation](./docs/)
- 🐛 [Issue Tracker](../../issues)
- 💬 [Discussions](../../discussions)

## 🗺️ Roadmap

- [ ] Vector embeddings for semantic search
- [ ] Memory compression and summarization  
- [ ] Integration with other AI assistants
- [ ] Web interface for memory management
- [ ] Memory analytics and insights
- [ ] Collaborative memory sharing
- [ ] Plugin system for custom storage backends