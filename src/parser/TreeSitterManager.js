const path = require('path');
const fs = require('fs');
const Parser = require('web-tree-sitter');

class TreeSitterManager {
  constructor() {
    this._initialized = false;
    this._initPromise = null;
    this._languages = new Map(); // langName -> Language object
    this._parsers = new Map(); // langName -> Promise<Parser> (shared, reused)
    this._wasmsDir = path.resolve(__dirname, '../../node_modules/tree-sitter-wasms/out');
  }

  async initialize() {
    if (this._initialized) return;
    if (this._initPromise) return this._initPromise;

    this._initPromise = (async () => {
      await Parser.init();
      this._initialized = true;
    })();

    return this._initPromise;
  }

  async getLanguage(langName) {
    await this.initialize();

    const normalizedLang = langName.toLowerCase();
    if (this._languages.has(normalizedLang)) {
      return this._languages.get(normalizedLang);
    }

    const wasmFileName = `tree-sitter-${normalizedLang}.wasm`;
    const wasmPath = path.join(this._wasmsDir, wasmFileName);

    if (!fs.existsSync(wasmPath)) {
      throw new Error(`Tree-sitter WASM grammar not found for language '${langName}' at ${wasmPath}`);
    }

    const language = await Parser.Language.load(wasmPath);
    this._languages.set(normalizedLang, language);
    return language;
  }

  async createParser(langName) {
    const language = await this.getLanguage(langName);
    const parser = new Parser();
    parser.setLanguage(language);
    return parser;
  }

  /**
   * Shared parser for a language, created lazily on first use and cached. Callers must not delete it.
   * Parsing is synchronous, so concurrent async callers cannot interleave inside one parse.
   */
  async getParser(langName) {
    const key = langName.toLowerCase();
    if (!this._parsers.has(key)) {
      this._parsers.set(key, this.createParser(langName));
    }
    return this._parsers.get(key);
  }
}

// Singleton instance
const instance = new TreeSitterManager();

module.exports = instance;
