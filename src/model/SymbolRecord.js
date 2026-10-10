const crypto = require('crypto');

class SymbolRecord {
  constructor(data = {}) {
    this.name = data.name || '';
    this.qualifiedName = data.qualifiedName || this.name;
    this.enclosingScope = Array.isArray(data.enclosingScope) ? data.enclosingScope : [];
    this.parameters = Array.isArray(data.parameters) ? data.parameters : [];
    this.normalizedSignature = data.normalizedSignature || this._buildNormalizedSignature();
    this.returnType = data.returnType || null;
    this.range = data.range || { startLine: 1, startColumn: 0, endLine: 1, endColumn: 0 };
    this.source = data.source || '';
    this.sourceHash = data.sourceHash || this._computeHash(this.source);
    this.language = data.language || 'unknown';
    this.filePath = data.filePath || '';
    this.symbolType = data.symbolType || 'function'; // 'function', 'method', 'constructor', 'arrow_function'
    this.modifiers = Array.isArray(data.modifiers) ? data.modifiers : [];
    this.decorators = Array.isArray(data.decorators) ? data.decorators : [];
    this.normalizedTokens = Array.isArray(data.normalizedTokens) ? data.normalizedTokens : this._computeNormalizedTokens();
    this.astSummary = data.astSummary || {};
    this.metadata = data.metadata || {};
    this.extractionStatus = data.extractionStatus || 'success'; // 'success', 'syntax_error', 'partial'
    
    this.id = data.id || this._generateId();
  }

  _computeHash(content) {
    return crypto.createHash('sha256').update(content || '').digest('hex');
  }

  _buildNormalizedSignature() {
    const paramNames = this.parameters.map(p => {
      if (typeof p === 'string') return p;
      return p.name || '';
    }).filter(Boolean);
    return `${this.name}(${paramNames.join(', ')})`;
  }

  _generateId() {
    const scopeStr = this.enclosingScope.length > 0 ? this.enclosingScope.join('.') + '.' : '';
    const startLine = this.range ? this.range.startLine : 0;
    return `${this.filePath}::${scopeStr}${this.name}::${startLine}`;
  }

  _computeNormalizedTokens() {
    if (!this.source) return [];
    // Extract alphanumeric identifiers, lowercase them, ignore small noise tokens
    const tokens = this.source.match(/[A-Za-z0-9_]+/g) || [];
    return tokens.map(t => t.toLowerCase());
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      qualifiedName: this.qualifiedName,
      enclosingScope: this.enclosingScope,
      parameters: this.parameters,
      normalizedSignature: this.normalizedSignature,
      returnType: this.returnType,
      range: this.range,
      source: this.source,
      sourceHash: this.sourceHash,
      language: this.language,
      filePath: this.filePath,
      symbolType: this.symbolType,
      modifiers: this.modifiers,
      decorators: this.decorators,
      normalizedTokens: this.normalizedTokens,
      astSummary: this.astSummary,
      metadata: this.metadata,
      extractionStatus: this.extractionStatus
    };
  }

  static fromJSON(json) {
    return new SymbolRecord(json);
  }
}

module.exports = SymbolRecord;
