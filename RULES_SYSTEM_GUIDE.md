# Copilot Memory v1.1.0 - Rules System

## 🎯 What's New

Version 1.1.0 introduces a powerful **Rules System** that allows you to define coding guidelines, conventions, and best practices that Copilot will automatically follow in every chat session.

## Features

### 1. **Persistent Rules Storage**
- Rules are stored in SQLite database (same as knowledge)
- Survive across VS Code restarts
- Project-specific or shared across projects

### 2. **Automatic Rules Retrieval**
- Copilot instructions updated to call `retrieve_rules()` at chat start
- Rules are automatically loaded before any coding begins
- No manual action needed - happens transparently

### 3. **Rules Management**
- **Create**: Save new rules with categories and priorities
- **Update**: Modify existing rules
- **Delete**: Remove outdated rules
- **List**: View all rules with IDs for management
- **Enable/Disable**: Toggle rules without deleting

## How to Use

### Creating Rules

When you want Copilot to remember a guideline:

**User says:**
```
"Save as rule: Always use TypeScript strict mode"
"Remember this rule: Never use 'any' type, prefer 'unknown'"
"Add rule: All functions must have JSDoc comments"
```

**Copilot calls:**
```javascript
store_rule({
  title: "TypeScript Strict Mode",
  content: "Always use TypeScript strict mode in tsconfig.json",
  category: "code-style",
  priority: 8
})
```

### Categories

Rules can be organized into categories:
- `code-style` - Formatting, naming conventions
- `architecture` - Project structure, design patterns
- `testing` - Testing requirements and practices
- `security` - Security guidelines
- `performance` - Performance optimization rules
- `general` - General guidelines

### Priority System

Priority: 0-10 (higher = more important)
- **10**: Critical rules (security, must-follow)
- **8-9**: Important guidelines (architecture, best practices)
- **5-7**: Standard rules (code style, conventions)
- **1-4**: Nice-to-have suggestions
- **0**: Low priority reminders

## MCP Tools

### `mcp_copilot-memor_store_rule`
**Usage:** When user says "save as rule", "remember this rule"

**Parameters:**
```typescript
{
  title: string,         // Short title
  content: string,       // The rule content
  category?: string,     // Optional category (default: "general")
  priority?: number      // Optional priority 0-10 (default: 5)
}
```

**Example:**
```javascript
store_rule({
  title: "React Hooks Rules",
  content: "Always follow React Hooks rules: don't call Hooks inside loops, conditions, or nested functions",
  category: "architecture",
  priority: 9
})
```

### `mcp_copilot-memor_retrieve_rules`
**Usage:** **AUTOMATICALLY CALLED** at start of every chat

**Parameters:**
```typescript
{
  category?: string  // Optional: filter by category
}
```

**Returns:**
```
📋 Active Rules (3):

1. **TypeScript Strict Mode** ⭐⭐⭐⭐⭐⭐⭐⭐
   Category: code-style | Priority: 8
   Always use TypeScript strict mode in tsconfig.json

2. **React Hooks Rules** ⭐⭐⭐⭐⭐⭐⭐⭐⭐
   Category: architecture | Priority: 9
   Always follow React Hooks rules...

3. **JSDoc Comments** ⭐⭐⭐⭐⭐
   Category: code-style | Priority: 5
   All functions must have JSDoc comments

✨ Apply these rules to all your code and responses.
```

### `mcp_copilot-memor_list_rules`
**Usage:** Show all rules with management details

**Parameters:**
```typescript
{
  includeDisabled?: boolean  // Show disabled rules (default: false)
}
```

**Returns:**
```
📋 Rules List (3 active):

1. ✅ **TypeScript Strict Mode** ⭐⭐⭐⭐⭐⭐⭐⭐
   ID: `abc123def`
   Category: code-style | Priority: 8 | Created: 11/13/2025
   Content: Always use TypeScript strict mode...

2. ✅ **React Hooks Rules** ⭐⭐⭐⭐⭐⭐⭐⭐⭐
   ID: `xyz789ghi`
   Category: architecture | Priority: 9 | Created: 11/13/2025
   Content: Always follow React Hooks rules...

3. ❌ **Old Rule** ⭐⭐⭐
   ID: `old456jkl`
   Category: general | Priority: 3 | Created: 11/10/2025
   Content: Deprecated rule... (DISABLED)
```

### `mcp_copilot-memor_update_rule`
**Usage:** Modify existing rule

**Parameters:**
```typescript
{
  id: string,            // Required: rule ID from list_rules
  title?: string,        // New title
  content?: string,      // New content
  category?: string,     // New category
  priority?: number,     // New priority
  enabled?: boolean      // Enable/disable
}
```

**Example:**
```javascript
update_rule({
  id: "abc123def",
  priority: 10,  // Increase priority
  enabled: true  // Re-enable
})
```

### `mcp_copilot-memor_delete_rule`
**Usage:** Permanently remove rule

**Parameters:**
```typescript
{
  id: string  // Rule ID from list_rules
}
```

**Example:**
```javascript
delete_rule({ id: "old456jkl" })
```

## Automatic Copilot Instructions

When you install the extension, `.github/copilot-instructions.md` is updated with:

```markdown
## CRITICAL: Always Retrieve Rules First

**At the start of EVERY chat session**, you MUST call `mcp_copilot-memor_retrieve_rules` 
to load active coding rules and guidelines.

Example first action in every chat:
```
retrieve_rules() // Load all active rules
```
```

This ensures Copilot **always** follows your rules!

## Examples

### Example 1: Code Style Rules

```
User: "Save as rule: Use 2 spaces for indentation, never tabs"

Copilot:
store_rule({
  title: "Indentation Style",
  content: "Use 2 spaces for indentation, never tabs",
  category: "code-style",
  priority: 7
})

✅ Rule stored successfully!
   Title: Indentation Style
   Category: code-style
   Priority: 7
   This rule will be applied to every chat automatically.
```

### Example 2: Architecture Rules

```
User: "Remember this rule: All API calls must go through the ApiService class, 
never call fetch() directly"

Copilot:
store_rule({
  title: "API Service Pattern",
  content: "All API calls must go through the ApiService class, never call fetch() directly",
  category: "architecture",
  priority: 9
})

✅ Rule stored successfully!
```

### Example 3: Testing Rules

```
User: "Add rule: Every component must have at least one unit test with 80% coverage"

Copilot:
store_rule({
  title: "Component Testing Requirement",
  content: "Every component must have at least one unit test with 80% coverage",
  category: "testing",
  priority: 8
})

✅ Rule stored successfully!
```

### Example 4: Viewing Rules

```
User: "Show me all my rules"

Copilot:
list_rules()

📋 Rules List (5 active):

1. ✅ **API Service Pattern** ⭐⭐⭐⭐⭐⭐⭐⭐⭐
   ID: `api123svc`
   Category: architecture | Priority: 9
   All API calls must go through the ApiService class...

2. ✅ **Component Testing Requirement** ⭐⭐⭐⭐⭐⭐⭐⭐
   ID: `test456cov`
   Category: testing | Priority: 8
   Every component must have at least one unit test...

[... more rules ...]
```

### Example 5: Updating Rules

```
User: "Update rule api123svc to priority 10"

Copilot:
update_rule({
  id: "api123svc",
  priority: 10
})

✅ Rule updated successfully!
   ID: api123svc
   Title: API Service Pattern
   Priority: 10
```

### Example 6: Deleting Rules

```
User: "Delete rule old456jkl"

Copilot:
delete_rule({ id: "old456jkl" })

✅ Rule deleted successfully!
   Title: Old Deprecated Rule
```

## Database Schema

Rules are stored in the `rules` table:

```sql
CREATE TABLE rules (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  priority INTEGER DEFAULT 0,
  enabled INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_rules_enabled ON rules(enabled);
CREATE INDEX idx_rules_priority ON rules(priority DESC);
CREATE INDEX idx_rules_category ON rules(category);
```

## How It Works

### 1. Extension Installation
- Creates `.github/copilot-instructions.md`
- Adds instruction to call `retrieve_rules()` at chat start

### 2. Chat Begins
- Copilot reads instructions
- **Automatically calls** `retrieve_rules()`
- Loads all active rules into context

### 3. User Interaction
- User asks Copilot to write code
- Copilot follows loaded rules
- Code respects your guidelines

### 4. Rule Management
- User can add/update/delete rules anytime
- Changes take effect in next chat session
- Rules persist across restarts

## Benefits

### ✅ Consistency
- All code follows same guidelines
- No need to repeat instructions
- Team-wide standards enforced

### ✅ Productivity
- Don't repeat yourself
- Copilot remembers your preferences
- Faster onboarding for new team members

### ✅ Quality
- Enforce best practices automatically
- Catch issues early
- Maintain code quality standards

### ✅ Flexibility
- Enable/disable rules without deleting
- Adjust priorities as needed
- Categorize for organization

## Use Cases

### Personal Projects
- Your coding style preferences
- Framework-specific patterns
- Project architecture decisions

### Team Projects
- Shared coding standards
- Architecture guidelines
- Review checklist items

### Client Projects
- Client-specific requirements
- Industry regulations
- Security policies

### Learning
- Store best practices as you learn
- Build personal knowledge base
- Reference patterns and techniques

## Tips & Best Practices

### 1. **Be Specific**
```
❌ Bad: "Write clean code"
✅ Good: "Use meaningful variable names with camelCase, avoid abbreviations"
```

### 2. **Use Categories**
```
code-style: Formatting, naming
architecture: Design patterns
testing: Test requirements
security: Security policies
```

### 3. **Set Appropriate Priorities**
```
10: Security rules (must follow)
8-9: Architecture patterns
5-7: Code style conventions
1-4: Nice-to-have suggestions
```

### 4. **Keep Rules Focused**
```
❌ One rule for everything
✅ Multiple focused rules
```

### 5. **Review Periodically**
```
- List all rules monthly
- Disable outdated ones
- Update priorities as needed
```

### 6. **Use Descriptive Titles**
```
❌ "Rule 1", "Important"
✅ "React Hooks Pattern", "API Error Handling"
```

## Troubleshooting

### Rules Not Being Applied?

1. **Check Copilot instructions exist:**
   ```
   .github/copilot-instructions.md
   ```

2. **Verify rules are enabled:**
   ```
   list_rules({ includeDisabled: true })
   ```

3. **Reload VS Code:**
   - Copilot reads instructions on startup

### Can't Find Rule ID?

Use `list_rules()` to see all rule IDs:
```
list_rules()
// Shows: ID: `abc123def`
```

### Too Many Rules?

Disable low-priority rules:
```
update_rule({ id: "low456pri", enabled: false })
```

## Migration from ByteRover

If you were using ByteRover:
1. Your knowledge is still available
2. Rules are a new feature
3. Both systems coexist
4. Copilot instructions updated automatically

## Future Enhancements

Planned for future versions:
- [ ] Rule templates library
- [ ] Import/export rules
- [ ] Share rules with team
- [ ] Rule conflict detection
- [ ] Category-based auto-loading
- [ ] UI for managing rules

## Summary

Version 1.1.0 adds a comprehensive rules system that:
- ✅ Stores coding guidelines persistently
- ✅ Automatically loads rules in every chat
- ✅ Supports full CRUD operations
- ✅ Includes priority and category system
- ✅ Updates Copilot instructions automatically
- ✅ Works alongside knowledge storage

**Result:** Copilot always follows your coding standards! 🎯
