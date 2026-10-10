const fs = require('fs');
const path = require('path');

const CACHE_SYSTEM_VERSION = {
  parser: '1.0.0',
  matcher: '1.0.0'
};

class HistoryCache {
  constructor(cacheDir) {
    this.cacheDir = cacheDir;
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
    this.symbolsDir = path.join(this.cacheDir, 'symbols');
    if (!fs.existsSync(this.symbolsDir)) {
      fs.mkdirSync(this.symbolsDir, { recursive: true });
    }
  }

  _getSymbolCacheKey(commitHash, filePath) {
    const safePath = filePath.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${commitHash}_${safePath}.json`;
  }

  /**
   * Get cached symbols for a specific file at a specific commit
   */
  async getSymbols(commitHash, filePath) {
    const filename = this._getSymbolCacheKey(commitHash, filePath);
    const targetFile = path.join(this.symbolsDir, filename);

    if (!fs.existsSync(targetFile)) return null;

    try {
      const raw = await fs.promises.readFile(targetFile, 'utf8');
      const data = JSON.parse(raw);

      // Validate cache metadata
      if (data.parserVersion !== CACHE_SYSTEM_VERSION.parser) {
        return null; // Stale parser version
      }
      return data.symbols;
    } catch (err) {
      // Corrupted file: remove it
      try {
        await fs.promises.unlink(targetFile);
      } catch (e) {}
      return null;
    }
  }

  /**
   * Put extracted symbols into cache
   */
  async putSymbols(commitHash, filePath, symbols) {
    const filename = this._getSymbolCacheKey(commitHash, filePath);
    const targetFile = path.join(this.symbolsDir, filename);
    const tempFile = `${targetFile}.${Date.now()}.tmp`;

    const payload = {
      commitHash,
      filePath,
      parserVersion: CACHE_SYSTEM_VERSION.parser,
      cachedAt: new Date().toISOString(),
      symbols
    };

    try {
      await fs.promises.writeFile(tempFile, JSON.stringify(payload), 'utf8');
      await fs.promises.rename(tempFile, targetFile);
    } catch (err) {
      // Fallback cleanup
      try {
        if (fs.existsSync(tempFile)) await fs.promises.unlink(tempFile);
      } catch (e) {}
    }
  }

  /**
   * Invalidate all or specific commit cache
   */
  async invalidate(commitHash = null) {
    if (!commitHash) {
      // Clear entire symbols directory
      const files = await fs.promises.readdir(this.symbolsDir);
      for (const file of files) {
        await fs.promises.unlink(path.join(this.symbolsDir, file));
      }
      return;
    }

    const files = await fs.promises.readdir(this.symbolsDir);
    for (const file of files) {
      if (file.startsWith(commitHash)) {
        await fs.promises.unlink(path.join(this.symbolsDir, file));
      }
    }
  }
}

module.exports = {
  HistoryCache,
  CACHE_SYSTEM_VERSION
};
