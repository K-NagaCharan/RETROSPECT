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
    try {
      const symbols = adapter.extractSymbols(sourceCode, tree, filePath || '');
      const imports = typeof adapter.extractImports === 'function' ? adapter.extractImports(tree, sourceCode) : [];

      return {
        language: adapter.getLanguageId(),
        filePath: filePath || '',
        symbols,
        imports,
        hasSyntaxError: tree.rootNode.hasError()
      };
    } finally {
      // Trees live in WASM linear memory and are not garbage-collected; without delete() the WASM heap fills
      // and the runtime aborts (ExitStatus exit(1)), after which every parse in the process fails.
      // Extracted symbols hold only copied strings, never live tree nodes.
      if (tree && typeof tree.delete === 'function') tree.delete();
    }
  }
}

module.exports = FunctionExtractor;
