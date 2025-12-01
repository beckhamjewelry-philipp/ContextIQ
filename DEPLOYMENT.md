# Deployment Guide for Copilot Memory MCP Server

This guide provides multiple deployment options for the Copilot Memory MCP Server.

## 🏠 Local Development (Recommended for Testing)

The simplest way to run the server locally:

```bash
# Build the project
./build.sh

# Start the server
cd server
npm start
```

The server will be available at `http://localhost:3000`

## ☁️ Firebase Hosting (Documentation Site)

The Firebase hosting deployment serves as a documentation and information site:

```bash
# Deploy documentation site
firebase deploy --only hosting
```

**URL:** https://copilot-memory-mcp.web.app

## 🔥 Firebase Functions (Requires Paid Plan)

For full cloud functionality with Firebase Functions:

1. **Upgrade to Blaze Plan:** Visit [Firebase Console](https://console.firebase.google.com/project/copilot-memory-mcp/usage/details)

2. **Update firebase.json:**
```json
{
  "functions": {
    "source": "functions",
    "runtime": "nodejs20"
  },
  "hosting": {
    "public": "public",
    "rewrites": [
      {
        "source": "/api/**",
        "function": "api"
      }
    ]
  }
}
```

3. **Deploy:**
```bash
firebase deploy
```

## 🐳 Docker Deployment

Create a Docker container for easy deployment:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --only=production
COPY server/dist ./dist
EXPOSE 3000
CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t copilot-memory-mcp .
docker run -p 3000:3000 copilot-memory-mcp
```

## 🚀 Vercel Deployment

Deploy to Vercel for serverless hosting:

1. **Install Vercel CLI:**
```bash
npm i -g vercel
```

2. **Create vercel.json:**
```json
{
  "version": 2,
  "builds": [
    {
      "src": "server/dist/index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "server/dist/index.js"
    }
  ]
}
```

3. **Deploy:**
```bash
vercel --prod
```

## 🌐 Railway Deployment

Deploy to Railway for easy hosting:

1. **Connect GitHub repository to Railway**
2. **Set environment variables:**
   - `NODE_ENV=production`
   - `PORT=3000`
3. **Railway will automatically build and deploy**

## ⚡ Cloudflare Workers

Deploy as a Cloudflare Worker:

1. **Install Wrangler:**
```bash
npm install -g wrangler
```

2. **Create wrangler.toml:**
```toml
name = "copilot-memory-mcp"
main = "server/dist/worker.js"
compatibility_date = "2023-11-01"
```

3. **Deploy:**
```bash
wrangler publish
```

## 🔧 Environment Variables

Configure these environment variables for any deployment:

```bash
NODE_ENV=production
PORT=3000
COPILOT_MEMORY_CONFIG=/path/to/config.json
LOG_LEVEL=info
```

## 📊 Monitoring and Health Checks

All deployments include a health check endpoint:

```
GET /health
```

Returns:
```json
{
  "status": "ok",
  "timestamp": "2025-11-05T15:00:00.000Z"
}
```

## 🔐 Security Considerations

- **API Keys:** Use environment variables for sensitive data
- **CORS:** Configure appropriate origins for production
- **Rate Limiting:** Enable rate limiting for public deployments
- **HTTPS:** Always use HTTPS in production

## 📈 Scaling

For high-traffic deployments:

1. **Database:** Use cloud databases instead of SQLite
2. **Caching:** Implement Redis caching
3. **Load Balancing:** Use multiple instances
4. **CDN:** Serve static assets via CDN

## 🆘 Troubleshooting

### Common Issues:

1. **Port conflicts:** Change PORT environment variable
2. **Database permissions:** Ensure write access to data directory
3. **Memory limits:** Increase memory allocation for large datasets
4. **CORS errors:** Configure corsOrigins in config

### Debug Mode:

```bash
LOG_LEVEL=debug npm start
```

## 📞 Support

- 🐛 [Issues](https://github.com/your-username/copilot-memory-mcp/issues)
- 📚 [Documentation](https://copilot-memory-mcp.web.app)
- 💬 [Discussions](https://github.com/your-username/copilot-memory-mcp/discussions)