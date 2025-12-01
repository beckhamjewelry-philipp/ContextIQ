# Contributing to Copilot Memory MCP

Thank you for your interest in contributing to Copilot Memory MCP! This guide will help you get started.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm 8+
- VSCode 1.85+
- Git

### Development Setup

1. **Fork and clone the repository**:
   ```bash
   git clone https://github.com/your-username/copilot-memory-mcp.git
   cd copilot-memory-mcp
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start development mode**:
   ```bash
   ./dev.sh
   ```

## 🏗️ Project Structure

```
copilot-memory-mcp/
├── server/          # MCP server implementation
│   ├── src/
│   │   ├── index.ts           # Main server entry
│   │   ├── storage/           # Storage backends
│   │   ├── tools/             # MCP tools
│   │   └── types/             # Type definitions
│   ├── package.json
│   └── tsconfig.json
├── extension/       # VSCode extension
│   ├── src/
│   │   ├── extension.ts       # Main extension
│   │   ├── mcpClient.ts      # MCP client
│   │   ├── configuration.ts   # Config management
│   │   └── memoryExplorer.ts # Tree view
│   ├── package.json
│   └── tsconfig.json
├── shared/         # Shared types
│   ├── src/
│   │   ├── types.ts          # Common interfaces
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
└── docs/           # Documentation
```

## 🔧 Development Workflow

### Making Changes

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** in the appropriate directory:
   - `server/` - MCP server functionality
   - `extension/` - VSCode extension features
   - `shared/` - Common types and utilities

3. **Test your changes**:
   ```bash
   # Test server
   cd server && npm test
   
   # Test extension
   cd extension && npm test
   
   # Manual testing
   ./dev.sh
   ```

4. **Build and verify**:
   ```bash
   ./build.sh
   ```

### Code Style

- **TypeScript**: Strict mode enabled
- **Formatting**: Use Prettier (configured in each package)
- **Linting**: ESLint with TypeScript rules
- **Naming**: 
  - camelCase for variables and functions
  - PascalCase for classes and interfaces
  - kebab-case for file names

### Commit Guidelines

Use conventional commits:

```
type(scope): description

Examples:
feat(server): add conflict resolution API
fix(extension): resolve configuration loading issue  
docs(readme): update installation instructions
test(server): add storage backend tests
```

Types:
- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation updates
- `test`: Test additions/updates
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `chore`: Maintenance tasks

## 🧪 Testing

### Running Tests

```bash
# All tests
npm test

# Server tests only
cd server && npm test

# Extension tests only
cd extension && npm test
```

### Test Categories

1. **Unit Tests**: Test individual functions and classes
2. **Integration Tests**: Test component interactions
3. **E2E Tests**: Test full workflows

### Writing Tests

- Place test files next to source files with `.test.ts` extension
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Mock external dependencies

Example:
```typescript
describe('LocalStorageBackend', () => {
  it('should store and retrieve knowledge entries', async () => {
    // Arrange
    const backend = new LocalStorageBackend('/tmp/test');
    await backend.initialize();
    
    // Act
    const entry = createTestEntry();
    await backend.store(entry);
    const results = await backend.retrieve({ query: 'test' });
    
    // Assert
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(entry.id);
  });
});
```

## 📚 Documentation

### Adding Documentation

- Update README.md for user-facing changes
- Add JSDoc comments for public APIs
- Update CHANGELOG.md for notable changes
- Add examples for new features

### Documentation Standards

- Use clear, concise language
- Include code examples where helpful
- Keep examples up to date
- Use proper Markdown formatting

## 🐛 Bug Reports

### Before Reporting

1. Search existing issues
2. Try latest version
3. Reproduce in clean environment

### Good Bug Reports Include

- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, VSCode version, Node.js version)
- Error messages and stack traces
- Minimal reproduction case

### Bug Report Template

```markdown
**Description**
A clear description of the bug.

**Steps to Reproduce**
1. Do this...
2. Then do this...
3. Bug occurs...

**Expected Behavior**
What should happen.

**Actual Behavior**  
What actually happens.

**Environment**
- OS: [e.g., macOS 14.0]
- VSCode: [e.g., 1.85.0]
- Node.js: [e.g., 20.0.0]
- Extension version: [e.g., 1.0.0]

**Additional Context**
Any other relevant information.
```

## ✨ Feature Requests

### Before Requesting

1. Check existing feature requests
2. Consider if it fits the project scope
3. Think about implementation complexity

### Good Feature Requests Include

- Clear use case and motivation
- Detailed description of desired behavior
- Examples of how it would be used
- Consideration of edge cases
- Alternative approaches considered

## 🔄 Pull Request Process

### Before Submitting

1. ✅ Tests pass (`npm test`)
2. ✅ Build succeeds (`./build.sh`)
3. ✅ Code follows style guidelines
4. ✅ Documentation updated
5. ✅ Commit messages follow convention

### PR Template

```markdown
## Description
Brief description of changes.

## Type of Change
- [ ] Bug fix
- [ ] New feature  
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings introduced
```

### Review Process

1. **Automated checks** run on every PR
2. **Maintainer review** for code quality and design
3. **Testing** in development environment
4. **Approval** and merge by maintainer

## 🏷️ Release Process

### Versioning

We use [Semantic Versioning](https://semver.org/):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)  
- **PATCH**: Bug fixes (backward compatible)

### Release Steps

1. Update version in package.json files
2. Update CHANGELOG.md
3. Create release commit
4. Tag release: `git tag v1.0.0`
5. Push: `git push --tags`
6. GitHub Actions handles publishing

## 💬 Community

### Getting Help

- 📚 Check documentation first
- 🐛 Search existing issues
- 💬 Start a discussion for questions
- 📧 Contact maintainers for sensitive issues

### Code of Conduct

Be respectful, inclusive, and constructive. We're all here to learn and build something amazing together.

## 🎯 Areas Needing Contributions

### High Priority

- [ ] Vector embeddings for semantic search
- [ ] Memory compression algorithms
- [ ] Performance optimizations
- [ ] Integration tests
- [ ] Documentation improvements

### Good First Issues

- [ ] Add more storage backend options
- [ ] Improve error messages  
- [ ] Add configuration validation
- [ ] Write more examples
- [ ] Fix TypeScript strict mode issues

### Advanced Features

- [ ] Plugin system for custom backends
- [ ] Web interface for memory management
- [ ] Memory analytics dashboard
- [ ] Collaborative features
- [ ] AI-powered memory insights

## 📞 Contact

- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions  
- **Security**: security@example.com

Thank you for contributing! 🙏