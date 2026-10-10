const { defaultRegistry } = require('../languages/LanguageAdapterRegistry');

class FunctionExtractor {
  constructor(registry = defaultRegistry) {
    this.registry = registry;
  }

  async extract(sourceCode, filePath, languageId = null) {
    if (typeof sourceCode !== 'string') {
      throw new Error(`FunctionExtractor: sourceCode must be a string, got ${typeof sourceCode}`);
    }

    let adapter = null;
    if (languageId) {
      adapter = this.registry.getAdapter(languageId);
    }
    if (!adapter && filePath) {
      adapter = this.registry.getAdapterForFile(filePath);
    }

    if (!adapter) {
      throw new Error(`FunctionExtractor: No supported language adapter found for file '${filePath || ''}' (languageId: '${languageId || ''}')`);
    }

    const tree = await adapter.parse(sourceCode);
    const symbols = adapter.extractSymbols(sourceCode, tree, filePath || '');

    return {
      language: adapter.getLanguageId(),
      filePath: filePath || '',
      symbols,
      hasSyntaxError: tree.rootNode.hasError()
    };
  }
}

module.exports = FunctionExtractor;
