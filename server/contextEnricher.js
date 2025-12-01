/**
 * ContextEnricher - Extracts and enriches context from content
 * 
 * This module provides intelligent context extraction from text content,
 * including symbol references, file paths, and related code elements.
 */

class ContextEnricher {
  constructor(getStatements) {
    // Function to get prepared statements for database queries
    this.getStatements = getStatements;
    
    // Regex patterns for entity extraction
    this.patterns = {
      // File paths (relative and absolute)
      filePath: /(?:^|[\s'"(])([.\/]?(?:[\w-]+\/)*[\w-]+\.[a-zA-Z]{1,10})(?=[\s'")\]:]|$)/gm,
      
      // Import statements
      importStatement: /(?:import|from|require)\s*\(?['"]([@\w\-\/.]+)['"]\)?/gm,
      
      // Function/method names (common patterns)
      functionCall: /\b([a-zA-Z_$][\w$]*)\s*\(/gm,
      
      // Class names (PascalCase)
      className: /\b([A-Z][a-zA-Z0-9]+)\b/g,
      
      // Variable/constant references (camelCase and UPPER_CASE)
      identifier: /\b([a-z_$][\w$]*)\b/g,
      
      // Code block markers
      codeBlock: /```(?:(\w+)\n)?([\s\S]*?)```/gm,
      
      // Backtick inline code
      inlineCode: /`([^`]+)`/g
    };
    
    // Common programming keywords to ignore
    this.ignoreKeywords = new Set([
      // JavaScript/TypeScript
      'const', 'let', 'var', 'function', 'class', 'interface', 'type',
      'import', 'export', 'from', 'require', 'module', 'return', 'if',
      'else', 'for', 'while', 'switch', 'case', 'break', 'continue',
      'try', 'catch', 'finally', 'throw', 'new', 'this', 'super',
      'async', 'await', 'yield', 'null', 'undefined', 'true', 'false',
      'void', 'typeof', 'instanceof', 'in', 'of', 'delete',
      // Python
      'def', 'lambda', 'with', 'as', 'pass', 'raise', 'except',
      'global', 'nonlocal', 'assert', 'elif', 'None', 'True', 'False',
      'and', 'or', 'not', 'is', 'self', 'cls',
      // Common words
      'get', 'set', 'has', 'add', 'remove', 'update', 'delete', 'create',
      'find', 'search', 'filter', 'map', 'reduce', 'forEach', 'length',
      'size', 'count', 'name', 'value', 'key', 'data', 'error', 'result',
      'response', 'request', 'args', 'params', 'options', 'config'
    ]);
  }

  /**
   * Extract all potential entities from content
   * @param {string} content - The text content to analyze
   * @returns {Object} Extracted entities
   */
  extractEntities(content) {
    const entities = {
      filePaths: new Set(),
      imports: new Set(),
      functionCalls: new Set(),
      classNames: new Set(),
      identifiers: new Set(),
      codeBlocks: []
    };
    
    // Extract file paths
    let match;
    const filePathRegex = new RegExp(this.patterns.filePath.source, 'gm');
    while ((match = filePathRegex.exec(content)) !== null) {
      const path = match[1].trim();
      if (path.includes('.') && !path.startsWith('.git') && path.length < 200) {
        entities.filePaths.add(path);
      }
    }
    
    // Extract imports
    const importRegex = new RegExp(this.patterns.importStatement.source, 'gm');
    while ((match = importRegex.exec(content)) !== null) {
      entities.imports.add(match[1]);
    }
    
    // Extract function calls
    const funcRegex = new RegExp(this.patterns.functionCall.source, 'gm');
    while ((match = funcRegex.exec(content)) !== null) {
      const name = match[1];
      if (!this.ignoreKeywords.has(name) && name.length > 2) {
        entities.functionCalls.add(name);
      }
    }
    
    // Extract class names
    const classRegex = new RegExp(this.patterns.className.source, 'g');
    while ((match = classRegex.exec(content)) !== null) {
      const name = match[1];
      if (!this.ignoreKeywords.has(name) && name.length > 2) {
        entities.classNames.add(name);
      }
    }
    
    // Extract inline code content
    const inlineCodeRegex = new RegExp(this.patterns.inlineCode.source, 'g');
    while ((match = inlineCodeRegex.exec(content)) !== null) {
      const code = match[1];
      // Try to identify if it's a file path, function, or class
      if (code.includes('/') || code.includes('.')) {
        entities.filePaths.add(code);
      } else if (code.match(/^[A-Z]/)) {
        entities.classNames.add(code);
      } else if (!this.ignoreKeywords.has(code) && code.length > 2) {
        entities.identifiers.add(code);
      }
    }
    
    // Extract code blocks with language info
    const codeBlockRegex = new RegExp(this.patterns.codeBlock.source, 'gm');
    while ((match = codeBlockRegex.exec(content)) !== null) {
      entities.codeBlocks.push({
        language: match[1] || 'unknown',
        code: match[2]
      });
    }
    
    return entities;
  }

  /**
   * Look up symbols in the indexed codebase
   * @param {Set<string>} names - Symbol names to search for
   * @param {number} limit - Maximum results per name
   * @returns {Array} Matching symbols
   */
  lookupSymbols(names, limit = 5) {
    const results = [];
    const stmts = this.getStatements('project');
    
    if (!stmts || !stmts.searchSymbolsFts) {
      return results;
    }
    
    for (const name of names) {
      try {
        // Use FTS search for each symbol name
        const matches = stmts.searchSymbolsFts.all(`"${name}"`, limit);
        for (const match of matches) {
          results.push({
            name: match.name,
            kind: match.kind,
            file: match.relative_path,
            line: match.start_line
          });
        }
      } catch (e) {
        // Ignore search errors, continue with other names
      }
    }
    
    // Deduplicate by name + file
    const seen = new Set();
    return results.filter(r => {
      const key = `${r.name}:${r.file}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Find related files based on imports and file references
   * @param {Set<string>} paths - File paths or import paths to search
   * @param {number} limit - Maximum results
   * @returns {Array} Related file paths
   */
  findRelatedFiles(paths, limit = 10) {
    const results = new Set();
    const stmts = this.getStatements('project');
    
    if (!stmts || !stmts.findImporters) {
      return Array.from(paths).slice(0, limit);
    }
    
    for (const importPath of paths) {
      try {
        // Search for files that import this path
        const pattern = `%${importPath}%`;
        const matches = stmts.findImporters.all(pattern, limit);
        for (const match of matches) {
          results.add(match.relative_path);
        }
      } catch (e) {
        // Ignore errors
      }
    }
    
    // Also add original paths if they look like real files
    for (const p of paths) {
      if (p.includes('.') && !p.startsWith('@') && !p.startsWith('node_modules')) {
        results.add(p);
      }
    }
    
    return Array.from(results).slice(0, limit);
  }

  /**
   * Enrich content with context from the codebase
   * @param {string} content - The content to enrich
   * @param {Object} options - Enrichment options
   * @returns {Object} Enriched context
   */
  enrich(content, options = {}) {
    const {
      includeSymbols = true,
      includeRelatedFiles = true,
      symbolLimit = 20,
      fileLimit = 10,
      activeFile = null
    } = options;
    
    // Extract entities from content
    const entities = this.extractEntities(content);
    
    const result = {
      activeFile: activeFile,
      relatedSymbols: [],
      relatedFiles: [],
      extractedEntities: {
        filePathCount: entities.filePaths.size,
        importCount: entities.imports.size,
        functionCount: entities.functionCalls.size,
        classCount: entities.classNames.size
      }
    };
    
    // Look up symbols if enabled
    if (includeSymbols) {
      const allSymbolNames = new Set([
        ...entities.functionCalls,
        ...entities.classNames,
        ...entities.identifiers
      ]);
      
      result.relatedSymbols = this.lookupSymbols(allSymbolNames, symbolLimit);
    }
    
    // Find related files if enabled
    if (includeRelatedFiles) {
      const allPaths = new Set([
        ...entities.filePaths,
        ...entities.imports
      ]);
      
      result.relatedFiles = this.findRelatedFiles(allPaths, fileLimit);
      
      // Add files from symbol matches
      for (const symbol of result.relatedSymbols) {
        if (symbol.file && !result.relatedFiles.includes(symbol.file)) {
          result.relatedFiles.push(symbol.file);
        }
      }
      
      // Limit final file list
      result.relatedFiles = result.relatedFiles.slice(0, fileLimit);
    }
    
    // Add active file to related files if provided and not already included
    if (activeFile && !result.relatedFiles.includes(activeFile)) {
      result.relatedFiles.unshift(activeFile);
    }
    
    return result;
  }

  /**
   * Search for knowledge entries that match given symbols
   * @param {Array<string>} symbolNames - Symbol names to match
   * @param {number} limit - Maximum results
   * @returns {Array} Matching knowledge IDs
   */
  findKnowledgeBySymbols(symbolNames, limit = 10) {
    const stmts = this.getStatements('project');
    
    if (!stmts || !stmts.searchFts) {
      return [];
    }
    
    const results = [];
    const seen = new Set();
    
    for (const name of symbolNames) {
      try {
        // Search FTS for knowledge containing this symbol name
        const matches = stmts.searchFts.all(`"${name}"`, limit);
        for (const match of matches) {
          if (!seen.has(match.id)) {
            seen.add(match.id);
            results.push(match);
          }
        }
      } catch (e) {
        // Ignore search errors
      }
    }
    
    return results.slice(0, limit);
  }
}

module.exports = { ContextEnricher };
