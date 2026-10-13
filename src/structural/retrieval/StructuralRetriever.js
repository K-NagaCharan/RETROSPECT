const { StructuralIndex } = require('../index/StructuralIndex');
const QueryProcessor = require('../query/QueryProcessor');
const ContextBuilder = require('../context/ContextBuilder');

// Default feature scoring weights
const DEFAULT_WEIGHTS = {
  exact: 0.35,
  token: 0.25,
  docstring: 0.15,
  path: 0.10,
  signature: 0.05,
  graph: 0.05,
  kind: 0.05
};

class StructuralRetriever {
  constructor(index, options = {}) {
    if (!index || !(index instanceof StructuralIndex)) {
      throw new Error('StructuralRetriever requires a valid StructuralIndex instance');
    }
    this.index = index;
    this.weights = { ...DEFAULT_WEIGHTS, ...(options.weights || {}) };
    this.minScoreThreshold = options.minScoreThreshold !== undefined ? options.minScoreThreshold : 0.08;
  }

  /**
   * Main search method executing query processing, candidate retrieval, ranking, and context building.
   * @param {string} rawQuery 
   * @param {object} [options]
   * @returns {Promise<object>} Structured search response
   */
  async search(rawQuery, options = {}) {
    const startTime = Date.now();

    // Stage D: Query understanding
    const query = QueryProcessor.process(rawQuery);
    if (query.isEmpty) {
      return {
        query: rawQuery,
        processedQuery: query,
        totalCandidates: 0,
        results: [],
        latencyMs: Date.now() - startTime,
        budget: { budgetExceeded: false, consumedTokensEstimated: 0 }
      };
    }

    // Stage E (Part 1): Candidate generation
    const candidates = this.generateCandidates(query, options);

    // Stage E (Part 2): Multi-signal ranking
    const ranked = this.rankCandidates(query, candidates, options);

    // Stage F: Context construction
    const context = ContextBuilder.buildContext(ranked, options);

    const latencyMs = Date.now() - startTime;

    return {
      query: rawQuery,
      processedQuery: {
        terms: query.terms,
        exactCandidateNames: query.exactCandidateNames,
        targetKind: query.targetKind
      },
      totalCandidatesGenerated: candidates.length,
      returnedCount: context.returnedCount,
      omittedCount: context.omittedCount,
      latencyMs,
      budget: context.budget,
      results: context.results
    };
  }

  /**
   * Candidate generation: retrieve candidate symbols matching any query term or exact identifier.
   * @param {object} query Processed query object
   * @param {object} [options]
   * @returns {Array<SymbolRecord>} Unordered unique candidate symbols
   */
  generateCandidates(query, options = {}) {
    const candidateIds = new Set();

    // 1. Exact identifier lookup
    for (const name of query.exactCandidateNames) {
      const lower = name.toLowerCase();
      if (this.index.exactNameIndex.has(lower)) {
        for (const id of this.index.exactNameIndex.get(lower)) {
          candidateIds.add(id);
        }
      }
    }

    // 2. Inverted token index lookup (terms and stems)
    const searchTerms = [...query.terms, ...query.stemmedTerms];
    for (const term of searchTerms) {
      if (this.index.invertedIndex.has(term)) {
        for (const id of this.index.invertedIndex.get(term)) {
          candidateIds.add(id);
        }
      }
    }

    // 3. Fallback: if very few candidates found, scan symbol names for substring matches
    if (candidateIds.size < 5) {
      for (const [id, symbol] of this.index.symbols.entries()) {
        const lowerName = symbol.name.toLowerCase();
        for (const term of query.terms) {
          if (lowerName.includes(term) || symbol.filePath.toLowerCase().includes(term)) {
            candidateIds.add(id);
          }
        }
      }
    }

    const candidates = [];
    for (const id of candidateIds) {
      const sym = this.index.getSymbol(id);
      if (sym) candidates.push(sym);
    }

    return candidates;
  }

  /**
   * Multi-signal candidate ranking combining exact match, token overlap, docstring, path, signature, graph, and kind.
   * @param {object} query Processed query
   * @param {Array<SymbolRecord>} candidates
   * @param {object} [options]
   * @returns {Array<object>} Ranked candidates with scores and reasons
   */
  rankCandidates(query, candidates, options = {}) {
    if (candidates.length === 0) return [];

    const scoredList = [];

    // Pre-pass: identify high-confidence symbols for call-graph boosting
    const highConfidenceNames = new Set();
    for (const cand of candidates) {
      const lower = cand.name.toLowerCase();
      if (query.terms.includes(lower) || query.exactCandidateNames.some(en => en.toLowerCase() === lower)) {
        highConfidenceNames.add(cand.name);
      }
    }

    for (const symbol of candidates) {
      const { score, breakdown, reasons } = this._scoreCandidate(query, symbol, highConfidenceNames);

      // Filter out candidates below the minimum score threshold
      if (score >= this.minScoreThreshold) {
        scoredList.push({
          symbol,
          score,
          scoreBreakdown: breakdown,
          matchReasons: reasons,
          relatedSymbols: this.index.getRelatedSymbols(symbol.id)
        });
      }
    }

    // Sort strictly descending by total score
    scoredList.sort((a, b) => b.score - a.score);

    return scoredList;
  }

  _scoreCandidate(query, symbol, highConfidenceNames) {
    const reasons = [];

    // 1. Exact Match Score
    let exactScore = 0.0;
    const symName = symbol.name;
    const symLower = symName.toLowerCase();

    for (const exactName of query.exactCandidateNames) {
      if (symName === exactName) {
        exactScore = 1.0;
        reasons.push(`Exact case-sensitive symbol name match: '${symName}'`);
        break;
      } else if (symLower === exactName.toLowerCase()) {
        exactScore = Math.max(exactScore, 0.95);
        reasons.push(`Exact case-insensitive symbol name match: '${symName}'`);
      } else if (exactName.length >= 4 && (symName.includes(exactName) || symLower.includes(exactName.toLowerCase()))) {
        exactScore = Math.max(exactScore, 0.65);
        reasons.push(`Symbol name contains exact term: '${exactName}'`);
      }
    }

    // Only apply single-term exact match if the query consists of a single term
    if (exactScore === 0 && query.terms.length === 1) {
      const singleTerm = query.terms[0];
      if (symLower === singleTerm) {
        exactScore = 0.90;
        reasons.push(`Symbol name matches single query term: '${singleTerm}'`);
      }
    }

    // 2. Identifier & Token Overlap Score
    const nameSubtokens = QueryProcessor.splitIdentifiers(symName).map(t => t.toLowerCase());
    const nameStems = nameSubtokens.map(t => QueryProcessor.stem(t));
    let matchedNameTerms = 0;

    for (const term of query.terms) {
      const stem = QueryProcessor.stem(term);
      if (nameSubtokens.includes(term) || nameStems.includes(stem)) {
        matchedNameTerms++;
      } else if (term.length >= 4 && nameSubtokens.some(st => st.includes(term) || (st.length >= 4 && term.includes(st)))) {
        matchedNameTerms += 0.8;
      }
    }

    const tokenScore = query.terms.length > 0
      ? Math.min(1.0, (matchedNameTerms / query.terms.length) * 1.2)
      : 0.0;

    if (tokenScore > 0.3) {
      reasons.push(`Matched ${matchedNameTerms} query term(s) in identifier '${symName}'`);
    }

    // 3. Docstring & Comment Relevance Score
    let docstringScore = 0.0;
    if (symbol.docstring) {
      const docLower = symbol.docstring.toLowerCase();
      let matchedDocTerms = 0;
      for (const term of query.terms) {
        const stem = QueryProcessor.stem(term);
        if (docLower.includes(term) || docLower.includes(stem)) {
          matchedDocTerms++;
        }
      }
      docstringScore = query.terms.length > 0 ? (matchedDocTerms / query.terms.length) : 0.0;
      if (docstringScore > 0.2) {
        reasons.push(`Associated docstring/comment matches ${matchedDocTerms} query term(s)`);
      }
    }

    // 4. File Path & Module Relevance Score
    let pathScore = 0.0;
    if (symbol.filePath) {
      const pathLower = symbol.filePath.toLowerCase();
      let matchedPathTerms = 0;
      for (const term of query.terms) {
        const stem = QueryProcessor.stem(term);
        if (pathLower.includes(term) || pathLower.includes(stem)) {
          matchedPathTerms++;
        }
      }
      pathScore = query.terms.length > 0 ? (matchedPathTerms / query.terms.length) : 0.0;
      if (pathScore > 0.3) {
        reasons.push(`File path '${symbol.filePath}' matches query terms`);
      }
    }

    // 5. Signature & Parameter Relevance Score
    let signatureScore = 0.0;
    let matchedParams = 0;
    if (Array.isArray(symbol.parameters) && symbol.parameters.length > 0) {
      for (const p of symbol.parameters) {
        const pName = (typeof p === 'string' ? p : p.name || '').toLowerCase();
        const pType = (typeof p === 'object' && p.type ? p.type : '').toLowerCase();
        for (const term of query.terms) {
          if (pName.includes(term) || pType.includes(term)) {
            matchedParams++;
          }
        }
      }
    }
    if (Array.isArray(symbol.calls) && symbol.calls.length > 0) {
      for (const called of symbol.calls) {
        const cLower = called.toLowerCase();
        for (const term of query.terms) {
          if (cLower.includes(term)) {
            matchedParams += 0.5;
          }
        }
      }
    }
    signatureScore = Math.min(1.0, matchedParams * 0.35);
    if (signatureScore > 0.2) {
      reasons.push(`Signature parameters/calls match query terms`);
    }

    // 6. Call-Graph & Dependency Relevance Score
    let graphScore = 0.0;
    if (Array.isArray(symbol.calls) && symbol.calls.length > 0) {
      for (const called of symbol.calls) {
        if (highConfidenceNames.has(called)) {
          graphScore = 0.8;
          reasons.push(`Calls related high-relevance function '${called}'`);
          break;
        }
      }
    }
    if (graphScore === 0) {
      const lower = symbol.name.toLowerCase();
      if (this.index.callGraph.reverse.has(symbol.name) || this.index.callGraph.reverse.has(lower)) {
        const callers = this.index.callGraph.reverse.get(symbol.name) || this.index.callGraph.reverse.get(lower);
        for (const cId of callers) {
          const caller = this.index.getSymbol(cId);
          if (caller && highConfidenceNames.has(caller.name)) {
            graphScore = 0.6;
            reasons.push(`Called by related function '${caller.name}'`);
            break;
          }
        }
      }
    }

    // 7. Target Kind Alignment Score
    let kindScore = 0.0;
    if (query.targetKind) {
      if (symbol.symbolType === query.targetKind) {
        kindScore = 1.0;
        reasons.push(`Symbol kind matches requested target '${query.targetKind}'`);
      } else if (query.targetKind === 'function' && ['method', 'arrow_function', 'function'].includes(symbol.symbolType)) {
        kindScore = 0.9;
      }
    }

    // Weighted composite calculation
    const w = this.weights;
    let totalScore = (
      w.exact * exactScore +
      w.token * tokenScore +
      w.docstring * docstringScore +
      w.path * pathScore +
      w.signature * signatureScore +
      w.graph * graphScore +
      w.kind * kindScore
    );

    // Track which original query words were matched across all fields
    const queryWords = query.queryWords && query.queryWords.length > 0 ? query.queryWords : query.terms;
    const matchedQueryWords = new Set();
    const docLower = symbol.docstring ? symbol.docstring.toLowerCase() : '';
    const pathLower = symbol.filePath ? symbol.filePath.toLowerCase() : '';
    const paramStrings = Array.isArray(symbol.parameters)
      ? symbol.parameters.map(p => (typeof p === 'string' ? p : `${p.name || ''} ${p.type || ''}`).toLowerCase())
      : [];
    const callsLower = Array.isArray(symbol.calls)
      ? symbol.calls.map(c => c.toLowerCase())
      : [];

    for (const qWord of queryWords) {
      const qwLower = qWord.toLowerCase();
      const qwStem = QueryProcessor.stem(qwLower);
      const qwSubtokens = QueryProcessor.splitIdentifiers(qWord).map(x => x.toLowerCase());

      const isMatched = (t) => {
        if (!t || t.length < 2) return false;
        if (nameSubtokens.includes(t) || nameStems.includes(t)) return true;
        if (t.length >= 4 && nameSubtokens.some(st => st.includes(t) || (st.length >= 4 && t.includes(st)))) return true;
        if (docLower && docLower.includes(t)) return true;
        if (pathLower && pathLower.includes(t)) return true;
        if (paramStrings.some(p => p.includes(t))) return true;
        if (callsLower.some(c => c.includes(t))) return true;
        return false;
      };

      if (isMatched(qwLower) || isMatched(qwStem) || qwSubtokens.some(st => isMatched(st))) {
        matchedQueryWords.add(qwLower);
      }
    }

    // Incidental single-word match discount for multi-word queries (prevents false positives on unanswerable queries)
    if (queryWords.length >= 3) {
      if (matchedQueryWords.size <= 1) {
        totalScore *= 0.15; // Heavy discount when only 1 distinct query word matches out of 3+ words
      }
    }

    // Deprioritize test, script, and mock files when the query is asking for implementation code
    const isTestOrScript = /(^|[/\\])(test|tests|specs?|__tests__|testing|scripts?|tools?|benchmarks?)([/\\]|\.)/i.test(symbol.filePath || '');
    const queryMentionsTest = query.terms.some(t => t.includes('test') || t.includes('spec') || t.includes('script'));
    if (isTestOrScript && !queryMentionsTest) {
      totalScore *= 0.65;
    }

    const breakdown = {
      exactScore: Number(exactScore.toFixed(3)),
      tokenScore: Number(tokenScore.toFixed(3)),
      docstringScore: Number(docstringScore.toFixed(3)),
      pathScore: Number(pathScore.toFixed(3)),
      signatureScore: Number(signatureScore.toFixed(3)),
      graphScore: Number(graphScore.toFixed(3)),
      kindScore: Number(kindScore.toFixed(3)),
      totalScore: Number(totalScore.toFixed(4))
    };

    return {
      score: totalScore,
      breakdown,
      reasons
    };
  }
}

module.exports = {
  StructuralRetriever,
  DEFAULT_WEIGHTS
};
