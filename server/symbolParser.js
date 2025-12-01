#!/usr/bin/env node
/**
 * Symbol Parser using Tree-sitter for fast code parsing
 * Supports all common programming languages
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Language configurations for parsing
const LANGUAGE_CONFIG = {
  // JavaScript/TypeScript family
  '.js': { language: 'javascript', symbolTypes: ['function', 'class', 'variable', 'arrow_function', 'method_definition'] },
  '.jsx': { language: 'javascript', symbolTypes: ['function', 'class', 'variable', 'arrow_function', 'method_definition'] },
  '.ts': { language: 'typescript', symbolTypes: ['function', 'class', 'interface', 'type_alias', 'variable', 'method_definition'] },
  '.tsx': { language: 'typescript', symbolTypes: ['function', 'class', 'interface', 'type_alias', 'variable', 'method_definition'] },
  '.mjs': { language: 'javascript', symbolTypes: ['function', 'class', 'variable', 'arrow_function'] },
  '.cjs': { language: 'javascript', symbolTypes: ['function', 'class', 'variable', 'arrow_function'] },
  
  // Python
  '.py': { language: 'python', symbolTypes: ['function_definition', 'class_definition', 'decorated_definition'] },
  '.pyi': { language: 'python', symbolTypes: ['function_definition', 'class_definition'] },
  
  // Rust
  '.rs': { language: 'rust', symbolTypes: ['function_item', 'struct_item', 'enum_item', 'impl_item', 'trait_item', 'mod_item'] },
  
  // Go
  '.go': { language: 'go', symbolTypes: ['function_declaration', 'method_declaration', 'type_declaration', 'const_declaration'] },
  
  // Java
  '.java': { language: 'java', symbolTypes: ['class_declaration', 'method_declaration', 'interface_declaration', 'enum_declaration'] },
  
  // C/C++
  '.c': { language: 'c', symbolTypes: ['function_definition', 'struct_specifier', 'enum_specifier', 'type_definition'] },
  '.h': { language: 'c', symbolTypes: ['function_definition', 'struct_specifier', 'enum_specifier', 'type_definition'] },
  '.cpp': { language: 'cpp', symbolTypes: ['function_definition', 'class_specifier', 'struct_specifier', 'namespace_definition'] },
  '.cc': { language: 'cpp', symbolTypes: ['function_definition', 'class_specifier', 'struct_specifier'] },
  '.hpp': { language: 'cpp', symbolTypes: ['function_definition', 'class_specifier', 'struct_specifier'] },
  '.cxx': { language: 'cpp', symbolTypes: ['function_definition', 'class_specifier', 'struct_specifier'] },
  
  // C#
  '.cs': { language: 'csharp', symbolTypes: ['class_declaration', 'method_declaration', 'interface_declaration', 'struct_declaration'] },
  
  // Ruby
  '.rb': { language: 'ruby', symbolTypes: ['method', 'class', 'module', 'singleton_method'] },
  
  // PHP
  '.php': { language: 'php', symbolTypes: ['function_definition', 'class_declaration', 'method_declaration', 'interface_declaration'] },
  
  // Swift
  '.swift': { language: 'swift', symbolTypes: ['function_declaration', 'class_declaration', 'struct_declaration', 'protocol_declaration'] },
  
  // Kotlin
  '.kt': { language: 'kotlin', symbolTypes: ['function_declaration', 'class_declaration', 'object_declaration', 'interface_declaration'] },
  '.kts': { language: 'kotlin', symbolTypes: ['function_declaration', 'class_declaration'] },
  
  // Scala
  '.scala': { language: 'scala', symbolTypes: ['function_definition', 'class_definition', 'object_definition', 'trait_definition'] },
  
  // Shell
  '.sh': { language: 'bash', symbolTypes: ['function_definition'] },
  '.bash': { language: 'bash', symbolTypes: ['function_definition'] },
  '.zsh': { language: 'bash', symbolTypes: ['function_definition'] },
  
  // Lua
  '.lua': { language: 'lua', symbolTypes: ['function_declaration', 'local_function'] },
  
  // Dart
  '.dart': { language: 'dart', symbolTypes: ['function_signature', 'class_definition', 'method_signature'] },
  
  // Elixir
  '.ex': { language: 'elixir', symbolTypes: ['call'] },
  '.exs': { language: 'elixir', symbolTypes: ['call'] },
  
  // Haskell
  '.hs': { language: 'haskell', symbolTypes: ['function', 'type_signature'] },
  
  // OCaml
  '.ml': { language: 'ocaml', symbolTypes: ['let_binding', 'type_definition', 'module_definition'] },
  '.mli': { language: 'ocaml', symbolTypes: ['let_binding', 'type_definition'] },
  
  // Vue (treat as HTML/JS hybrid)
  '.vue': { language: 'vue', symbolTypes: ['script_element'] },
  
  // Svelte
  '.svelte': { language: 'svelte', symbolTypes: ['script_element'] },
  
  // JSON (for config files)
  '.json': { language: 'json', symbolTypes: [] },
  
  // YAML
  '.yml': { language: 'yaml', symbolTypes: [] },
  '.yaml': { language: 'yaml', symbolTypes: [] },
  
  // Markdown
  '.md': { language: 'markdown', symbolTypes: ['heading'] },
  '.mdx': { language: 'markdown', symbolTypes: ['heading'] },
  
  // SQL
  '.sql': { language: 'sql', symbolTypes: ['create_table', 'create_function', 'create_view'] },
  
  // GraphQL
  '.graphql': { language: 'graphql', symbolTypes: ['type_definition', 'query_definition', 'mutation_definition'] },
  '.gql': { language: 'graphql', symbolTypes: ['type_definition', 'query_definition'] },
};

// Import patterns for different languages
const IMPORT_PATTERNS = {
  javascript: [
    /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ],
  typescript: [
    /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /from\s+['"]([^'"]+)['"]/g,
  ],
  python: [
    /^import\s+(\S+)/gm,
    /^from\s+(\S+)\s+import/gm,
  ],
  rust: [
    /use\s+([^;]+)/g,
    /mod\s+(\w+)/g,
    /extern\s+crate\s+(\w+)/g,
  ],
  go: [
    /import\s+["']([^"']+)["']/g,
    /import\s+\(\s*(?:["']([^"']+)["']\s*)+\)/g,
  ],
  java: [
    /import\s+(?:static\s+)?([^;]+);/g,
  ],
  csharp: [
    /using\s+(?:static\s+)?([^;]+);/g,
  ],
  ruby: [
    /require\s+['"]([^'"]+)['"]/g,
    /require_relative\s+['"]([^'"]+)['"]/g,
    /load\s+['"]([^'"]+)['"]/g,
  ],
  php: [
    /use\s+([^;]+);/g,
    /include(?:_once)?\s+['"]([^'"]+)['"]/g,
    /require(?:_once)?\s+['"]([^'"]+)['"]/g,
  ],
};

// SymbolKind enum (matches VS Code's SymbolKind)
const SymbolKind = {
  File: 0,
  Module: 1,
  Namespace: 2,
  Package: 3,
  Class: 4,
  Method: 5,
  Property: 6,
  Field: 7,
  Constructor: 8,
  Enum: 9,
  Interface: 10,
  Function: 11,
  Variable: 12,
  Constant: 13,
  String: 14,
  Number: 15,
  Boolean: 16,
  Array: 17,
  Object: 18,
  Key: 19,
  Null: 20,
  EnumMember: 21,
  Struct: 22,
  Event: 23,
  Operator: 24,
  TypeParameter: 25,
};

// Map tree-sitter node types to SymbolKind
const NODE_TO_SYMBOL_KIND = {
  // Functions
  'function': SymbolKind.Function,
  'function_definition': SymbolKind.Function,
  'function_declaration': SymbolKind.Function,
  'function_item': SymbolKind.Function,
  'arrow_function': SymbolKind.Function,
  'method_definition': SymbolKind.Method,
  'method_declaration': SymbolKind.Method,
  'method': SymbolKind.Method,
  'singleton_method': SymbolKind.Method,
  'local_function': SymbolKind.Function,
  
  // Classes
  'class': SymbolKind.Class,
  'class_definition': SymbolKind.Class,
  'class_declaration': SymbolKind.Class,
  'class_specifier': SymbolKind.Class,
  
  // Interfaces
  'interface': SymbolKind.Interface,
  'interface_declaration': SymbolKind.Interface,
  'trait_item': SymbolKind.Interface,
  'trait_definition': SymbolKind.Interface,
  'protocol_declaration': SymbolKind.Interface,
  
  // Structs
  'struct_item': SymbolKind.Struct,
  'struct_specifier': SymbolKind.Struct,
  'struct_declaration': SymbolKind.Struct,
  
  // Enums
  'enum_item': SymbolKind.Enum,
  'enum_specifier': SymbolKind.Enum,
  'enum_declaration': SymbolKind.Enum,
  
  // Modules/Namespaces
  'module': SymbolKind.Module,
  'module_definition': SymbolKind.Module,
  'mod_item': SymbolKind.Module,
  'namespace_definition': SymbolKind.Namespace,
  'object_declaration': SymbolKind.Module,
  'object_definition': SymbolKind.Module,
  
  // Types
  'type_alias': SymbolKind.TypeParameter,
  'type_declaration': SymbolKind.TypeParameter,
  'type_definition': SymbolKind.TypeParameter,
  
  // Variables/Constants
  'variable': SymbolKind.Variable,
  'variable_declaration': SymbolKind.Variable,
  'const_declaration': SymbolKind.Constant,
  'let_binding': SymbolKind.Variable,
  
  // Decorated (Python)
  'decorated_definition': SymbolKind.Function,
  
  // Impl (Rust)
  'impl_item': SymbolKind.Class,
};

class SymbolParser {
  constructor() {
    this.treeSitter = null;
    this.parsers = {};
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      // Try to load tree-sitter
      this.treeSitter = require('tree-sitter');
      this.initialized = true;
      console.log('Tree-sitter initialized successfully');
    } catch (error) {
      console.log('Tree-sitter not available, using regex-based parsing');
      this.initialized = true;
    }
  }

  async getParser(language) {
    if (!this.treeSitter) return null;
    if (this.parsers[language]) return this.parsers[language];
    
    try {
      const Parser = this.treeSitter;
      const parser = new Parser();
      
      // Try to load the language grammar
      const langModule = require(`tree-sitter-${language}`);
      parser.setLanguage(langModule);
      
      this.parsers[language] = parser;
      return parser;
    } catch (error) {
      // Language not available
      return null;
    }
  }

  /**
   * Parse a file and extract metadata (synchronous version)
   */
  parseFile(filePath, providedContent = null) {
    const ext = path.extname(filePath).toLowerCase();
    const config = LANGUAGE_CONFIG[ext];
    
    if (!config) {
      return this.getBasicMetadata(filePath, providedContent);
    }

    let content;
    try {
      content = providedContent || fs.readFileSync(filePath, 'utf8');
    } catch (err) {
      console.error('Failed to read file:', filePath, err.message);
      return null;
    }
    
    const hash = crypto.createHash('md5').update(content).digest('hex');
    const lines = content.split('\n');
    
    let stats;
    try {
      stats = fs.statSync(filePath);
    } catch (err) {
      stats = { mtimeMs: Date.now(), ctimeMs: Date.now() };
    }
    
    const metadata = {
      filePath,
      relativePath: filePath, // Will be set by caller
      fileName: path.basename(filePath),
      extension: ext,
      languageId: config.language,
      size: Buffer.byteLength(content, 'utf8'),
      lineCount: lines.length,
      contentHash: hash,
      mtimeMs: stats.mtimeMs,
      ctimeMs: stats.ctimeMs,
      symbols: [],
      imports: [],
    };

    // Use regex extraction (tree-sitter requires native bindings)
    metadata.symbols = this.extractSymbolsRegex(content, config);

    // Extract imports
    metadata.imports = this.extractImports(content, config.language);

    return metadata;
  }

  /**
   * Parse a file and extract metadata (async version with tree-sitter support)
   */
  async parseFileAsync(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const config = LANGUAGE_CONFIG[ext];
    
    if (!config) {
      return this.getBasicMetadata(filePath, null);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const hash = crypto.createHash('md5').update(content).digest('hex');
    const lines = content.split('\n');
    
    const metadata = {
      filePath,
      relativePath: filePath, // Will be set by caller
      fileName: path.basename(filePath),
      extension: ext,
      languageId: config.language,
      size: Buffer.byteLength(content, 'utf8'),
      lineCount: lines.length,
      contentHash: hash,
      mtimeMs: fs.statSync(filePath).mtimeMs,
      ctimeMs: fs.statSync(filePath).ctimeMs,
      symbols: [],
      imports: [],
    };

    // Try tree-sitter first, fallback to regex
    await this.initialize();
    
    const parser = await this.getParser(config.language);
    if (parser) {
      metadata.symbols = this.extractSymbolsTreeSitter(parser, content, config);
    } else {
      metadata.symbols = this.extractSymbolsRegex(content, config);
    }

    // Extract imports
    metadata.imports = this.extractImports(content, config.language);

    return metadata;
  }

  /**
   * Extract symbols using tree-sitter AST
   */
  extractSymbolsTreeSitter(parser, content, config) {
    const symbols = [];
    
    try {
      const tree = parser.parse(content);
      const cursor = tree.walk();
      
      const visitNode = () => {
        const node = cursor.currentNode();
        const nodeType = node.type;
        
        if (config.symbolTypes.includes(nodeType)) {
          const symbol = this.extractSymbolFromNode(node, nodeType);
          if (symbol) {
            symbols.push(symbol);
          }
        }
        
        // Visit children
        if (cursor.gotoFirstChild()) {
          do {
            visitNode();
          } while (cursor.gotoNextSibling());
          cursor.gotoParent();
        }
      };
      
      visitNode();
    } catch (error) {
      console.error('Tree-sitter parsing error:', error.message);
    }
    
    return symbols;
  }

  /**
   * Extract symbol info from a tree-sitter node
   */
  extractSymbolFromNode(node, nodeType) {
    // Find the name node (usually the first identifier child)
    let nameNode = null;
    let containerName = null;
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === 'identifier' || child.type === 'property_identifier' || 
          child.type === 'name' || child.type === 'type_identifier') {
        nameNode = child;
        break;
      }
    }
    
    if (!nameNode) {
      // For arrow functions, try to get the variable name from parent
      if (nodeType === 'arrow_function' && node.parent) {
        const parent = node.parent;
        if (parent.type === 'variable_declarator') {
          for (let i = 0; i < parent.childCount; i++) {
            const child = parent.child(i);
            if (child.type === 'identifier') {
              nameNode = child;
              break;
            }
          }
        }
      }
    }
    
    if (!nameNode) return null;
    
    // Check if exported
    let isExported = false;
    let current = node;
    while (current.parent) {
      if (current.parent.type === 'export_statement' || 
          current.parent.type === 'export_declaration' ||
          current.parent.type === 'export') {
        isExported = true;
        break;
      }
      current = current.parent;
    }
    
    return {
      name: nameNode.text,
      kind: NODE_TO_SYMBOL_KIND[nodeType] || SymbolKind.Variable,
      containerName,
      startLine: node.startPosition.row + 1,
      startColumn: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column,
      isExported,
    };
  }

  /**
   * Extract symbols using regex (fallback)
   */
  extractSymbolsRegex(content, config) {
    const symbols = [];
    const lines = content.split('\n');
    
    // Common patterns for different languages
    const patterns = {
      javascript: [
        { regex: /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g, kind: SymbolKind.Function },
        { regex: /(?:export\s+)?class\s+(\w+)/g, kind: SymbolKind.Class },
        { regex: /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=/g, kind: SymbolKind.Variable },
        { regex: /(\w+)\s*:\s*(?:async\s+)?function/g, kind: SymbolKind.Method },
        { regex: /(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g, kind: SymbolKind.Function },
      ],
      typescript: [
        { regex: /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g, kind: SymbolKind.Function },
        { regex: /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/g, kind: SymbolKind.Class },
        { regex: /(?:export\s+)?interface\s+(\w+)/g, kind: SymbolKind.Interface },
        { regex: /(?:export\s+)?type\s+(\w+)/g, kind: SymbolKind.TypeParameter },
        { regex: /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*[=:]/g, kind: SymbolKind.Variable },
        { regex: /(?:export\s+)?enum\s+(\w+)/g, kind: SymbolKind.Enum },
      ],
      python: [
        { regex: /^def\s+(\w+)/gm, kind: SymbolKind.Function },
        { regex: /^class\s+(\w+)/gm, kind: SymbolKind.Class },
        { regex: /^async\s+def\s+(\w+)/gm, kind: SymbolKind.Function },
      ],
      rust: [
        { regex: /(?:pub\s+)?fn\s+(\w+)/g, kind: SymbolKind.Function },
        { regex: /(?:pub\s+)?struct\s+(\w+)/g, kind: SymbolKind.Struct },
        { regex: /(?:pub\s+)?enum\s+(\w+)/g, kind: SymbolKind.Enum },
        { regex: /(?:pub\s+)?trait\s+(\w+)/g, kind: SymbolKind.Interface },
        { regex: /impl(?:<[^>]+>)?\s+(\w+)/g, kind: SymbolKind.Class },
        { regex: /(?:pub\s+)?mod\s+(\w+)/g, kind: SymbolKind.Module },
      ],
      go: [
        { regex: /func\s+(?:\([^)]+\)\s+)?(\w+)/g, kind: SymbolKind.Function },
        { regex: /type\s+(\w+)\s+struct/g, kind: SymbolKind.Struct },
        { regex: /type\s+(\w+)\s+interface/g, kind: SymbolKind.Interface },
        { regex: /const\s+(\w+)/g, kind: SymbolKind.Constant },
      ],
      java: [
        { regex: /(?:public|private|protected)?\s*(?:static)?\s*(?:final)?\s*class\s+(\w+)/g, kind: SymbolKind.Class },
        { regex: /(?:public|private|protected)?\s*(?:static)?\s*\w+\s+(\w+)\s*\(/g, kind: SymbolKind.Method },
        { regex: /interface\s+(\w+)/g, kind: SymbolKind.Interface },
        { regex: /enum\s+(\w+)/g, kind: SymbolKind.Enum },
      ],
      c: [
        { regex: /(?:\w+\s+)+(\w+)\s*\([^)]*\)\s*\{/g, kind: SymbolKind.Function },
        { regex: /struct\s+(\w+)/g, kind: SymbolKind.Struct },
        { regex: /enum\s+(\w+)/g, kind: SymbolKind.Enum },
        { regex: /typedef\s+.*\s+(\w+)\s*;/g, kind: SymbolKind.TypeParameter },
      ],
      cpp: [
        { regex: /(?:\w+\s+)+(\w+)\s*\([^)]*\)\s*(?:const)?\s*(?:override)?\s*\{/g, kind: SymbolKind.Function },
        { regex: /class\s+(\w+)/g, kind: SymbolKind.Class },
        { regex: /struct\s+(\w+)/g, kind: SymbolKind.Struct },
        { regex: /namespace\s+(\w+)/g, kind: SymbolKind.Namespace },
      ],
      ruby: [
        { regex: /def\s+(\w+)/g, kind: SymbolKind.Method },
        { regex: /class\s+(\w+)/g, kind: SymbolKind.Class },
        { regex: /module\s+(\w+)/g, kind: SymbolKind.Module },
      ],
      php: [
        { regex: /function\s+(\w+)/g, kind: SymbolKind.Function },
        { regex: /class\s+(\w+)/g, kind: SymbolKind.Class },
        { regex: /interface\s+(\w+)/g, kind: SymbolKind.Interface },
        { regex: /trait\s+(\w+)/g, kind: SymbolKind.Interface },
      ],
    };

    const langPatterns = patterns[config.language] || patterns.javascript;
    
    for (const { regex, kind } of langPatterns) {
      let match;
      const re = new RegExp(regex.source, regex.flags);
      
      while ((match = re.exec(content)) !== null) {
        const beforeMatch = content.substring(0, match.index);
        const lineNumber = (beforeMatch.match(/\n/g) || []).length + 1;
        const lineStart = beforeMatch.lastIndexOf('\n') + 1;
        const column = match.index - lineStart;
        
        // Check if exported
        const lineContent = lines[lineNumber - 1] || '';
        const isExported = lineContent.includes('export') || lineContent.startsWith('pub ');
        
        symbols.push({
          name: match[1],
          kind,
          containerName: null,
          startLine: lineNumber,
          startColumn: column,
          endLine: lineNumber,
          endColumn: column + match[0].length,
          isExported,
        });
      }
    }
    
    return symbols;
  }

  /**
   * Extract imports from source code
   */
  extractImports(content, language) {
    const imports = [];
    const patterns = IMPORT_PATTERNS[language] || IMPORT_PATTERNS.javascript;
    
    for (const pattern of patterns) {
      const re = new RegExp(pattern.source, pattern.flags);
      let match;
      
      while ((match = re.exec(content)) !== null) {
        const importPath = match[1];
        if (importPath) {
          const beforeMatch = content.substring(0, match.index);
          const lineNumber = (beforeMatch.match(/\n/g) || []).length + 1;
          
          imports.push({
            importPath: importPath.trim(),
            importType: this.detectImportType(match[0]),
            isLocal: importPath.startsWith('.') || importPath.startsWith('/'),
            lineNumber,
          });
        }
      }
    }
    
    return imports;
  }

  /**
   * Detect import type from the match
   */
  detectImportType(matchText) {
    if (matchText.includes('require(')) return 'require';
    if (matchText.includes('import(')) return 'dynamic';
    if (matchText.includes('from ')) return 'import';
    if (matchText.includes('export')) return 'export';
    return 'import';
  }

  /**
   * Get basic metadata for unsupported file types
   */
  getBasicMetadata(filePath, content) {
    const stats = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    
    if (!content) {
      try {
        content = fs.readFileSync(filePath, 'utf8');
      } catch {
        content = '';
      }
    }
    
    const hash = content ? crypto.createHash('md5').update(content).digest('hex') : null;
    
    return {
      filePath,
      relativePath: filePath,
      fileName: path.basename(filePath),
      extension: ext,
      languageId: this.guessLanguage(ext),
      size: stats.size,
      lineCount: content ? content.split('\n').length : 0,
      contentHash: hash,
      mtimeMs: stats.mtimeMs,
      ctimeMs: stats.ctimeMs,
      symbols: [],
      imports: [],
    };
  }

  /**
   * Generate MD5 hash of content
   */
  generateHash(content) {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Guess language ID from extension
   */
  guessLanguage(ext) {
    const config = LANGUAGE_CONFIG[ext];
    if (config) return config.language;
    
    // Additional mappings
    const extraMappings = {
      '.txt': 'plaintext',
      '.html': 'html',
      '.htm': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.sass': 'sass',
      '.less': 'less',
      '.xml': 'xml',
      '.svg': 'xml',
      '.toml': 'toml',
      '.ini': 'ini',
      '.cfg': 'ini',
      '.conf': 'ini',
      '.dockerfile': 'dockerfile',
      '.makefile': 'makefile',
      '.cmake': 'cmake',
    };
    
    return extraMappings[ext] || 'unknown';
  }

  /**
   * Check if a file is likely binary
   */
  isBinaryFile(filePath) {
    const binaryExtensions = [
      '.png', '.jpg', '.jpeg', '.gif', '.ico', '.bmp', '.webp', '.svg',
      '.woff', '.woff2', '.ttf', '.otf', '.eot',
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.zip', '.tar', '.gz', '.rar', '.7z',
      '.exe', '.dll', '.so', '.dylib', '.bin',
      '.mp3', '.mp4', '.wav', '.avi', '.mov', '.webm',
      '.db', '.sqlite', '.sqlite3',
      '.pyc', '.pyo', '.class', '.o', '.obj',
      '.node', '.wasm',
    ];
    
    const ext = path.extname(filePath).toLowerCase();
    return binaryExtensions.includes(ext);
  }
}

module.exports = { SymbolParser, LANGUAGE_CONFIG, SymbolKind };
