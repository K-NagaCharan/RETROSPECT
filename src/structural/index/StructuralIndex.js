const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const SymbolRecord = require('../../model/SymbolRecord');
const FunctionExtractor = require('../../parser/FunctionExtractor');
const RepoDiscoverer = require('../discovery/RepoDiscoverer');
const QueryProcessor = require('../query/QueryProcessor');

const SCHEMA_VERSION = '1.0.0';

class StructuralIndex {
  constructor(options = {}) {
    this.schemaVersion = SCHEMA_VERSION;
    this.repoPath = options.repoPath || '';
    this.createdAt = options.createdAt || new Date().toISOString();
    this.updatedAt = options.updatedAt || new Date().toISOString();

    // Primary symbol table: symbolId -> SymbolRecord
    this.symbols = new Map();

    // File table: relativePath -> { filePath, relativePath, mtimeMs, size, hash, language, symbolIds, imports }
    this.files = new Map();

    // Call graph: callerId -> Set of called names; and reverse: calledName -> Set of callerIds
    this.callGraph = {
      forward: new Map(), // symbolId -> Set<calledName>
      reverse: new Map()  // calledName -> Set<symbolId>
    };

    // Inverted token index: term -> Set<symbolId>
    this.invertedIndex = new Map();

    // Exact name index: lowerName -> Set<symbolId>
    this.exactNameIndex = new Map();

    this.extractor = options.extractor || new FunctionExtractor();
    this.discoverer = options.discoverer || new RepoDiscoverer(options.discoveryOptions);
  }

  /**
   * Build the complete structural index for a repository.
   * @param {string} repoPath 
   * @param {object} [options]
   * @returns {Promise<StructuralIndex>}
   */
  async build(repoPath, options = {}) {
    const startTime = Date.now();
    this.repoPath = path.resolve(repoPath);
    this.updatedAt = new Date().toISOString();

    // Clear existing data
    this.symbols.clear();
    this.files.clear();
    this.callGraph.forward.clear();
    this.callGraph.reverse.clear();
    this.invertedIndex.clear();
    this.exactNameIndex.clear();

    const { files, stats } = await this.discoverer.discover(this.repoPath);

    for (const fileInfo of files) {
      await this._indexFile(fileInfo);
    }

    this.indexingTimeMs = Date.now() - startTime;
    this.stats = {
      ...stats,
      totalSymbolsIndexed: this.symbols.size,
      totalFilesIndexed: this.files.size,
      indexingTimeMs: this.indexingTimeMs
    };

    return this;
  }

  /**
   * Incremental index update: inspect repository, re-index modified/added files, purge deleted files.
   * @param {string} [repoPath]
   * @returns {Promise<object>} Update statistics
   */
  async updateIncremental(repoPath = this.repoPath) {
    const startTime = Date.now();
    const resolvedPath = path.resolve(repoPath || this.repoPath);
    this.repoPath = resolvedPath;

    const { files: currentFiles } = await this.discoverer.discover(resolvedPath);

    const currentRelPathMap = new Map();
    for (const f of currentFiles) {
      currentRelPathMap.set(f.relativePath, f);
    }

    const modified = [];
    const added = [];
    const deleted = [];

    // Find modified and added files
    for (const [relPath, fileInfo] of currentRelPathMap.entries()) {
      if (!this.files.has(relPath)) {
        added.push(fileInfo);
      } else {
        const existing = this.files.get(relPath);
        if (existing.mtimeMs !== fileInfo.mtimeMs || existing.size !== fileInfo.size) {
          modified.push(fileInfo);
        }
      }
    }

    // Find deleted files
    for (const relPath of this.files.keys()) {
      if (!currentRelPathMap.has(relPath)) {
        deleted.push(relPath);
      }
    }

    // Process deleted
    for (const relPath of deleted) {
      this._removeFile(relPath);
    }

    // Process modified
    for (const fileInfo of modified) {
      this._removeFile(fileInfo.relativePath);
      await this._indexFile(fileInfo);
    }

    // Process added
    for (const fileInfo of added) {
      await this._indexFile(fileInfo);
    }

    this.updatedAt = new Date().toISOString();
    const updateTimeMs = Date.now() - startTime;

    return {
      addedCount: added.length,
      modifiedCount: modified.length,
      deletedCount: deleted.length,
      totalSymbols: this.symbols.size,
      totalFiles: this.files.size,
      updateTimeMs
    };
  }

  async _indexFile(fileInfo) {
    let sourceCode;
    try {
      sourceCode = fs.readFileSync(fileInfo.filePath, 'utf-8');
    } catch (err) {
      return;
    }

    const fileHash = crypto.createHash('sha256').update(sourceCode).digest('hex');

    let extractionResult;
    try {
      extractionResult = await this.extractor.extract(sourceCode, fileInfo.filePath, fileInfo.language);
    } catch (err) {
      return;
    }

    const symbolIds = new Set();
    const imports = extractionResult.imports || [];

    for (const symbol of extractionResult.symbols) {
      // Ensure file path is stored as relative to repo for portability
      const originalFilePath = symbol.filePath;
      const relPath = path.isAbsolute(originalFilePath) && originalFilePath.startsWith(this.repoPath)
        ? path.relative(this.repoPath, originalFilePath).replace(/\\/g, '/')
        : fileInfo.relativePath;

      symbol.filePath = relPath;
      symbol.dependencies = imports;

      this.symbols.set(symbol.id, symbol);
      symbolIds.add(symbol.id);

      // Index exact name
      const lowerName = symbol.name.toLowerCase();
      if (!this.exactNameIndex.has(lowerName)) {
        this.exactNameIndex.set(lowerName, new Set());
      }
      this.exactNameIndex.get(lowerName).add(symbol.id);

      // Inverted index tokens from name, signature, docstring, and path
      this._indexSymbolTokens(symbol);

      // Build call graph edges
      if (Array.isArray(symbol.calls) && symbol.calls.length > 0) {
        if (!this.callGraph.forward.has(symbol.id)) {
          this.callGraph.forward.set(symbol.id, new Set());
        }
        for (const called of symbol.calls) {
          this.callGraph.forward.get(symbol.id).add(called);

          if (!this.callGraph.reverse.has(called)) {
            this.callGraph.reverse.set(called, new Set());
          }
          this.callGraph.reverse.get(called).add(symbol.id);
        }
      }
    }

    this.files.set(fileInfo.relativePath, {
      filePath: fileInfo.filePath,
      relativePath: fileInfo.relativePath,
      mtimeMs: fileInfo.mtimeMs,
      size: fileInfo.size,
      hash: fileHash,
      language: fileInfo.language,
      symbolIds,
      imports
    });
  }

  _removeFile(relativePath) {
    const fileEntry = this.files.get(relativePath);
    if (!fileEntry) return;

    for (const symbolId of fileEntry.symbolIds) {
      const symbol = this.symbols.get(symbolId);
      if (symbol) {
        // Remove from exact name index
        const lowerName = symbol.name.toLowerCase();
        if (this.exactNameIndex.has(lowerName)) {
          this.exactNameIndex.get(lowerName).delete(symbolId);
          if (this.exactNameIndex.get(lowerName).size === 0) {
            this.exactNameIndex.delete(lowerName);
          }
        }

        // Remove from inverted index
        this._removeSymbolTokens(symbol);

        // Remove from call graph forward & reverse
        if (this.callGraph.forward.has(symbolId)) {
          const calledNames = this.callGraph.forward.get(symbolId);
          for (const cName of calledNames) {
            if (this.callGraph.reverse.has(cName)) {
              this.callGraph.reverse.get(cName).delete(symbolId);
            }
          }
          this.callGraph.forward.delete(symbolId);
        }

        this.symbols.delete(symbolId);
      }
    }

    this.files.delete(relativePath);
  }

  _indexSymbolTokens(symbol) {
    const tokens = this._collectSymbolSearchTokens(symbol);
    for (const token of tokens) {
      if (!this.invertedIndex.has(token)) {
        this.invertedIndex.set(token, new Set());
      }
      this.invertedIndex.get(token).add(symbol.id);
    }
  }

  _removeSymbolTokens(symbol) {
    const tokens = this._collectSymbolSearchTokens(symbol);
    for (const token of tokens) {
      if (this.invertedIndex.has(token)) {
        this.invertedIndex.get(token).delete(symbol.id);
        if (this.invertedIndex.get(token).size === 0) {
          this.invertedIndex.delete(token);
        }
      }
    }
  }

  _collectSymbolSearchTokens(symbol) {
    const tokenSet = new Set();

    // Split name
    const nameSubtokens = QueryProcessor.splitIdentifiers(symbol.name);
    for (const st of nameSubtokens) {
      if (st.length > 1) {
        tokenSet.add(st.toLowerCase());
        tokenSet.add(QueryProcessor.stem(st.toLowerCase()));
      }
    }

    // Split qualified name
    if (symbol.qualifiedName && symbol.qualifiedName !== symbol.name) {
      const qSubtokens = QueryProcessor.splitIdentifiers(symbol.qualifiedName);
      for (const st of qSubtokens) {
        if (st.length > 1) {
          tokenSet.add(st.toLowerCase());
        }
      }
    }

    // Parameters
    if (Array.isArray(symbol.parameters)) {
      for (const p of symbol.parameters) {
        const pName = typeof p === 'string' ? p : p.name || '';
        const pType = typeof p === 'object' && p.type ? p.type : '';
        for (const st of QueryProcessor.splitIdentifiers(pName)) {
          if (st.length > 1) tokenSet.add(st.toLowerCase());
        }
        for (const st of QueryProcessor.splitIdentifiers(pType)) {
          if (st.length > 1) tokenSet.add(st.toLowerCase());
        }
      }
    }

    // Docstring tokens
    if (symbol.docstring) {
      const words = symbol.docstring.match(/[A-Za-z0-9_]+/g) || [];
      for (const w of words) {
        const lower = w.toLowerCase();
        if (lower.length > 2) {
          tokenSet.add(lower);
          tokenSet.add(QueryProcessor.stem(lower));
        }
      }
    }

    // File path tokens
    if (symbol.filePath) {
      const pathWords = symbol.filePath.replace(/\\/g, '/').split(/[/._-]+/);
      for (const pw of pathWords) {
        if (pw.length > 2) {
          tokenSet.add(pw.toLowerCase());
          tokenSet.add(QueryProcessor.stem(pw.toLowerCase()));
        }
      }
    }

    // Called function tokens
    if (Array.isArray(symbol.calls) && symbol.calls.length > 0) {
      for (const callName of symbol.calls) {
        for (const st of QueryProcessor.splitIdentifiers(callName)) {
          if (st.length > 2) {
            tokenSet.add(st.toLowerCase());
            tokenSet.add(QueryProcessor.stem(st.toLowerCase()));
          }
        }
      }
    }

    return Array.from(tokenSet);
  }

  /**
   * Look up a symbol by ID.
   * @param {string} symbolId 
   * @returns {SymbolRecord|null}
   */
  getSymbol(symbolId) {
    return this.symbols.get(symbolId) || null;
  }

  /**
   * Find symbols directly related to a symbol (callers, callees, enclosing class).
   * @param {string} symbolId 
   * @returns {object} { callers: Array<SymbolRecord>, callees: Array<SymbolRecord>, enclosingClass: SymbolRecord|null }
   */
  getRelatedSymbols(symbolId) {
    const symbol = this.getSymbol(symbolId);
    if (!symbol) return { callers: [], callees: [], enclosingClass: null };

    // Callees (functions called by this symbol)
    const callees = [];
    if (this.callGraph.forward.has(symbolId)) {
      const calledNames = this.callGraph.forward.get(symbolId);
      for (const cName of calledNames) {
        const lower = cName.toLowerCase();
        if (this.exactNameIndex.has(lower)) {
          for (const targetId of this.exactNameIndex.get(lower)) {
            const target = this.getSymbol(targetId);
            if (target && target.id !== symbolId && !callees.some(c => c.id === target.id)) {
              callees.push(target);
            }
          }
        }
      }
    }

    // Callers (functions that call this symbol)
    const callers = [];
    const lowerName = symbol.name.toLowerCase();
    if (this.callGraph.reverse.has(symbol.name) || this.callGraph.reverse.has(lowerName)) {
      const callerIds = new Set([
        ...(this.callGraph.reverse.get(symbol.name) || []),
        ...(this.callGraph.reverse.get(lowerName) || [])
      ]);
      for (const cId of callerIds) {
        const caller = this.getSymbol(cId);
        if (caller && caller.id !== symbolId && !callers.some(c => c.id === caller.id)) {
          callers.push(caller);
        }
      }
    }

    // Enclosing class if method
    let enclosingClass = null;
    if (symbol.enclosingScope && symbol.enclosingScope.length > 0) {
      const parentName = symbol.enclosingScope[symbol.enclosingScope.length - 1];
      const lowerParent = parentName.toLowerCase();
      if (this.exactNameIndex.has(lowerParent)) {
        for (const candId of this.exactNameIndex.get(lowerParent)) {
          const cand = this.getSymbol(candId);
          if (cand && (cand.symbolType === 'class' || cand.symbolType === 'interface') && cand.filePath === symbol.filePath) {
            enclosingClass = cand;
            break;
          }
        }
      }
    }

    return { callers, callees, enclosingClass };
  }

  /**
   * Serialize index to a JSON file.
   * @param {string} destPath 
   */
  save(destPath) {
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const payload = {
      schemaVersion: this.schemaVersion,
      repoPath: this.repoPath,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      stats: this.stats,
      symbols: Array.from(this.symbols.values()).map(s => s.toJSON()),
      files: Array.from(this.files.entries()).map(([k, v]) => ({
        relativePath: k,
        ...v,
        symbolIds: Array.from(v.symbolIds)
      }))
    };

    fs.writeFileSync(destPath, JSON.stringify(payload, null, 2), 'utf-8');
  }

  /**
   * Load a saved index from a JSON file.
   * @param {string} srcPath 
   * @returns {StructuralIndex}
   */
  static load(srcPath) {
    if (!fs.existsSync(srcPath)) {
      throw new Error(`StructuralIndex: file not found at '${srcPath}'`);
    }

    const raw = fs.readFileSync(srcPath, 'utf-8');
    const data = JSON.parse(raw);

    if (data.schemaVersion !== SCHEMA_VERSION) {
      throw new Error(`StructuralIndex: incompatible schema version '${data.schemaVersion}', expected '${SCHEMA_VERSION}'`);
    }

    const index = new StructuralIndex({
      repoPath: data.repoPath,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    });
    index.stats = data.stats || {};

    // Restore symbols
    for (const sJson of data.symbols || []) {
      const symbol = SymbolRecord.fromJSON(sJson);
      index.symbols.set(symbol.id, symbol);

      // Exact name
      const lower = symbol.name.toLowerCase();
      if (!index.exactNameIndex.has(lower)) {
        index.exactNameIndex.set(lower, new Set());
      }
      index.exactNameIndex.get(lower).add(symbol.id);

      // Inverted index
      index._indexSymbolTokens(symbol);

      // Call graph
      if (Array.isArray(symbol.calls) && symbol.calls.length > 0) {
        if (!index.callGraph.forward.has(symbol.id)) {
          index.callGraph.forward.set(symbol.id, new Set());
        }
        for (const called of symbol.calls) {
          index.callGraph.forward.get(symbol.id).add(called);
          if (!index.callGraph.reverse.has(called)) {
            index.callGraph.reverse.set(called, new Set());
          }
          index.callGraph.reverse.get(called).add(symbol.id);
        }
      }
    }

    // Restore files
    for (const f of data.files || []) {
      index.files.set(f.relativePath, {
        ...f,
        symbolIds: new Set(f.symbolIds || [])
      });
    }

    return index;
  }
}

module.exports = {
  StructuralIndex,
  SCHEMA_VERSION
};
