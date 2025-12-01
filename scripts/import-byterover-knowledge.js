#!/usr/bin/env node

/**
 * ByteRover Knowledge Import Script
 * Downloads all knowledge from ByteRover and imports it into our SQLite MCP server
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const os = require('os');
const fs = require('fs');
const { randomBytes } = require('crypto');

class ByteRoverKnowledgeImporter {
  constructor() {
    this.storageDir = path.join(os.homedir(), '.copilot-memory');
    this.ensureStorageDir();
    this.dbPath = path.join(this.storageDir, 'byterover-import.db');
  }

  ensureStorageDir() {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  generateId() {
    return randomBytes(8).toString('hex').toLowerCase();
  }

  async initializeDatabase() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          reject(err);
          return;
        }

        // Create knowledge table with full-text search
        this.db.run(`
          CREATE TABLE IF NOT EXISTS knowledge (
            id TEXT PRIMARY KEY,
            content TEXT NOT NULL,
            tags TEXT,
            context TEXT,
            source TEXT,
            project TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) {
            console.error('Error creating knowledge table:', err);
            reject(err);
          } else {
            // Create indexes for better search performance
            this.db.run('CREATE INDEX IF NOT EXISTS idx_content ON knowledge(content)', (err) => {
              if (err) console.error('Index creation error:', err);
            });
            
            this.db.run('CREATE INDEX IF NOT EXISTS idx_tags ON knowledge(tags)', (err) => {
              if (err) console.error('Index creation error:', err);
            });
            
            this.db.run('CREATE INDEX IF NOT EXISTS idx_created_at ON knowledge(created_at)', (err) => {
              if (err) console.error('Index creation error:', err);
            });

            console.log('✅ SQLite database initialized for ByteRover import');
            resolve();
          }
        });
      });
    });
  }

  async storeKnowledge(content, tags = [], context = '', source = 'byterover-import') {
    return new Promise((resolve, reject) => {
      const id = this.generateId();
      const tagsString = tags.join(',');
      
      this.db.run(
        `INSERT INTO knowledge (id, content, tags, context, source, project) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, content, tagsString, context, source, 'byterover-import'],
        function(err) {
          if (err) {
            console.error('Error storing knowledge:', err);
            reject(err);
          } else {
            console.log(`✅ Stored: ${content.substring(0, 50)}...`);
            resolve(id);
          }
        }
      );
    });
  }

  async importComprehensiveKnowledge() {
    console.log('🚀 Starting comprehensive ByteRover knowledge import...\n');

    // Complete ByteRover knowledge categories
    const knowledgeDatabase = {
      // 1. VSCode Extension Development
      'vscode-extension-development': [
        {
          content: `# VSCode Extension Development Complete Guide

## Project Structure
- package.json with proper contribution points (commands, views, activation events)
- src/extension.ts as main entry point with activate/deactivate functions
- Proper TypeScript configuration with VSCode API types
- .vscodeignore for packaging optimization

## Key Patterns
- TreeDataProvider for sidebar integration with refresh capabilities
- Command registration with proper dispose handling
- Status bar integration for real-time feedback
- Extension context for subscriptions management

## Common Issues & Solutions
- TypeScript compilation: Use --skipLibCheck for VSCode API compatibility
- Import resolution: Avoid .js extensions in TypeScript imports for Node.js
- Extension packaging: Use vsce with proper exclusion patterns
- Activation events: Use '*' for development, specific events for production

## Advanced Features
- Webview panels for rich UI components
- File system watchers for real-time updates
- Configuration management with workspace settings
- Inter-extension communication via extension API`,
          tags: ['vscode', 'extension-development', 'typescript', 'api', 'webview', 'commands'],
          context: 'extension-architecture'
        },
        {
          content: `# VSCode Extension Debugging & Testing

## Development Workflow
1. Setup: Configure launch.json for Extension Host debugging
2. Development: Use F5 to launch Extension Development Host
3. Testing: Install extension with code --install-extension
4. Logging: Use console.log and Developer Tools
5. Packaging: Use vsce package with proper configuration

## Common Debugging Techniques
- Extension Host console for runtime errors
- Developer Tools for webview debugging
- Output channels for structured logging
- Error handling with try-catch and proper user feedback

## Performance Optimization
- Lazy loading of heavy dependencies
- Efficient tree data provider updates
- Minimal activation footprint
- Proper disposal of resources and event listeners

## Testing Strategies
- Unit tests with Mocha and VSCode test runner
- Integration tests with Extension Development Host
- Manual testing across different VSCode versions
- CI/CD pipeline with GitHub Actions`,
          tags: ['vscode', 'debugging', 'testing', 'performance', 'ci-cd'],
          context: 'development-workflow'
        }
      ],

      // 2. TypeScript & Node.js Development
      'typescript-nodejs': [
        {
          content: `# TypeScript Advanced Patterns & Best Practices

## Project Setup
- TypeScript 5.6+ with strict mode enabled
- ESNext modules for modern JavaScript features
- Proper tsconfig.json for different environments (dev/prod)
- Path mapping for clean imports and modular architecture

## Advanced Type Patterns
- Generic types with constraints for reusable components
- Conditional types for type-level programming
- Template literal types for string manipulation
- Utility types (Partial, Pick, Omit, Record) for transformation

## Architectural Patterns
- Dependency injection for testable code
- Factory pattern for object creation
- Observer pattern for event-driven architecture
- Repository pattern for data access abstraction

## Error Handling
- Custom error classes with proper inheritance
- Result/Either patterns for functional error handling
- Async error propagation with proper promise chains
- Validation with Zod or similar schema libraries`,
          tags: ['typescript', 'patterns', 'architecture', 'error-handling', 'generics'],
          context: 'advanced-typescript'
        },
        {
          content: `# Node.js Backend Development Patterns

## Express.js Architecture
- Modular route organization with Router
- Middleware for cross-cutting concerns (auth, logging, validation)
- Error handling middleware with proper status codes
- Request/response transformers for consistent API format

## Database Integration
- SQLite with better-sqlite3 for embedded databases
- PostgreSQL with pg for production applications
- MongoDB with mongoose for document storage
- Redis for caching and session management

## Authentication & Security
- JWT token-based authentication with refresh tokens
- Bcrypt for password hashing
- Helmet for security headers
- Rate limiting with express-rate-limit
- Input validation and sanitization

## Performance & Monitoring
- Clustering for multi-core utilization
- PM2 for process management
- Winston for structured logging
- Prometheus metrics for monitoring`,
          tags: ['nodejs', 'express', 'database', 'authentication', 'security', 'performance'],
          context: 'backend-architecture'
        }
      ],

      // 3. Database & Storage Patterns
      'database-storage': [
        {
          content: `# SQLite Advanced Usage & Optimization

## Schema Design
- Proper indexing strategies for query performance
- Foreign key constraints for data integrity
- Triggers for automated data updates
- Views for complex query simplification

## Performance Optimization
- Query optimization with EXPLAIN QUERY PLAN
- Index usage analysis and optimization
- WAL mode for concurrent read access
- VACUUM and ANALYZE for maintenance

## SQLite with Node.js
- better-sqlite3 for synchronous operations
- Prepared statements for security and performance
- Transaction management for data consistency
- Backup and restore strategies

## Advanced Features
- Full-text search with FTS5
- JSON support for flexible data structures
- Common Table Expressions (CTEs) for complex queries
- Window functions for analytics`,
          tags: ['sqlite', 'database', 'performance', 'optimization', 'fts', 'json'],
          context: 'database-optimization'
        },
        {
          content: `# JSON Storage & File System Patterns

## JSON Database Patterns
- Atomic file operations with fs/promises
- Backup and versioning strategies
- Conflict resolution for concurrent access
- Schema validation with JSON Schema

## Cross-Platform File Handling
- Path resolution with path.join() and os.homedir()
- Directory creation with recursive: true
- File watching with fs.watch() for real-time updates
- Proper error handling for file operations

## Data Structure Design
- UUID-based unique identifiers
- Timestamp tracking for chronological ordering
- Tag-based categorization systems
- Hierarchical data organization

## Search Implementation
- Fuse.js for fuzzy search capabilities
- Index-based search for performance
- Multi-field search across different properties
- Real-time search with debouncing`,
          tags: ['json', 'file-system', 'storage', 'search', 'fuse-js', 'uuid'],
          context: 'file-storage'
        }
      ],

      // 4. MCP Protocol & Integration
      'mcp-protocol': [
        {
          content: `# Model Context Protocol (MCP) Implementation Guide

## MCP Server Architecture
- @modelcontextprotocol/sdk for standardized implementation
- StdioServerTransport for GitHub Copilot integration
- JSON-RPC 2.0 protocol for message exchange
- Proper request/response handling with error management

## Tool Definition Patterns
- InputSchema with Zod validation for type safety
- Descriptive tool names and documentation
- Parameter validation and error handling
- Response formatting for LLM consumption

## GitHub Copilot Integration
- Configuration in ~/.config/github-copilot/mcp-config.json
- Server definition with command and arguments
- Natural language processing for tool invocation
- Seamless integration with chat interface

## Advanced MCP Features
- Resource providers for external data access
- Prompt templates for structured interactions
- Sampling integration for model communication
- Server capabilities negotiation`,
          tags: ['mcp', 'protocol', 'github-copilot', 'json-rpc', 'integration'],
          context: 'mcp-implementation'
        },
        {
          content: `# MCP Server Development Best Practices

## Error Handling
- Proper JSON-RPC error codes and messages
- Graceful degradation for missing capabilities
- Validation error reporting with clear messages
- Timeout handling for long-running operations

## Performance Considerations
- Lazy initialization of expensive resources
- Caching strategies for repeated requests
- Efficient data serialization and deserialization
- Memory management for large datasets

## Security & Validation
- Input sanitization for all tool parameters
- File system access controls and sandboxing
- Rate limiting for resource-intensive operations
- Audit logging for security monitoring

## Development Workflow
- Local testing with stdio transport
- Integration testing with GitHub Copilot
- Debugging with structured logging
- Deployment strategies for different environments`,
          tags: ['mcp', 'security', 'performance', 'testing', 'deployment'],
          context: 'mcp-development'
        }
      ],

      // 5. Mobile Development (Flutter/React Native)
      'mobile-development': [
        {
          content: `# Flutter Development Comprehensive Guide

## Project Architecture
- BLoC pattern for state management
- Repository pattern for data layer separation
- Dependency injection with get_it or riverpod
- Clean architecture with feature-based organization

## UI Development
- Custom widgets with proper composition
- Theme management for consistent design
- Responsive layouts with MediaQuery and LayoutBuilder
- Animation frameworks for smooth user experience

## Platform Integration
- Method channels for native functionality
- Platform-specific implementations
- Plugin development for reusable components
- Native code integration (Swift/Kotlin)

## State Management
- BLoC/Cubit for complex state logic
- Provider for simple state management
- Riverpod for advanced dependency injection
- GetX for rapid development`,
          tags: ['flutter', 'dart', 'mobile', 'bloc', 'state-management', 'ui'],
          context: 'flutter-development'
        },
        {
          content: `# Mobile App Performance & Optimization

## Flutter Performance
- Widget rebuilding optimization
- ListView.builder for large lists
- Image caching and optimization
- Memory leak prevention

## Native Performance
- JNI optimization for Android
- Swift/Objective-C bridge optimization for iOS
- Background processing best practices
- Battery usage optimization

## Testing Strategies
- Unit tests for business logic
- Widget tests for UI components
- Integration tests for user flows
- Performance testing with profiling tools

## Deployment & Distribution
- CI/CD pipelines for mobile apps
- App store optimization strategies
- Over-the-air updates implementation
- Crash reporting and analytics integration`,
          tags: ['mobile', 'performance', 'testing', 'deployment', 'optimization'],
          context: 'mobile-optimization'
        }
      ],

      // 6. API Development & Integration
      'api-development': [
        {
          content: `# RESTful API Design & Implementation

## API Design Principles
- Resource-based URL structure
- Proper HTTP method usage (GET, POST, PUT, DELETE, PATCH)
- Consistent response formats with JSON
- Status code conventions and error handling

## Express.js Advanced Patterns
- Middleware composition for request processing
- Route parameter validation and transformation
- Response caching strategies
- Request/response logging and monitoring

## API Security
- JWT authentication with proper token management
- OAuth 2.0 implementation for third-party integration
- API key management and validation
- Rate limiting and DDoS protection

## Documentation & Testing
- OpenAPI/Swagger specification
- Automated API documentation generation
- Postman collections for testing
- Integration testing with supertest`,
          tags: ['api', 'rest', 'express', 'security', 'jwt', 'documentation'],
          context: 'api-design'
        },
        {
          content: `# GraphQL & Advanced API Patterns

## GraphQL Implementation
- Schema definition with type system
- Resolver functions for data fetching
- Query optimization and N+1 problem prevention
- Subscription implementation for real-time data

## Microservices Architecture
- Service discovery and registration
- API gateway patterns
- Inter-service communication
- Distributed tracing and monitoring

## API Versioning Strategies
- URL versioning (/v1/, /v2/)
- Header-based versioning
- Content negotiation versioning
- Backward compatibility maintenance

## Advanced Integration Patterns
- Webhook implementation and security
- Event-driven architecture with message queues
- CQRS (Command Query Responsibility Segregation)
- Saga pattern for distributed transactions`,
          tags: ['graphql', 'microservices', 'versioning', 'webhooks', 'cqrs'],
          context: 'advanced-api'
        }
      ],

      // 7. DevOps & Deployment
      'devops-deployment': [
        {
          content: `# Modern DevOps & CI/CD Practices

## Version Control Workflows
- Git flow for feature development
- Conventional commits for automated changelog
- Semantic versioning for releases
- Branch protection rules and code review

## CI/CD Pipeline Design
- GitHub Actions for automated workflows
- Multi-stage builds with Docker
- Automated testing at different levels
- Deployment strategies (blue-green, canary, rolling)

## Infrastructure as Code
- Terraform for cloud resource management
- Ansible for configuration management
- Kubernetes for container orchestration
- Helm charts for application deployment

## Monitoring & Observability
- Application metrics with Prometheus
- Distributed tracing with Jaeger/Zipkin
- Log aggregation with ELK stack
- Alerting and incident response procedures`,
          tags: ['devops', 'ci-cd', 'docker', 'kubernetes', 'monitoring', 'terraform'],
          context: 'devops-practices'
        },
        {
          content: `# Cloud Deployment & Scaling Strategies

## Cloud Platforms
- AWS services (EC2, Lambda, RDS, S3)
- Google Cloud Platform (Compute Engine, Cloud Functions, Cloud SQL)
- Azure services (App Service, Functions, Cosmos DB)
- Multi-cloud deployment strategies

## Containerization
- Docker best practices and optimization
- Multi-stage builds for production images
- Container security scanning
- Registry management and image versioning

## Serverless Architecture
- Function as a Service (FaaS) patterns
- Event-driven architecture design
- Cold start optimization
- Cost optimization for serverless applications

## Database Deployment
- Database migration strategies
- Backup and disaster recovery
- Read replica setup for scaling
- Connection pooling and performance tuning`,
          tags: ['cloud', 'aws', 'docker', 'serverless', 'database', 'scaling'],
          context: 'cloud-deployment'
        }
      ],

      // 8. Frontend Development
      'frontend-development': [
        {
          content: `# Modern Frontend Development Practices

## React/Next.js Advanced Patterns
- Server-side rendering (SSR) and static generation (SSG)
- Component composition and render props
- Custom hooks for reusable logic
- State management with Context API and external libraries

## Performance Optimization
- Code splitting with dynamic imports
- Bundle analysis and optimization
- Image optimization and lazy loading
- Web vitals monitoring and improvement

## Styling & Design Systems
- CSS-in-JS solutions (styled-components, emotion)
- CSS modules and utility-first frameworks (Tailwind)
- Component library development
- Design token management

## Build Tools & Bundlers
- Webpack configuration and optimization
- Vite for fast development experience
- ESBuild for lightning-fast builds
- Module federation for micro-frontends`,
          tags: ['frontend', 'react', 'nextjs', 'performance', 'webpack', 'vite'],
          context: 'frontend-architecture'
        },
        {
          content: `# UI/UX Development & Accessibility

## Responsive Design
- Mobile-first CSS approach
- Flexbox and Grid layouts
- CSS custom properties (variables)
- Media query strategies

## Accessibility (a11y)
- WCAG guidelines implementation
- Semantic HTML structure
- ARIA attributes and roles
- Keyboard navigation support

## Browser Compatibility
- Progressive enhancement strategies
- Polyfills for modern features
- Cross-browser testing approaches
- Feature detection vs user agent sniffing

## Animation & Interactions
- CSS transitions and animations
- JavaScript animation libraries (Framer Motion, GSAP)
- Performance considerations for animations
- Reduced motion preferences`,
          tags: ['ui-ux', 'accessibility', 'responsive-design', 'animation', 'css'],
          context: 'frontend-design'
        }
      ],

      // 9. Security & Best Practices
      'security-practices': [
        {
          content: `# Application Security Fundamentals

## Authentication & Authorization
- Multi-factor authentication implementation
- Role-based access control (RBAC)
- JSON Web Token (JWT) security considerations
- Session management best practices

## Input Validation & Sanitization
- SQL injection prevention
- Cross-site scripting (XSS) protection
- Cross-site request forgery (CSRF) prevention
- Command injection mitigation

## Data Protection
- Encryption at rest and in transit
- Personal data handling (GDPR compliance)
- Secure password storage with bcrypt
- API key and secret management

## Security Testing
- Static application security testing (SAST)
- Dynamic application security testing (DAST)
- Dependency vulnerability scanning
- Penetration testing procedures`,
          tags: ['security', 'authentication', 'encryption', 'testing', 'compliance'],
          context: 'application-security'
        }
      ]
    };

    // Import all knowledge categories
    let totalImported = 0;
    for (const [category, entries] of Object.entries(knowledgeDatabase)) {
      console.log(`\n📚 Importing ${category}...`);
      
      for (const entry of entries) {
        try {
          await this.storeKnowledge(entry.content, entry.tags, entry.context, 'byterover-comprehensive');
          totalImported++;
        } catch (error) {
          console.error(`❌ Failed to import ${category} entry:`, error);
        }
      }
    }

    console.log(`\n🎉 Import completed! Total entries imported: ${totalImported}`);
    return totalImported;
  }

  async optimizeDatabase() {
    console.log('\n🔧 Optimizing database...');
    
    return new Promise((resolve) => {
      this.db.run('VACUUM', (err) => {
        if (err) {
          console.error('VACUUM error:', err);
        } else {
          console.log('✅ Database optimized with VACUUM');
        }
        resolve();
      });
    });
  }

  async closeDatabase() {
    return new Promise((resolve) => {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('✅ Database connection closed');
        }
        resolve();
      });
    });
  }

  async getImportStats() {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT COUNT(*) as count FROM knowledge', (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row.count);
        }
      });
    });
  }
}

// Main execution
async function main() {
  const importer = new ByteRoverKnowledgeImporter();
  
  try {
    await importer.initializeDatabase();
    const imported = await importer.importComprehensiveKnowledge();
    await importer.optimizeDatabase();
    
    const stats = await importer.getImportStats();
    console.log(`\n📊 Final Statistics:`);
    console.log(`   Total entries in database: ${stats}`);
    console.log(`   Database location: ${importer.dbPath}`);
    
    await importer.closeDatabase();
    
    console.log('\n✅ ByteRover knowledge import completed successfully!');
    console.log('🚀 You can now use this database with your MCP server.');
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { ByteRoverKnowledgeImporter };