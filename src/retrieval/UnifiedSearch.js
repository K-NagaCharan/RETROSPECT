const path = require('path');
const { indexRepository } = require('../structural/index');
const { StructuralRetriever } = require('../structural/retrieval/StructuralRetriever');
const QueryProcessor = require('../structural/query/QueryProcessor');
const HistoricalRetrievalAdapter = require('./HistoricalRetrievalAdapter');
const GitHistoryReader = require('../git/GitHistoryReader');

// In-memory cache for historical profiles: repoPath:headCommit -> { headCommit, profileMap, timestamp }
const _historyCache = new Map();

class UnifiedSearch {
  constructor(options = {}) {
    this.gitReader = options.gitReader || new GitHistoryReader();
    this.histAdapter = options.histAdapter || new HistoricalRetrievalAdapter(options.historicalAdapterOptions || {});
    this.defaultStrategy = options.strategy || 'linear';
    this.defaultLimit = options.limit !== undefined ? options.limit : 10;
  }

  /**
   * Main unified search entry point.
   * Combines structural current-code indexing with Git history lineage tracking and score fusion.
   *
   * @param {string} repoPath Local repository filesystem path
   * @param {string} rawQuery Natural-language or identifier query
   * @param {object} [options] Search settings
   * @param {string} [options.strategy='linear'] Fusion strategy: 'linear', 'adaptive', 'rrf', 'residual'
   * @param {number} [options.limit=10] Maximum results to return (0 or null for all candidates)
   * @param {number} [options.maxCommits=50] Depth of Git history traversal
   * @param {boolean} [options.forceReindex=false] Force rebuild of structural and historical indices
   * @param {object} [options.ablationConfig={}] Historical ablation flags: { namesOnly, commitMessagesOnly, diffTermsOnly }
   * @returns {Promise<object>} Unified search response with ranked symbols and lineage evidence
   */
  async search(repoPath, rawQuery, options = {}) {
    const startTime = Date.now();
    const resolvedPath = path.resolve(repoPath);

    // 1. Process query
    const query = typeof rawQuery === 'string' ? QueryProcessor.process(rawQuery) : rawQuery;
    const strategy = options.strategy || this.defaultStrategy;

    if (!query || query.isEmpty) {
      return {
        query: rawQuery,
        processedQuery: query,
        strategy,
        totalCandidates: 0,
        returnedCount: 0,
        results: [],
        timingMs: { total: Date.now() - startTime }
      };
    }

    // 2. Resolve current HEAD commit
    let headCommit = 'HEAD';
    try {
      headCommit = await this.gitReader.resolveCommit(resolvedPath, 'HEAD');
    } catch (err) {
      headCommit = 'HEAD';
    }

    // 3. Build or load structural index
    const structStart = Date.now();
    const structuralIndex = await indexRepository(resolvedPath, {
      forceRebuild: options.forceReindex === true
    });
    const allSymbols = Array.from(structuralIndex.symbols.values());
    const structTimeMs = Date.now() - structStart;

    // 4. Build or load historical profiles for all symbols at HEAD
    const histStart = Date.now();
    const cacheKey = `${resolvedPath}::${headCommit}`;
    let profileMap;

    if (!options.forceReindex && _historyCache.has(cacheKey)) {
      profileMap = _historyCache.get(cacheKey).profileMap;
    } else {
      const historyResult = await this.histAdapter.indexRepositoryHistory(resolvedPath, allSymbols, {
        maxCommits: options.maxCommits || 50,
        startCommit: headCommit
      });
      profileMap = historyResult.profileMap;
      _historyCache.set(cacheKey, { headCommit, profileMap, timestamp: Date.now() });
    }
    const histTimeMs = Date.now() - histStart;

    // 5. Construct complete candidate pool maintaining candidate parity
    const candidates = allSymbols.map(sym => ({
      symbol: sym,
      historyProfile: profileMap.get(sym.id) || null
    }));

    // 6. Structural retrieval scoring
    const retriever = new StructuralRetriever(structuralIndex, options.structuralOptions || {});
    const structRanked = retriever.rankCandidates(query, allSymbols);
    structRanked.sort((a, b) => b.score - a.score || (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name));
    const sMap = new Map();
    const sRankMap = new Map();
    structRanked.forEach((r, idx) => {
      sMap.set(r.symbol.id, {
        score: r.score,
        breakdown: r.breakdown,
        reasons: r.matchReasons
      });
      sRankMap.set(r.symbol.id, idx + 1);
    });

    // 7. Historical retrieval scoring
    const histRanked = this.histAdapter.rankHistoricalOnly(
      query,
      candidates,
      options.ablationConfig || {},
      { enforceCandidateParity: true }
    );
    const hMap = new Map();
    const hRankMap = new Map();
    histRanked.forEach((r, idx) => {
      hMap.set(r.symbol.id, {
        score: r.score,
        breakdown: r.breakdown,
        reasons: r.reasons,
        historyProfile: r.historyProfile
      });
      hRankMap.set(r.symbol.id, idx + 1);
    });

    // 8. Fusion across full candidate pool using explicitly selected strategy
    const fused = candidates.map(c => {
      const sData = sMap.get(c.symbol.id) || { score: 0, breakdown: {}, reasons: [] };
      const hData = hMap.get(c.symbol.id) || { score: 0, breakdown: {}, reasons: [] };
      const sScore = sData.score;
      const hScore = hData.score;
      const sRank = sRankMap.get(c.symbol.id) || candidates.length;
      const hRank = hRankMap.get(c.symbol.id) || candidates.length;

      let fusedScore = 0.0;
      switch (strategy) {
        case 'adaptive':
          fusedScore = HistoricalRetrievalAdapter.adaptiveFuseScores(sScore, hScore, { boost: 0.25 });
          break;
        case 'rrf': {
          const k = 60;
          fusedScore = (0.60 / (k + sRank)) + (0.40 / (k + hRank));
          break;
        }
        case 'residual':
          fusedScore = parseFloat((sScore + 0.35 * hScore * (1.0 - sScore)).toFixed(4));
          break;
        case 'linear':
        default:
          fusedScore = HistoricalRetrievalAdapter.fuseScores(sScore, hScore, { structural: 0.60, historical: 0.40 });
          break;
      }

      const profile = c.historyProfile || {};
      return {
        symbol: {
          id: c.symbol.id,
          name: c.symbol.name,
          qualifiedName: c.symbol.qualifiedName || c.symbol.name,
          filePath: c.symbol.filePath,
          range: c.symbol.range,
          symbolType: c.symbol.symbolType,
          normalizedSignature: c.symbol.normalizedSignature,
          docstring: c.symbol.docstring || '',
          source: c.symbol.source || ''
        },
        score: fusedScore,
        structuralScore: sScore,
        historicalScore: hScore,
        structuralReasons: sData.reasons || [],
        lineageEvidence: {
          historicalNames: profile.historicalNames || [],
          historicalQualifiedNames: profile.historicalQualifiedNames || [],
          commitMessage: profile.commitMessage || '',
          evolutionType: profile.evolutionType || 'unchanged',
          confidence: profile.confidence || 'certain',
          historyDepth: profile.historyDepth || 0,
          reasons: hData.reasons || []
        }
      };
    });

    // 9. Deterministic tie-breaking
    fused.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name);
    });

    // 10. Assign 1-indexed ranks and apply limit
    fused.forEach((item, idx) => {
      item.rank = idx + 1;
    });

    const limit = options.limit !== undefined ? options.limit : this.defaultLimit;
    const results = (limit && limit > 0) ? fused.slice(0, limit) : fused;

    return {
      query: rawQuery,
      processedQuery: {
        terms: query.terms,
        stemmedTerms: query.stemmedTerms,
        exactCandidateNames: query.exactCandidateNames,
        targetKind: query.targetKind
      },
      strategy,
      totalCandidates: candidates.length,
      returnedCount: results.length,
      results,
      timingMs: {
        total: Date.now() - startTime,
        structuralIndex: structTimeMs,
        historyIndex: histTimeMs
      }
    };
  }
}

// Default singleton instance
const _defaultSearcher = new UnifiedSearch();

/**
 * Top-level unified search function.
 * @param {string} repoPath 
 * @param {string} query 
 * @param {object} [options] 
 * @returns {Promise<object>}
 */
async function search(repoPath, query, options = {}) {
  return _defaultSearcher.search(repoPath, query, options);
}

function clearHistoryCache() {
  _historyCache.clear();
}

module.exports = {
  UnifiedSearch,
  search,
  searchRepository: search,
  clearHistoryCache
};
