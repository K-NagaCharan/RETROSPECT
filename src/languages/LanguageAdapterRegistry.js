const PythonAdapter = require('./PythonAdapter');
const JavaScriptAdapter = require('./JavaScriptAdapter');
const TypeScriptAdapter = require('./TypeScriptAdapter');
const JavaAdapter = require('./JavaAdapter');

class LanguageAdapterRegistry {
  constructor() {
    this._adapters = new Map(); // langId -> adapter instance
    this._extensionMap = new Map(); // ext -> adapter instance

    // Register built-in default adapters
    this.register(new PythonAdapter());
    this.register(new JavaScriptAdapter());
    this.register(new TypeScriptAdapter());
    this.register(new JavaAdapter());
  }

  register(adapter) {
    if (!adapter || !adapter.getLanguageId) {
      throw new Error('Invalid adapter instance provided to register');
    }
    const langId = adapter.getLanguageId().toLowerCase();
    this._adapters.set(langId, adapter);

    const extensions = adapter.getFileExtensions() || [];
    for (const ext of extensions) {
      this._extensionMap.set(ext.toLowerCase(), adapter);
    }
  }

  getAdapter(languageId) {
    if (!languageId) return null;
    return this._adapters.get(languageId.toLowerCase()) || null;
  }

  getAdapterForFile(filePath) {
    if (!filePath) return null;
    const lower = filePath.toLowerCase();
    for (const [ext, adapter] of this._extensionMap.entries()) {
      if (lower.endsWith(ext)) {
        return adapter;
      }
    }
    return null;
  }

  getSupportedLanguages() {
    return Array.from(this._adapters.keys());
  }

  isSupportedFile(filePath) {
    return this.getAdapterForFile(filePath) !== null;
  }
}

// Singleton instance
const defaultRegistry = new LanguageAdapterRegistry();

module.exports = {
  LanguageAdapterRegistry,
  defaultRegistry
};
