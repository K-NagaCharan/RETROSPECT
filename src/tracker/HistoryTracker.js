const GitHistoryReader = require('../git/GitHistoryReader');
const FunctionExtractor = require('../parser/FunctionExtractor');
const FunctionMatcher = require('../matcher/FunctionMatcher');
const { HistoryGraph } = require('../model/HistoryGraph');
const { HistoryCache } = require('../storage/HistoryCache');
const SymbolRecord = require('../model/SymbolRecord');
const path = require('path');
const os = require('os');

class HistoryTracker {
  constructor(options = {}) {
    this.gitReader = options.gitReader || new GitHistoryReader();
    this.extractor = options.extractor || new FunctionExtractor();
    this.matcher = options.matcher || new FunctionMatcher(options.matcherConfig || {});
    this.cache = options.cache || null;
  }

  /**
   * Track historical evolution for requested symbols
   * @param {string} repoPath 
   * @param {string} targetCommit 
   * @param {Array<object>} symbolQueries e.g. [{ filePath, name }]
   * @param {object} options { maxDepth, firstParentOnly }
   */
  async trackHistory(repoPath, targetCommit = 'HEAD', symbolQueries = [], options = {}) {
    const maxDepth = options.maxDepth || 20;
    const firstParentOnly = options.firstParentOnly ?? true;

    const resolvedCommit = await this.gitReader.resolveCommit(repoPath, targetCommit);
    const commits = await this.gitReader.getCommitHistory(repoPath, resolvedCommit, maxDepth + 1, firstParentOnly);

    if (commits.length === 0) {
      throw new Error(`No commits found starting from ${targetCommit} in ${repoPath}`);
    }

    const graph = new HistoryGraph({
      repository: path.resolve(repoPath),
      targetCommit: resolvedCommit
    });

    const results = [];

    for (const query of symbolQueries) {
      const trackingResult = await this._trackSingleSymbol(repoPath, commits, query, graph, maxDepth);
      results.push(trackingResult);
    }

    return {
      graph,
      results,
      targetCommit: resolvedCommit
    };
  }

  async _trackSingleSymbol(repoPath, commits, query, graph, maxDepth) {
    let currentFilePath = (query.filePath || '').replace(/\\/g, '/');
    let targetName = query.name || '';
    let targetQualifiedName = query.qualifiedName || targetName;

    const startCommit = commits[0];

    // Extract symbols from target snapshot
    const startSymbols = await this._getOrExtractSymbols(repoPath, startCommit.hash, currentFilePath);
    if (!startSymbols || startSymbols.length === 0) {
      return {
        query,
        error: `No symbols found in file '${currentFilePath}' at commit ${startCommit.hash}`,
        versions: []
      };
    }

    // Find requested symbol
    let currentSymbol = startSymbols.find(s =>
      s.name === targetName ||
      s.qualifiedName === targetQualifiedName ||
      (query.startLine && s.range.startLine === query.startLine)
    );

    if (!currentSymbol) {
      return {
        query,
        error: `Symbol '${targetName}' not found in '${currentFilePath}' at commit ${startCommit.hash}`,
        versions: []
      };
    }

    // Register initial node
    const initialVersionId = `${startCommit.hash}::${currentSymbol.id}`;
    const symbolData = typeof currentSymbol.toJSON === 'function' ? currentSymbol.toJSON() : currentSymbol;
    let currentNode = graph.addNode({
      ...symbolData,
      versionId: initialVersionId,
      commitHash: startCommit.hash
    });

    const chain = [{
      commit: startCommit,
      symbol: currentSymbol,
      node: currentNode,
      edge: null
    }];

    // Traverse parent commits
    for (let i = 0; i < commits.length - 1 && i < maxDepth; i++) {
      const childCommit = commits[i];
      const parentHash = childCommit.parents.length > 0 ? childCommit.parents[0] : null;

      if (!parentHash) {
        // Child commit is a root commit!
        const edge = graph.addEdge({
          sourceVersionId: currentNode.versionId,
          targetVersionId: `root::${currentNode.versionId}`,
          childCommit: childCommit.hash,
          parentCommit: '',
          changeClassification: 'new',
          matchingScore: 1.0,
          matchingMethod: 'root_commit_boundary',
          evidence: { reason: 'Root commit reached; symbol introduced at repository origin' },
          confidence: 'certain'
        });
        chain[chain.length - 1].edge = edge;
        break;
      }

      // Find predecessor file path in parent commit (handles file renames or deletions)
      const predecessorPath = await this.gitReader.findPredecessorPath(
        repoPath,
        childCommit.hash,
        parentHash,
        currentFilePath
      );

      if (!predecessorPath) {
        // File was newly added in childCommit! Symbol is new.
        const originVersionId = `${parentHash}::none::${currentSymbol.name}`;
        const edge = graph.addEdge({
          sourceVersionId: currentNode.versionId,
          targetVersionId: originVersionId,
          childCommit: childCommit.hash,
          parentCommit: parentHash,
          changeClassification: 'new',
          matchingScore: 1.0,
          matchingMethod: 'file_introduction',
          evidence: { reason: `File ${currentFilePath} was newly introduced in commit ${childCommit.hash}` },
          confidence: 'high'
        });
        chain[chain.length - 1].edge = edge;
        break;
      }

      // File existed in parent commit. Extract candidate symbols.
      const parentSymbols = await this._getOrExtractSymbols(repoPath, parentHash, predecessorPath);
      const isRenamedFile = predecessorPath !== currentFilePath;

      const matchResult = this.matcher.match(currentSymbol, parentSymbols, {
        isNewFile: false,
        filePath: currentFilePath,
        parentFilePath: predecessorPath,
        isRenamedFile
      });

      if (matchResult.selected) {
        const predecessorSymbol = matchResult.selected;
        const predVersionId = `${parentHash}::${predecessorSymbol.id}`;
        
        let predNode = graph.getNode(predVersionId);
        if (!predNode) {
          const predData = typeof predecessorSymbol.toJSON === 'function' ? predecessorSymbol.toJSON() : predecessorSymbol;
          predNode = graph.addNode({
            ...predData,
            versionId: predVersionId,
            commitHash: parentHash
          });
        }

        const edge = graph.addEdge({
          sourceVersionId: currentNode.versionId,
          targetVersionId: predVersionId,
          childCommit: childCommit.hash,
          parentCommit: parentHash,
          changeClassification: matchResult.changeClassification,
          matchingScore: matchResult.score,
          matchingMethod: matchResult.matchingMethod,
          evidence: matchResult.evidence,
          confidence: matchResult.decisionStatus
        });

        chain[chain.length - 1].edge = edge;

        const parentCommitObj = commits[i + 1] || await this.gitReader.getCommit(repoPath, parentHash);
        chain.push({
          commit: parentCommitObj,
          symbol: predecessorSymbol,
          node: predNode,
          edge: null
        });

        // Advance current pointers
        currentSymbol = predecessorSymbol;
        currentNode = predNode;
        currentFilePath = predecessorPath;
      } else {
        // Matcher could not find candidate or result is uncertain / new
        const unresolvedId = `${parentHash}::unresolved::${currentSymbol.name}`;
        const edge = graph.addEdge({
          sourceVersionId: currentNode.versionId,
          targetVersionId: unresolvedId,
          childCommit: childCommit.hash,
          parentCommit: parentHash,
          changeClassification: matchResult.changeClassification,
          matchingScore: matchResult.score,
          matchingMethod: matchResult.matchingMethod,
          evidence: matchResult.evidence,
          confidence: matchResult.decisionStatus
        });

        chain[chain.length - 1].edge = edge;
        break; // Stop traversal at boundary or unresolved point
      }
    }

    // If oldest reached version is at a root commit and has no edge, record root boundary
    const lastChainItem = chain[chain.length - 1];
    if (lastChainItem && !lastChainItem.edge && (lastChainItem.commit.isRoot || lastChainItem.commit.parents.length === 0)) {
      const edge = graph.addEdge({
        sourceVersionId: lastChainItem.node.versionId,
        targetVersionId: `root::${lastChainItem.node.versionId}`,
        childCommit: lastChainItem.commit.hash,
        parentCommit: '',
        changeClassification: 'new',
        matchingScore: 1.0,
        matchingMethod: 'root_commit_boundary',
        evidence: { reason: 'Root commit reached; symbol introduced at repository origin' },
        confidence: 'certain'
      });
      lastChainItem.edge = edge;
    }

    return {
      query,
      initialSymbol: query,
      versions: chain
    };
  }

  async _getOrExtractSymbols(repoPath, commitHash, filePath) {
    if (this.cache) {
      const cached = await this.cache.getSymbols(commitHash, filePath);
      if (cached) return cached.map(s => (s instanceof SymbolRecord ? s : SymbolRecord.fromJSON(s)));
    }

    const content = await this.gitReader.getFileContent(repoPath, commitHash, filePath);
    if (content === null) return [];

    const { symbols } = await this.extractor.extract(content, filePath);

    if (this.cache && symbols) {
      await this.cache.putSymbols(commitHash, filePath, symbols.map(s => (s.toJSON ? s.toJSON() : s)));
    }

    return symbols;
  }
}

module.exports = HistoryTracker;
