# Version 1.1.0 - Force Update Button for Copilot Instructions

## What Was Added

### ✅ New Button in Quick Setup Section

A new button **"📝 Update Copilot Instructions"** has been added to the sidebar that allows users to manually inject or force-update the `.github/copilot-instructions.md` file.

### Location in UI

```
⚡ Quick Setup
  📋 Copy MCP Configuration
  🚀 Install & Configure
  📝 Update Copilot Instructions  ← NEW!
```

## Why This Is Important

### Problem Solved:
1. **Extension Updates**: When users update the extension, new instructions (like rules support) aren't automatically injected
2. **Manual Control**: Users may want to regenerate instructions if they modified them
3. **Version Upgrades**: Instructions format may improve in new versions
4. **Corrupted Files**: If instructions get corrupted, users can easily regenerate them

## How It Works

### Button Behavior:

**Click "📝 Update Copilot Instructions"** and the extension will:

1. **Check for workspace**: Ensures a workspace folder is open
2. **Create `.github` directory**: If it doesn't exist
3. **Smart Update Logic**:
   - If `[copilot-memory-mcp]` section exists → **Replace with latest version**
   - If file doesn't have our section → **Prepend our instructions**
   - If file doesn't exist → **Create new file**

4. **Show confirmation dialog**:
   ```
   ✅ Copilot instructions updated (replaced existing section)!
   
   File: .github/copilot-instructions.md
   
   Copilot will now automatically retrieve rules at the start of every chat.
   
   [Open File]
   ```

5. **Optional**: Click "Open File" to view the updated instructions

## Force Update Logic

### The `force: true` Parameter

The button calls `createOrUpdateCopilotInstructions(true)` with force mode enabled.

**Without Force (Background Auto-Update)**:
- Only adds instructions if not present
- Skips if `[copilot-memory-mcp]` already exists
- Silent operation

**With Force (Manual Button Click)**:
- **Replaces** existing `[copilot-memory-mcp]` section with latest
- Preserves other sections in the file
- Shows success message with option to open file
- Perfect for version upgrades

### Section Replacement Algorithm

```typescript
if ([copilot-memory-mcp] exists) {
  // Find start of our section
  startIndex = find('[copilot-memory-mcp]')
  
  // Find end (next [xxx-mcp] marker or EOF)
  endIndex = find next /\[[\w-]+-mcp\]/ or EOF
  
  // Replace our section only
  content = content[0:start] + newInstructions + content[end:]
}
```

This ensures:
- ✅ Only our section is replaced
- ✅ Other MCP instructions preserved
- ✅ User's custom content after our section preserved

## Use Cases

### 1. After Extension Update
```
User updates extension v1.0.9 → v1.1.0
→ New rules features added
→ Click "Update Copilot Instructions"
→ Instructions now include rules tools
```

### 2. Corrupted Instructions
```
User accidentally breaks instructions file
→ Click "Update Copilot Instructions"
→ Clean, fresh instructions restored
```

### 3. Multiple Workspaces
```
User has 5 projects
→ Install extension in one
→ Switch to other projects
→ Click "Update Copilot Instructions" in each
→ All projects have latest instructions
```

### 4. Team Onboarding
```
New team member clones repo
→ Opens in VS Code
→ Click "Update Copilot Instructions"
→ Ready to use Copilot with rules
```

## Technical Details

### Function Signature
```typescript
async function createOrUpdateCopilotInstructions(force: boolean = false): Promise<void>
```

### Command Registration
```typescript
vscode.commands.registerCommand('copilot-memory.updateCopilotInstructions', async () => {
  await createOrUpdateCopilotInstructions(true); // Force update
})
```

### Tree Item
```typescript
new MemoryTreeItem(
  '  📝 Update Copilot Instructions',
  vscode.TreeItemCollapsibleState.None,
  {
    command: 'copilot-memory.updateCopilotInstructions',
    title: 'Update Copilot Instructions'
  },
  new vscode.ThemeIcon('file-code'),
  'Create or update .github/copilot-instructions.md with rules support'
)
```

## What Gets Updated

The latest instructions include:

### 1. **Rules Auto-Retrieval**
```markdown
## CRITICAL: Always Retrieve Rules First

**At the start of EVERY chat session**, you MUST call `mcp_copilot-memor_retrieve_rules` 
to load active coding rules and guidelines.
```

### 2. **All 8 Tools Documented**
- store_knowledge
- retrieve_knowledge
- list_knowledge
- **store_rule** ← New in 1.1.0
- **retrieve_rules** ← New in 1.1.0
- **list_rules** ← New in 1.1.0
- **update_rule** ← New in 1.1.0
- **delete_rule** ← New in 1.1.0

### 3. **Usage Guidelines**
- When to use each tool
- Required parameters
- Best practices
- Examples

### 4. **Rules System Documentation**
- Categories (code-style, architecture, testing, etc.)
- Priority system (0-10)
- Enable/disable functionality

## User Experience

### Before (v1.0.9)
```
User: "My instructions don't have the rules feature"
Support: "You need to manually edit .github/copilot-instructions.md"
User: 😞 "That's complicated"
```

### After (v1.1.0)
```
User: "My instructions don't have the rules feature"
Support: "Just click the 'Update Copilot Instructions' button in the sidebar"
User: *clicks button*
System: ✅ "Updated!"
User: 😃 "That was easy!"
```

## Error Handling

### No Workspace Open
```
Warning: No workspace folder open. Please open a workspace first.
```

### File System Error
```
Error: Failed to update Copilot instructions: [error details]
```

### Success Cases
```
✅ created
✅ updated (replaced existing section)
✅ updated (added to existing file)
✅ updated (replaced ByteRover)
✅ skipped (already exists) ← only in non-force mode
```

## Benefits

### ✅ User-Friendly
- One-click operation
- No manual file editing
- Clear success/error messages

### ✅ Version-Safe
- Always gets latest instructions format
- Preserves other content
- Smart section replacement

### ✅ Flexible
- Works in any workspace
- Handles existing files gracefully
- Optional file preview

### ✅ Reliable
- Proper error handling
- Rollback-safe (only replaces our section)
- Creates directories if needed

## Package Size

Updated package: **135.6 KB** (0.52 KB larger)
- `extension.js`: +2.42 KB (new force update logic)
- `memoryTreeProvider.js`: +0.34 KB (new button)

## Recommendation

**After every extension update**, users should:
1. Click **"📝 Update Copilot Instructions"** button
2. Verify instructions in `.github/copilot-instructions.md`
3. Reload VS Code if needed

This ensures they always have the latest tool definitions and features!
