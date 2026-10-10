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
    const parser = await TreeSitterManager.createParser(this.languageId);
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
}

module.exports = LanguageAdapter;
