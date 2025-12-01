# Copilot Memory API

## Deployed API Server

This project includes a complete REST API for managing knowledge entries. Due to deployment limitations with Firebase Functions (requires paid plan) and Vercel authentication issues, here are the options:

### Option 1: Local Development
Run the API server locally:
```bash
cd api
npm install
npm run dev
```
API will be available at: http://localhost:3001

### Option 2: Deploy to Render.com (Free)
1. Create account at [Render.com](https://render.com)
2. Connect your GitHub repository
3. Create a new Web Service
4. Set the following:
   - **Build Command**: `cd api && npm install && npm run build`
   - **Start Command**: `cd api && npm start`
   - **Root Directory**: Leave blank
   - **Environment**: Node.js

### API Endpoints

#### Health Check
- **GET** `/health` - Check API status

#### Knowledge Management
- **POST** `/api/knowledge` - Store knowledge entry
- **GET** `/api/knowledge` - Get all knowledge entries
- **GET** `/api/knowledge/:id` - Get specific knowledge entry
- **PATCH** `/api/knowledge/:id` - Update knowledge entry
- **DELETE** `/api/knowledge/:id` - Delete knowledge entry

#### Search & Analysis
- **POST** `/api/knowledge/search` - Search knowledge entries
- **POST** `/api/knowledge/conflicts` - Detect conflicts
- **GET** `/api/stats` - Get statistics

### Request Examples

#### Store Knowledge
```bash
curl -X POST http://localhost:3001/api/knowledge \
  -H "Content-Type: application/json" \
  -d '{
    "content": "How to implement React hooks",
    "tags": ["react", "javascript", "hooks"],
    "source": "copilot",
    "context": "development"
  }'
```

#### Search Knowledge
```bash
curl -X POST http://localhost:3001/api/knowledge/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "react hooks",
    "limit": 10
  }'
```

## VSCode Extension Configuration

Once you have a working API URL, update your VSCode extension settings:

1. Open VS Code Settings (`Cmd/Ctrl + ,`)
2. Search for "Copilot Memory"
3. Set **Storage Type** to `server`
4. Set **Server URL** to your API endpoint (e.g., `https://your-app.onrender.com`)

## Technical Details

- **Framework**: Express.js with TypeScript
- **Database**: SQLite with better-sqlite3
- **Search**: Fuse.js for fuzzy searching
- **CORS**: Enabled for all origins
- **File Storage**: Local SQLite database file