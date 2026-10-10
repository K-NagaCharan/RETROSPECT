const HistoryTracker = require('../tracker/HistoryTracker');
const GitHistoryReader = require('../git/GitHistoryReader');
const { HistoryCache } = require('../storage/HistoryCache');
const HistoryStore = require('../storage/HistoryStore');
const path = require('path');
const os = require('os');

class HistoricalRetriever {
  constructor(options = {}) {
    this.gitReader = options.gitReader || new GitHistoryReader(options.gitOptions);
    this.storageDir = options.storageDir || path.join(os.tmpdir(), 'retrospect-storage');
    this.cacheDir = options.cacheDir || path.join(os.tmpdir(), 'retrospect-cache');
    
    this.store = options.store || new HistoryStore(this.storageDir);
    this.cache = options.cache || new HistoryCache(this.cacheDir);

    this.tracker = new HistoryTracker({
      gitReader: this.gitReader,
      cache: this.cache,
      matcherConfig: options.matcherConfig
    });
  }

  /**
   * Main retrieval method
   * @param {object} params
   * @param {string} params.repoPath Path to local git repository
   * @param {string} [params.targetCommit='HEAD'] Target commit hash or ref
   * @param {Array<object>} params.symbolQueries Array of queries e.g. [{ filePath: 'src/app.py', name: 'process' }]
   * @param {number} [params.historyDepth=10] Traversal budget
   * @param {boolean} [params.includeDiffs=true] Whether to include git diffs for modified commits
   */
  async retrieve(params) {
    const {
      repoPath,
      targetCommit = 'HEAD',
      symbolQueries = [],
      historyDepth = 10,
      includeDiffs = true
    } = params;

    if (!repoPath) {
      throw new Error('HistoricalRetriever: repoPath is required');
    }

    if (!Array.isArray(symbolQueries) || symbolQueries.length === 0) {
      throw new Error('HistoricalRetriever: symbolQueries must be a non-empty array');
    }

    const startTime = Date.now();
    const resolvedCommit = await this.gitReader.resolveCommit(repoPath, targetCommit);

    // Track history
    const { graph, results } = await this.tracker.trackHistory(
      repoPath,
      resolvedCommit,
      symbolQueries,
      { maxDepth: historyDepth }
    );

    // Persist to store
    await this.store.saveGraph(path.basename(repoPath), resolvedCommit, graph);

    // Format structured evidence for each requested symbol
    const evidenceList = [];

    for (const res of results) {
      if (res.error) {
        evidenceList.push({
          query: res.query,
          found: false,
          error: res.error,
          history: []
        });
        continue;
      }

      const formattedHistory = [];
      for (let i = 0; i < res.versions.length; i++) {
        const item = res.versions[i];
        const nextItem = res.versions[i + 1];

        let diffText = '';
        if (includeDiffs && item.edge && item.edge.childCommit && item.edge.parentCommit) {
          try {
            diffText = await this.gitReader.getFileDiff(
              repoPath,
              item.edge.childCommit,
              item.edge.parentCommit,
              item.symbol.filePath
            );
          } catch (e) {
            diffText = '';
          }
        }

        formattedHistory.push({
          versionId: item.node ? item.node.versionId : null,
          commitHash: item.commit.hash,
          author: item.commit.author,
          timestamp: item.commit.author ? item.commit.author.date : null,
          commitMessage: item.commit.message,
          filePath: item.symbol.filePath,
          symbolName: item.symbol.name,
          qualifiedName: item.symbol.qualifiedName,
          normalizedSignature: item.symbol.normalizedSignature,
          range: item.symbol.range,
          sourceSnippet: item.symbol.source,
          changeClassification: item.edge ? item.edge.changeClassification : 'current',
          matchingScore: item.edge ? item.edge.matchingScore : 1.0,
          matchingMethod: item.edge ? item.edge.matchingMethod : 'initial',
          evidence: item.edge ? item.edge.evidence : null,
          confidence: item.edge ? item.edge.confidence : 'certain',
          diff: diffText
        });
      }

      evidenceList.push({
        query: res.query,
        found: true,
        currentSymbol: formattedHistory[0],
        historicalDepth: formattedHistory.length - 1,
        isUncertain: formattedHistory.some(h => h.confidence === 'uncertain'),
        history: formattedHistory
      });
    }

    const durationMs = Date.now() - startTime;

    return {
      retrievalMetadata: {
        repoPath: path.resolve(repoPath),
        targetCommit: resolvedCommit,
        depthRequested: historyDepth,
        symbolCount: symbolQueries.length,
        executionTimeMs: durationMs,
        graphSummary: {
          nodes: graph.nodes.size,
          edges: graph.edges.length
        }
      },
      symbols: evidenceList
    };
  }
}

module.exports = HistoricalRetriever;
