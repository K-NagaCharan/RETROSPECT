const path = require('path');
const { StructuralIndex, SCHEMA_VERSION } = require('./index/StructuralIndex');
const { StructuralRetriever, DEFAULT_WEIGHTS } = require('./retrieval/StructuralRetriever');
const RepoDiscoverer = require('./discovery/RepoDiscoverer');
const QueryProcessor = require('./query/QueryProcessor');
const ContextBuilder = require('./context/ContextBuilder');

// In-memory cache of built indexes: repoPath -> StructuralIndex
const _indexCache = new Map();

/**
 * Build or update the structural index for a repository.
 * @param {string} repoPath 
 * @param {object} [options]
 * @returns {Promise<StructuralIndex>}
 */
async function indexRepository(repoPath, options = {}) {
  const resolved = path.resolve(repoPath);
  const forceRebuild = options.forceRebuild === true;

  if (!forceRebuild && _indexCache.has(resolved)) {
    const cached = _indexCache.get(resolved);
    if (options.incremental !== false) {
      await cached.updateIncremental(resolved);
    }
    return cached;
  }

  const index = new StructuralIndex(options);
  await index.build(resolved, options);
  _indexCache.set(resolved, index);

  if (options.persistPath) {
    index.save(options.persistPath);
  }

  return index;
}

/**
 * Search current codebase using natural-language or identifier queries.
 * @param {string} repoPath 
 * @param {string} query 
 * @param {object} [options]
 * @returns {Promise<object>} Search results
 */
async function searchCurrentCode(repoPath, query, options = {}) {
  const resolved = path.resolve(repoPath);
  let index = _indexCache.get(resolved);

  if (!index) {
    index = await indexRepository(resolved, options);
  }

  const retriever = new StructuralRetriever(index, options);
  return retriever.search(query, options);
}

/**
 * Get symbol by its ID from the indexed repository.
 * @param {string} repoPath 
 * @param {string} symbolId 
 * @returns {Promise<object|null>}
 */
async function getSymbol(repoPath, symbolId) {
  const resolved = path.resolve(repoPath);
  let index = _indexCache.get(resolved);
  if (!index) {
    index = await indexRepository(resolved);
  }
  return index.getSymbol(symbolId);
}

/**
 * Get symbols directly related to a symbol (calls, callers, enclosing class).
 * @param {string} repoPath 
 * @param {string} symbolId 
 * @param {object} [options]
 * @returns {Promise<object>}
 */
async function getRelatedSymbols(repoPath, symbolId, options = {}) {
  const resolved = path.resolve(repoPath);
  let index = _indexCache.get(resolved);
  if (!index) {
    index = await indexRepository(resolved);
  }
  return index.getRelatedSymbols(symbolId);
}

function clearIndexCache() {
  _indexCache.clear();
}

module.exports = {
  // Primary integration APIs
  indexRepository,
  searchCurrentCode,
  getSymbol,
  getRelatedSymbols,
  clearIndexCache,

  // Core classes
  StructuralIndex,
  StructuralRetriever,
  RepoDiscoverer,
  QueryProcessor,
  ContextBuilder,

  // Constants
  SCHEMA_VERSION,
  DEFAULT_WEIGHTS
};
