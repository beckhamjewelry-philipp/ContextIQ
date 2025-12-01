# Multi-Scope Knowledge Management Guide

## Overview

Version 1.0.7 introduces **Multi-Scope Knowledge Management** allowing you to organize knowledge across three distinct scopes:

1. **🎯 Project Scope** - Knowledge specific to the current project
2. **👤 User Scope** - Personal preferences across all projects  
3. **🌐 Global Scope** - Universal best practices and shared knowledge

## Database Structure

Each scope has its own SQLite database:

```
~/.copilot-memory/
├── {project-name}.db  # Project-specific knowledge
├── user.db            # User preferences
└── global.db          # Global best practices
```

## Usage Examples

### Storing Knowledge

#### Project Scope (Default)
```
User: "Remember this React project uses TypeScript with strict mode"
Copilot: ✅ Stored in PROJECT scope
```

```javascript
// API call
{
  tool: "store_knowledge",
  content: "React project uses TypeScript with strict mode",
  scope: "project"  // or omit (defaults to project)
}
```

#### User Scope
```
User: "Remember I prefer tabs over spaces for indentation"
Copilot: ✅ Stored in USER scope
```

```javascript
// API call
{
  tool: "store_knowledge",
  content: "I prefer tabs over spaces for indentation",
  scope: "user",
  context: "personal-preferences"
}
```

#### Global Scope
```
User: "Remember best practice: Always use semantic versioning"
Copilot: ✅ Stored in GLOBAL scope
```

```javascript
// API call
{
  tool: "store_knowledge",
  content: "Best practice: Always use semantic versioning",
  scope: "global",
  context: "best-practices"
}
```

### Retrieving Knowledge

#### Search All Scopes (Default)
```
User: "Retrieve knowledge about TypeScript"
Copilot: 🧠 Found 5 entries across project, user, global scopes:

1. [PROJECT] TypeScript config with strict mode...
2. [USER] I prefer TypeScript for all projects...
3. [GLOBAL] TypeScript best practices...
```

```javascript
// API call
{
  tool: "retrieve_knowledge",
  query: "TypeScript",
  scope: "all"  // or omit (defaults to all)
}
```

#### Search Specific Scope
```
User: "Retrieve user preferences about formatting"
Copilot: 🧠 Found 2 entries from USER scope:

1. I prefer tabs over spaces...
2. I like 2-space indentation...
```

```javascript
// API call
{
  tool: "retrieve_knowledge",
  query: "formatting",
  scope: "user"
}
```

### Listing Knowledge

#### List All Scopes
```
User: "List all my knowledge"
Copilot: 📊 Multi-Scope View:

🔸 PROJECT (NodeMCPs):
   - Total entries: 25
   - Database size: 45.32 KB
   
🔸 USER:
   - Total entries: 12
   - Database size: 18.56 KB
   
🔸 GLOBAL:
   - Total entries: 8
   - Database size: 12.43 KB

Grand Total: 45 entries across 3 scopes
```

```javascript
// API call
{
  tool: "list_knowledge",
  scope: "all"  // or omit (defaults to all)
}
```

#### List Specific Scope
```
User: "List knowledge from global scope"
Copilot: Shows only GLOBAL scope entries
```

```javascript
// API call
{
  tool: "list_knowledge",
  scope: "global",
  limit: 10
}
```

## Use Cases

### Project Scope
Perfect for:
- Project-specific configurations
- Tech stack choices
- Project architecture decisions
- Project-specific conventions
- Team agreements for this project

**Examples:**
- "This project uses React 18 with Next.js 14"
- "We use Zustand for state management"
- "API base URL is https://api.example.com"
- "Database schema has users and posts tables"

### User Scope
Perfect for:
- Personal coding preferences
- Editor settings
- Coding style choices
- Tool preferences
- Learning notes

**Examples:**
- "I prefer functional components over class components"
- "I like using async/await over promises.then()"
- "My preferred test framework is Jest"
- "I always use const over let when possible"

### Global Scope
Perfect for:
- Universal best practices
- Industry standards
- Security guidelines
- Performance tips
- General programming wisdom

**Examples:**
- "Always validate user input"
- "Use semantic versioning (MAJOR.MINOR.PATCH)"
- "Keep functions small and focused"
- "Write tests before fixing bugs"

## API Reference

### store_knowledge

```typescript
interface StoreKnowledgeArgs {
  content: string;           // Required: The knowledge to store
  tags?: string[];          // Optional: Tags for categorization
  context?: string;         // Optional: Context/category
  scope?: 'project' | 'user' | 'global';  // Optional: Default 'project'
}
```

### retrieve_knowledge

```typescript
interface RetrieveKnowledgeArgs {
  query: string;            // Required: Search query
  tags?: string[];          // Optional: Filter by tags
  limit?: number;           // Optional: Max results (default: 5)
  scope?: 'project' | 'user' | 'global' | 'all';  // Optional: Default 'all'
}
```

### list_knowledge

```typescript
interface ListKnowledgeArgs {
  limit?: number;           // Optional: Max entries (default: 10)
  tags?: string[];          // Optional: Filter by tags
  scope?: 'project' | 'user' | 'global' | 'all';  // Optional: Default 'all'
  vacuum?: boolean;         // Optional: Optimize database (default: false)
}
```

## Performance Characteristics

| Operation | Single Scope | All Scopes |
|-----------|-------------|------------|
| Store | ~2-5ms | N/A |
| Retrieve | ~3-8ms | ~10-20ms |
| List | ~5-10ms | ~15-30ms |

**Notes:**
- All scopes use FTS5 full-text search
- Results are ranked by BM25 relevance
- Cross-scope search aggregates and re-ranks results
- Each scope maintains its own optimized indexes

## Migration from v1.0.6

Existing databases continue to work as **project scope** databases. No data loss.

To organize existing knowledge:
1. List all knowledge: `list_knowledge`
2. Identify what should be user/global
3. Store new entries in appropriate scope
4. Optional: Clean up old project-specific entries

## Best Practices

### Scope Selection Guide

Ask yourself:
1. **Is this specific to THIS project only?** → Project scope
2. **Is this MY personal preference?** → User scope
3. **Is this universally applicable?** → Global scope

### When to Search Specific Scopes

- **Project only**: When looking for project-specific details
- **User only**: When checking your personal preferences
- **Global only**: When looking for general best practices
- **All**: When you're not sure or want comprehensive results (default)

### Organizing Knowledge

```
Project Scope:
- API endpoints
- Database schema
- Project dependencies
- Team-specific conventions

User Scope:
- Coding style preferences
- Tool choices
- Learning notes
- Personal shortcuts

Global Scope:
- SOLID principles
- Design patterns
- Security best practices
- Performance optimization tips
```

## Troubleshooting

**Q: My search returns too many results from different scopes**
A: Use the `scope` parameter to narrow down:
```javascript
{ query: "...", scope: "project" }  // Search project only
```

**Q: How do I move knowledge between scopes?**
A: Store the content in the new scope, then optionally delete from old scope (requires manual DB editing currently)

**Q: Can I have the same knowledge in multiple scopes?**
A: Yes! You might want "Use TypeScript" in both user (preference) and global (best practice) scopes.

**Q: Which scope is searched by default?**
A: Retrieve searches **all** scopes by default. Store uses **project** scope by default.

## Future Enhancements

Planned features:
- [ ] Move knowledge between scopes
- [ ] Sync global scope across machines
- [ ] Export/import specific scopes
- [ ] Scope-specific tags
- [ ] Scope filtering in VS Code sidebar

## Questions?

- Check the [GitHub Issues](https://github.com/kiranbjm/copilot-memory-sqlite/issues)
- Review the [Migration Guide](./FTS5_MIGRATION.md)
- See the [Main README](../README.md)
