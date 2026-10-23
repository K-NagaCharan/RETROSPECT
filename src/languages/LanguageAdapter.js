const TreeSitterManager = require('../parser/TreeSitterManager');

class LanguageAdapter {
  constructor(languageId) {
    if (!languageId) {
      throw new Error('LanguageAdapter requires a languageId');
    }
    this.languageId = languageId;
  }

  getLanguageId() {
    return this.languageId;
  }

  getFileExtensions() {
    return [];
  }

  canHandle(filePath) {
    if (!filePath) return false;
    const extensions = this.getFileExtensions();
    return extensions.some(ext => filePath.endsWith(ext));
  }

  async parse(sourceCode) {
    // One parser per language, reused: parsers live in WASM memory and were previously leaked on every call.
    const parser = await TreeSitterManager.getParser(this.languageId);
    return parser.parse(sourceCode);
  }

  /**
   * Extract symbols from parsed tree.
   * @param {string} sourceCode 
   * @param {object} tree 
   * @param {string} filePath 
   * @returns {Array<SymbolRecord>}
   */
  extractSymbols(sourceCode, tree, filePath) {
    throw new Error('extractSymbols must be implemented by concrete subclass');
  }

  normalizeSignature(name, parameters, returnType) {
    const paramsStr = (parameters || []).map(p => {
      if (typeof p === 'string') return p;
      if (p.type) return `${p.name}: ${p.type}`;
      return p.name || '';
    }).filter(Boolean).join(', ');
    
    if (returnType) {
      return `${name}(${paramsStr}): ${returnType}`;
    }
    return `${name}(${paramsStr})`;
  }

  tokenize(sourceCode) {
    if (!sourceCode) return [];
    const tokens = sourceCode.match(/[A-Za-z0-9_]+/g) || [];
    return tokens.map(t => t.toLowerCase());
  }

  _nodeRange(node) {
    return {
      startLine: node.startPosition.row + 1,
      startColumn: node.startPosition.column,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column
    };
  }

  _nodeText(node, sourceCode) {
    return sourceCode.substring(node.startIndex, node.endIndex);
  }

  /**
   * Extract top-level file imports/dependencies
   * @param {object} tree 
   * @param {string} sourceCode 
   * @returns {Array<string>}
   */
  extractImports(tree, sourceCode) {
    return [];
  }

  /**
   * Extract leading comment/docstring block above an AST node
   * @param {object} node 
   * @param {string} sourceCode 
   * @returns {string}
   */
  _extractLeadingComment(node, sourceCode) {
    if (!node || !sourceCode) return '';
    const startLine = node.startPosition.row;
    if (startLine === 0) return '';

    const lines = sourceCode.split('\n');
    const commentLines = [];
    let currentLineIdx = startLine - 1;

    // Scan backwards from the line preceding the symbol
    while (currentLineIdx >= 0) {
      const line = lines[currentLineIdx].trim();
      if (!line) {
        // Stop on empty line if we already collected some comments or if blank line separates
        if (commentLines.length > 0) break;
        currentLineIdx--;
        // Only skip at most 1 empty line
        if (currentLineIdx >= 0 && !lines[currentLineIdx].trim()) break;
        continue;
      }

      if (line.startsWith('//') || line.startsWith('#') || line.startsWith('*') || line.startsWith('/*') || line.endsWith('*/')) {
        commentLines.unshift(line);
        currentLineIdx--;
      } else {
        break;
      }
    }

    return commentLines.join('\n').trim();
  }
}

module.exports = LanguageAdapter;
