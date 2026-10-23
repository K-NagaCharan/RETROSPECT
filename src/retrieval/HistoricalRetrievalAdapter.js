const QueryProcessor = require('../structural/query/QueryProcessor');
const GitHistoryReader = require('../git/GitHistoryReader');
const FunctionExtractor = require('../parser/FunctionExtractor');
const FunctionMatcher = require('../matcher/FunctionMatcher');
const path = require('path');

class HistoricalRetrievalAdapter {
  constructor(options = {}) {
    this.gitReader = options.gitReader || new GitHistoryReader();
    this.extractor = options.extractor || new FunctionExtractor();
    this.matcher = options.matcher || new FunctionMatcher(options.matcherConfig || {});
    // Default historical scoring weights
    this.weights = {
      historicalName: options.weights?.historicalName ?? 0.40,
      commitMessage: options.weights?.commitMessage ?? 0.30,
      diffTerms: options.weights?.diffTerms ?? 0.20,
      historicalDocstring: options.weights?.historicalDocstring ?? 0.10
    };
    this.minScoreThreshold = options.minScoreThreshold ?? 0.05;
  }

  /**
   * Extract historical terms (tokens, stems, identifiers) from commit messages and diffs
   */
  static extractTerms(text) {
    if (!text || typeof text !== 'string') return { tokens: [], stems: [] };
    const rawWords = text.match(/[A-Za-z0-9_$.]+/g) || [];
    const tokens = new Set();
    const stems = new Set();

    for (const raw of rawWords) {
      const clean = raw.replace(/^[^\w]+|[^\w]+$/g, '').toLowerCase();
      if (clean.length >= 3) {
        tokens.add(clean);
        stems.add(QueryProcessor.stem(clean));
      }
      // Subtoken splitting for camelCase and snake_case identifiers
      const subtokens = QueryProcessor.splitIdentifiers(raw).map(t => t.toLowerCase());
      for (const st of subtokens) {
        if (st.length >= 3) {
          tokens.add(st);
          stems.add(QueryProcessor.stem(st));
        }
      }
    }

    return {
      tokens: Array.from(tokens),
      stems: Array.from(stems)
    };
  }

  /**
   * Builds an indexed historical profile for a symbol from tracking/audit evidence.
   * @param {object} params
   * @param {object} params.currentSymbol Current symbol metadata
   * @param {object} [params.predecessorSymbol] Predecessor symbol metadata (if any)
   * @param {string} [params.commitMessage] Relevant commit message
   * @param {string} [params.diffText] Diff text associated with the evolution
   * @param {string} [params.evolutionType] Evolution category
   * @param {boolean} [params.isValidPredecessor] Ground truth validity
   * @param {string} [params.confidence='certain'] Lineage confidence
   * @returns {object} Historical evidence profile
   */
  buildSymbolHistoryProfile(params) {
    const {
      currentSymbol,
      predecessorSymbol,
      commitMessage = '',
      diffText = '',
      evolutionType = 'unknown',
      confidence = 'certain'
    } = params;

    const historicalNames = [];
    const historicalQualifiedNames = [];
    const historicalDocstrings = [];

    if (predecessorSymbol && predecessorSymbol.name) {
      historicalNames.push(predecessorSymbol.name);
      if (predecessorSymbol.qualifiedName) {
        historicalQualifiedNames.push(predecessorSymbol.qualifiedName);
      }
      if (predecessorSymbol.docstring) {
        historicalDocstrings.push(predecessorSymbol.docstring);
      }
    }

    const commitTerms = HistoricalRetrievalAdapter.extractTerms(commitMessage);
    const diffTerms = HistoricalRetrievalAdapter.extractTerms(diffText);
    const docstringTerms = HistoricalRetrievalAdapter.extractTerms(historicalDocstrings.join(' '));

    return {
      currentSymbolName: currentSymbol.name,
      currentFilePath: currentSymbol.filePath,
      historicalNames,
      historicalQualifiedNames,
      commitMessage,
      commitTerms,
      diffText,
      diffTerms,
      historicalDocstrings,
      docstringTerms,
      evolutionType,
      confidence
    };
  }

  /**
   * Scores a symbol's historical profile against a processed query.
   * @param {object} query Processed query from QueryProcessor
   * @param {object} historyProfile Symbol's historical profile
   * @param {object} [ablationConfig={}] Ablation flags: { namesOnly, commitMessagesOnly, diffTermsOnly }
   * @returns {object} { score, breakdown, reasons }
   */
  scoreHistorical(query, historyProfile, ablationConfig = {}) {
    if (!historyProfile || query.isEmpty) {
      return { score: 0.0, breakdown: {}, reasons: [] };
    }

    const reasons = [];
    let nameScore = 0.0;
    let commitScore = 0.0;
    let diffScore = 0.0;
    let docScore = 0.0;

    const searchTerms = [...query.terms, ...query.stemmedTerms];

    // 1. Historical Name Matching
    if (!ablationConfig.commitMessagesOnly && !ablationConfig.diffTermsOnly) {
      for (const hName of historyProfile.historicalNames) {
        const lowerHName = hName.toLowerCase();
        for (const exactName of query.exactCandidateNames) {
          if (hName === exactName) {
            nameScore = Math.max(nameScore, 1.0);
            reasons.push(`Exact case-sensitive match on historical symbol name: '${hName}'`);
          } else if (lowerHName === exactName.toLowerCase()) {
            nameScore = Math.max(nameScore, 0.95);
            reasons.push(`Exact case-insensitive match on historical symbol name: '${hName}'`);
          }
        }

        // Subtoken and term overlap on historical name
        const subtokens = QueryProcessor.splitIdentifiers(hName).map(t => t.toLowerCase());
        const subStems = subtokens.map(t => QueryProcessor.stem(t));
        let matchCount = 0;
        for (const term of query.terms) {
          const stem = QueryProcessor.stem(term);
          if (subtokens.includes(term) || subStems.includes(stem)) {
            matchCount++;
          }
        }
        if (query.terms.length > 0 && matchCount > 0) {
          const overlap = matchCount / query.terms.length;
          nameScore = Math.max(nameScore, overlap);
          reasons.push(`Historical name '${hName}' matched ${matchCount} query term(s)`);
        }
      }
    }

    // 2. Commit Message Relevance
    if (!ablationConfig.namesOnly && !ablationConfig.diffTermsOnly) {
      if (historyProfile.commitTerms && historyProfile.commitTerms.tokens.length > 0) {
        let matchedCommitTerms = 0;
        for (const term of query.terms) {
          const stem = QueryProcessor.stem(term);
          if (historyProfile.commitTerms.tokens.includes(term) || historyProfile.commitTerms.stems.includes(stem)) {
            matchedCommitTerms++;
          }
        }
        if (query.terms.length > 0 && matchedCommitTerms > 0) {
          commitScore = Math.min(1.0, (matchedCommitTerms / query.terms.length) * 1.1);
          reasons.push(`Associated commit message matched ${matchedCommitTerms} query term(s)`);
        }
      }
    }

    // 3. Diff-Derived Terms Relevance
    if (!ablationConfig.namesOnly && !ablationConfig.commitMessagesOnly) {
      if (historyProfile.diffTerms && historyProfile.diffTerms.tokens.length > 0) {
        let matchedDiffTerms = 0;
        for (const term of query.terms) {
          const stem = QueryProcessor.stem(term);
          if (historyProfile.diffTerms.tokens.includes(term) || historyProfile.diffTerms.stems.includes(stem)) {
            matchedDiffTerms++;
          }
        }
        if (query.terms.length > 0 && matchedDiffTerms > 0) {
          diffScore = Math.min(1.0, (matchedDiffTerms / query.terms.length) * 1.0);
          reasons.push(`Code diff modifications matched ${matchedDiffTerms} query term(s)`);
        }
      }
    }

    // 4. Historical Docstrings
    if (!ablationConfig.namesOnly && !ablationConfig.commitMessagesOnly && !ablationConfig.diffTermsOnly) {
      if (historyProfile.docstringTerms && historyProfile.docstringTerms.tokens.length > 0) {
        let matchedDocTerms = 0;
        for (const term of query.terms) {
          const stem = QueryProcessor.stem(term);
          if (historyProfile.docstringTerms.tokens.includes(term) || historyProfile.docstringTerms.stems.includes(stem)) {
            matchedDocTerms++;
          }
        }
        if (query.terms.length > 0 && matchedDocTerms > 0) {
          docScore = Math.min(1.0, matchedDocTerms / query.terms.length);
          reasons.push(`Historical docstring matched ${matchedDocTerms} query term(s)`);
        }
      }
    }

    // Apply confidence discount if lineage was uncertain
    const confidenceMultiplier = historyProfile.confidence === 'certain' ? 1.0 : 0.65;

    // Calculate weighted total score
    let totalScore = 0.0;
    if (ablationConfig.namesOnly) {
      totalScore = nameScore;
    } else if (ablationConfig.commitMessagesOnly) {
      totalScore = commitScore;
    } else if (ablationConfig.diffTermsOnly) {
      totalScore = diffScore;
    } else {
      totalScore = (
        nameScore * this.weights.historicalName +
        commitScore * this.weights.commitMessage +
        diffScore * this.weights.diffTerms +
        docScore * this.weights.historicalDocstring
      );
    }

    totalScore *= confidenceMultiplier;

    return {
      score: parseFloat(totalScore.toFixed(4)),
      breakdown: {
        historicalName: parseFloat(nameScore.toFixed(4)),
        commitMessage: parseFloat(commitScore.toFixed(4)),
        diffTerms: parseFloat(diffScore.toFixed(4)),
        historicalDocstring: parseFloat(docScore.toFixed(4)),
        confidenceMultiplier
      },
      reasons
    };
  }

  /**
   * Rank candidates using Historical Evidence ONLY (Configuration C).
   * Does NOT use structural ranking scores.
   * Enforces candidate-pool parity: all candidates are retained and sorted deterministically.
   * @param {string|object} rawQuery 
   * @param {Array<object>} candidates Array of { symbol, historyProfile }
   * @param {object} [ablationConfig={}]
   * @param {object} [options={}] options.enforceCandidateParity (default true)
   * @returns {Array<object>} Ranked candidates sorted descending by score with deterministic tie-breaking
   */
  rankHistoricalOnly(rawQuery, candidates, ablationConfig = {}, options = {}) {
    const query = typeof rawQuery === 'string' ? QueryProcessor.process(rawQuery) : rawQuery;
    if (!candidates || candidates.length === 0) return [];

    const enforceCandidateParity = options.enforceCandidateParity ?? true;
    const scored = [];

    for (const cand of candidates) {
      const profile = cand.historyProfile;
      const { score, breakdown, reasons } = query.isEmpty 
        ? { score: 0.0, breakdown: {}, reasons: [] } 
        : this.scoreHistorical(query, profile, ablationConfig);

      if (enforceCandidateParity) {
        scored.push({
          symbol: cand.symbol,
          score: score >= this.minScoreThreshold ? score : 0.0,
          scoreBreakdown: breakdown,
          matchReasons: reasons,
          historyProfile: profile
        });
      } else {
        if (score >= this.minScoreThreshold) {
          scored.push({
            symbol: cand.symbol,
            score,
            scoreBreakdown: breakdown,
            matchReasons: reasons,
            historyProfile: profile
          });
        }
      }
    }

    // Deterministic tie-breaking on symbol identifier
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const idA = a.symbol.id || `${a.symbol.filePath}::${a.symbol.name}`;
      const idB = b.symbol.id || `${b.symbol.filePath}::${b.symbol.name}`;
      return idA.localeCompare(idB);
    });

    return scored;
  }

  /**
   * Fuse structural score with historical score (Configuration D: Combined Baseline).
   * Linearly combines structural and historical evidence.
   * @param {number} structuralScore Normalized score from StructuralRetriever [0, 1]
   * @param {number} historicalScore Normalized score from HistoricalRetrievalAdapter [0, 1]
   * @param {object} [weights] Fusion weights { structural: 0.60, historical: 0.40 }
   * @param {object} [options]
   * @param {boolean} [options.normalizeActiveChannels=false] When true, normalizes score by sum of weights of active channels (score > 0)
   * @returns {number} Combined score [0, 1]
   */
  static fuseScores(structuralScore = 0, historicalScore = 0, weights = { structural: 0.60, historical: 0.40 }, options = {}) {
    const s = Number.isFinite(structuralScore) && structuralScore > 0 ? structuralScore : 0.0;
    const h = Number.isFinite(historicalScore) && historicalScore > 0 ? historicalScore : 0.0;
    const structWeight = weights?.structural ?? 0.60;
    const histWeight = weights?.historical ?? 0.40;

    if (options && options.normalizeActiveChannels) {
      let activeWeightSum = 0.0;
      let weightedSum = 0.0;

      if (s > 0 && structWeight > 0) {
        weightedSum += s * structWeight;
        activeWeightSum += structWeight;
      }
      if (h > 0 && histWeight > 0) {
        weightedSum += h * histWeight;
        activeWeightSum += histWeight;
      }

      if (activeWeightSum <= 0.0) {
        return 0.0;
      }

      const normalized = weightedSum / activeWeightSum;
      return parseFloat(normalized.toFixed(4));
    }

    const combined = (s * structWeight) + (h * histWeight);
    return parseFloat(combined.toFixed(4));
  }

  /**
   * Adaptive score fusion (Configuration E: Max/Adaptive Fusion).
   * Prevents destructive interference / linear dilution when a symbol has strong historical
   * evidence (e.g. rename or rewrite) but low current structural similarity.
   * @param {number} structuralScore Normalized score [0, 1]
   * @param {number} historicalScore Normalized score [0, 1]
   * @param {object} [options] { boost: 0.25 }
   * @returns {number} Combined adaptive score [0, 1]
   */
  static adaptiveFuseScores(structuralScore = 0, historicalScore = 0, options = { boost: 0.25 }) {
    const s = Math.max(0, Math.min(1, structuralScore));
    const h = Math.max(0, Math.min(1, historicalScore));
    const base = Math.max(s, h);
    const bonus = Math.min(s, h) * (options.boost ?? 0.25);
    return parseFloat(Math.min(1.0, base + bonus).toFixed(4));
  }

  /**
   * Traverse ancestor lineage from a current symbol through renames and moves.
   * Accumulates historical change records in reverse-chronological order without cycles.
   * @param {object} sym Current symbol metadata { name, filePath, id }
   * @param {Map<string, Array<object>>} evolutionMap Map of "path::name" -> change records
   * @param {Map<string, number>} [commitIndexMap] Map of commitHash -> chronological index
   * @param {object} [options] Traversal options { maxHistoryDepth }
   * @returns {Array<object>} Accumulated change records
   */
  stitchLineage(sym, evolutionMap, commitIndexMap = null, options = {}) {
    if (!sym || !evolutionMap) return [];
    const maxDepth = options.maxHistoryDepth || 50;
    const normPath = (sym.filePath || '').replace(/\\/g, '/');

    const allRecords = [];
    const visitedRecordIds = new Set();
    const visitedStates = new Set();

    let currPath = normPath;
    let currName = sym.name;
    let minCommitIndex = 0;
    let continueTracing = true;

    while (continueTracing && allRecords.length < maxDepth) {
      const currKey = `${currPath}::${currName}`;
      const stateKey = `${currKey}@${minCommitIndex}`;
      if (visitedStates.has(stateKey)) {
        // Cycle detected
        break;
      }
      visitedStates.add(stateKey);

      const candidateRecords = evolutionMap.get(currKey) || [];
      let transitionFound = false;

      for (const rec of candidateRecords) {
        if (allRecords.length >= maxDepth) {
          continueTracing = false;
          break;
        }

        const childIdx = commitIndexMap ? commitIndexMap.get(rec.childCommit) : undefined;
        // If commit ordering is provided, ignore records newer than minCommitIndex
        if (commitIndexMap && childIdx !== undefined && childIdx < minCommitIndex) {
          continue;
        }

        const recId = `${rec.childCommit}::${currKey}`;
        if (visitedRecordIds.has(recId)) {
          continue;
        }
        visitedRecordIds.add(recId);
        allRecords.push(rec);

        if (rec.confidence === 'uncertain' || rec.changeClassification === 'uncertain') {
          // Ambiguous lineage link: apply ambiguity policy, stop further traversal along this branch
          continueTracing = false;
          break;
        }

        if (rec.predecessorSymbol && rec.predecessorSymbol.name) {
          const predName = rec.predecessorSymbol.name;
          const predPath = (rec.predecessorSymbol.filePath || rec.normPath).replace(/\\/g, '/');
          const isRenameOrMove = (predName !== currName) || (predPath !== currPath);

          if (isRenameOrMove) {
            // Identity transition: switch current key to predecessor and advance minimum commit index
            currPath = predPath;
            currName = predName;
            if (commitIndexMap) {
              const parentIdx = commitIndexMap.get(rec.parentCommit);
              minCommitIndex = (parentIdx !== undefined) ? parentIdx : (childIdx !== undefined ? childIdx + 1 : minCommitIndex + 1);
            } else {
              minCommitIndex += 1;
            }
            transitionFound = true;
            break; // Query evolutionMap for the predecessor key
          }
        } else {
          // Root introduction or severed predecessor link: stop backward traversal
          continueTracing = false;
          break;
        }
      }

      if (!transitionFound) {
        continueTracing = false;
      }
    }

    return allRecords;
  }

  /**
   * Indexes genuine Git commit history and symbol lineage for a repository.
   * Uses GitHistoryReader, FunctionExtractor, and FunctionMatcher to extract
   * real commit messages, diffs, and predecessor symbols. Never uses audit notes
   * or benchmark answers.
   * 
   * @param {string} repoPath Local repository root
   * @param {Array<object>} currentSymbols Symbols extracted from current working tree / HEAD
   * @param {object} [options] Indexing options
   * @param {number} [options.maxCommits=100] Traversal depth in Git history
   * @param {string} [options.startCommit='HEAD'] Starting commit hash or ref
   * @returns {Promise<object>} { profileMap: Map<symbolId, historyProfile>, stats: object }
   */
  async indexRepositoryHistory(repoPath, currentSymbols = [], options = {}) {
    const maxCommits = options.maxCommits || 100;
    const startCommit = options.startCommit || 'HEAD';
    const firstParentOnly = options.firstParentOnly ?? false;
    const startTime = Date.now();

    const commits = await this.gitReader.getCommitHistory(repoPath, startCommit, maxCommits, { firstParentOnly });
    const fileCache = new Map();
    // Extraction failures (count, first error) - previously swallowed silently; exposed in stats.
    const extractionFailures = { count: 0, firstError: null };

    const getSymbols = async (commitHash, filePath) => {
      const cacheKey = `${commitHash}:${filePath}`;
      if (fileCache.has(cacheKey)) return fileCache.get(cacheKey);
      const content = await this.gitReader.getFileContent(repoPath, commitHash, filePath);
      if (!content) return [];
      try {
        const { symbols } = await this.extractor.extract(content, filePath);
        const res = symbols || [];
        fileCache.set(cacheKey, res);
        return res;
      } catch (err) {
        // Behaviour unchanged (no symbols for this file version), but counted.
        extractionFailures.count++;
        if (!extractionFailures.firstError) {
          const message = err && (err.message || err.name) ? (err.message || err.name) : String(err);
          extractionFailures.firstError = `${commitHash.slice(0, 12)}:${filePath}: ${message}`;
        }
        return [];
      }
    };

    // Map: "normalizedFilePath::symbolName" -> array of historical change records
    const evolutionMap = new Map();
    let analyzedCommits = 0;
    let changedFilesAnalyzed = 0;

    for (let i = 0; i < commits.length - 1; i++) {
      const childCommit = commits[i];
      // In merge-aware mode, skip merge commits because their changes are covered
      // atomically by the traversed branch commits, avoiding noisy composite diffs.
      if (!firstParentOnly && childCommit.parents.length > 1) {
        continue;
      }
      const parentHash = childCommit.parents[0];
      if (!parentHash) continue;

      let changes = [];
      try {
        changes = await this.gitReader.getChangedFiles(repoPath, childCommit.hash, parentHash);
      } catch (err) {
        continue;
      }

      for (const change of changes) {
        const filePath = change.newPath || change.oldPath;
        if (!filePath) continue;
        const normPath = filePath.replace(/\\/g, '/');
        if (!normPath.endsWith('.js') && !normPath.endsWith('.ts') && !normPath.endsWith('.py') && !normPath.endsWith('.java')) {
          continue;
        }

        changedFilesAnalyzed++;
        const childSyms = await getSymbols(childCommit.hash, normPath);
        const parentSyms = change.oldPath ? await getSymbols(parentHash, change.oldPath.replace(/\\/g, '/')) : [];

        if (childSyms.length === 0 && parentSyms.length === 0) continue;

        let diffText = null;

        for (const cs of childSyms) {
          const matchResult = this.matcher.match(cs, parentSyms, {
            isNewFile: change.status === 'added',
            filePath: normPath,
            parentFilePath: change.oldPath ? change.oldPath.replace(/\\/g, '/') : normPath,
            isRenamedFile: change.status === 'renamed'
          });

          if (matchResult && matchResult.changeClassification !== 'unchanged') {
            if (diffText === null) {
              try {
                diffText = await this.gitReader.getFileDiff(repoPath, childCommit.hash, parentHash, normPath);
              } catch (err) {
                diffText = '';
              }
            }

            const key = `${normPath}::${cs.name}`;
            if (!evolutionMap.has(key)) evolutionMap.set(key, []);
            evolutionMap.get(key).push({
              childCommit: childCommit.hash,
              parentCommit: parentHash,
              commitMessage: childCommit.message,
              changeClassification: matchResult.changeClassification,
              predecessorSymbol: matchResult.selected || null,
              confidence: matchResult.decisionStatus || 'certain',
              diffText,
              normPath
            });
          }
        }
      }
      analyzedCommits++;
    }

    // Build commit index map for temporal ordering during lineage traversal
    const commitIndexMap = new Map();
    commits.forEach((c, idx) => commitIndexMap.set(c.hash, idx));

    // Build historical profile for each current symbol
    const profileMap = new Map();
    let symbolsWithHistory = 0;

    for (const sym of currentSymbols) {
      const records = this.stitchLineage(sym, evolutionMap, commitIndexMap, options);

      if (records.length > 0) {
        symbolsWithHistory++;
        const historicalNames = new Set();
        const historicalQualifiedNames = new Set();
        const historicalDocstrings = [];
        const commitMessages = [];
        const diffSnippets = [];
        const seenCommitMessages = new Set();
        const seenDiffSnippets = new Set();
        const seenDocstrings = new Set();
        let lowestConfidence = 'certain';
        let latestEvolutionType = records[0].changeClassification;

        for (const rec of records) {
          if (rec.predecessorSymbol && rec.predecessorSymbol.name) {
            historicalNames.add(rec.predecessorSymbol.name);
            if (rec.predecessorSymbol.qualifiedName) {
              historicalQualifiedNames.add(rec.predecessorSymbol.qualifiedName);
            }
            if (rec.predecessorSymbol.docstring && !seenDocstrings.has(rec.predecessorSymbol.docstring)) {
              seenDocstrings.add(rec.predecessorSymbol.docstring);
              historicalDocstrings.push(rec.predecessorSymbol.docstring);
            }
          }
          if (rec.commitMessage && !seenCommitMessages.has(rec.commitMessage)) {
            seenCommitMessages.add(rec.commitMessage);
            commitMessages.push(rec.commitMessage);
          }
          if (rec.diffText && !seenDiffSnippets.has(rec.diffText)) {
            seenDiffSnippets.add(rec.diffText);
            diffSnippets.push(rec.diffText.substring(0, 1500)); // Cap diff size per commit
          }
          if (rec.confidence === 'uncertain' || rec.changeClassification === 'uncertain') {
            lowestConfidence = 'uncertain';
          }
        }

        const combinedCommitMsg = commitMessages.join('\n');
        const combinedDiff = diffSnippets.join('\n');

        const profile = {
          currentSymbolName: sym.name,
          currentFilePath: sym.filePath,
          historicalNames: Array.from(historicalNames),
          historicalQualifiedNames: Array.from(historicalQualifiedNames),
          commitMessage: combinedCommitMsg,
          commitTerms: HistoricalRetrievalAdapter.extractTerms(combinedCommitMsg),
          diffText: combinedDiff,
          diffTerms: HistoricalRetrievalAdapter.extractTerms(combinedDiff),
          historicalDocstrings,
          docstringTerms: HistoricalRetrievalAdapter.extractTerms(historicalDocstrings.join(' ')),
          evolutionType: latestEvolutionType,
          confidence: lowestConfidence,
          historyDepth: records.length
        };
        profileMap.set(sym.id, profile);
      } else {
        // Cold symbol with no recorded evolution in indexed history
        const profile = {
          currentSymbolName: sym.name,
          currentFilePath: sym.filePath,
          historicalNames: [],
          historicalQualifiedNames: [],
          commitMessage: '',
          commitTerms: { tokens: [], stems: [] },
          diffText: '',
          diffTerms: { tokens: [], stems: [] },
          historicalDocstrings: [],
          docstringTerms: { tokens: [], stems: [] },
          evolutionType: 'unchanged',
          confidence: 'certain',
          historyDepth: 0
        };
        profileMap.set(sym.id, profile);
      }
    }

    const durationMs = Date.now() - startTime;
    return {
      profileMap,
      stats: {
        commitsAnalyzed: analyzedCommits,
        changedFilesAnalyzed,
        symbolsWithHistory,
        totalCurrentSymbols: currentSymbols.length,
        durationMs,
        extractionFailures
      }
    };
  }
}

module.exports = HistoricalRetrievalAdapter;
