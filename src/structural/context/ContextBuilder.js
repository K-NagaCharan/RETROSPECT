/**
 * ContextBuilder formats ranked symbols into structured code blocks
 * subject to a deterministic token or character budget.
 */
class ContextBuilder {
  /**
   * Deterministic token-budget approximation:
   * ~4 characters per token for source code, or count whitespace-separated tokens.
   */
  static approximateTokens(text) {
    if (!text) return 0;
    // Standard LLM code heuristic: ~4 characters per token
    return Math.max(1, Math.ceil(text.length / 4));
  }

  /**
   * Build structured retrieval context from ranked candidates.
   * @param {Array<object>} rankedCandidates List of scored candidates from retriever
   * @param {object} [options]
   * @param {number} [options.maxResults=5] Maximum number of symbol results
   * @param {number} [options.tokenBudget=4000] Maximum token budget
   * @param {number} [options.charBudget] Optional explicit character budget
   * @param {boolean} [options.includeSource=true] Whether to include full source code
   * @returns {object} Structured context object
   */
  static buildContext(rankedCandidates, options = {}) {
    const maxResults = options.maxResults !== undefined ? options.maxResults : 5;
    const tokenBudget = options.tokenBudget !== undefined ? options.tokenBudget : 4000;
    const charBudget = options.charBudget || (tokenBudget * 4);
    const includeSource = options.includeSource !== false;

    let consumedTokens = 0;
    let consumedChars = 0;
    const selectedBlocks = [];
    let omittedCount = 0;
    let budgetExceeded = false;

    for (let i = 0; i < rankedCandidates.length; i++) {
      if (selectedBlocks.length >= maxResults) {
        omittedCount += (rankedCandidates.length - i);
        break;
      }

      const cand = rankedCandidates[i];
      const symbol = cand.symbol;
      const sourceText = includeSource ? (symbol.source || '') : '';
      const estimatedTokens = ContextBuilder.approximateTokens(sourceText) + 30; // +30 tokens for metadata
      const charCount = sourceText.length;

      // Check if adding this symbol exceeds remaining budget
      if (consumedTokens + estimatedTokens > tokenBudget || consumedChars + charCount > charBudget) {
        // If we haven't included ANY symbol yet, include at least the top symbol (or indicate truncation)
        if (selectedBlocks.length > 0) {
          budgetExceeded = true;
          omittedCount += (rankedCandidates.length - i);
          break;
        }
      }

      consumedTokens += estimatedTokens;
      consumedChars += charCount;

      selectedBlocks.push({
        symbolId: symbol.id,
        name: symbol.name,
        qualifiedName: symbol.qualifiedName,
        kind: symbol.symbolType,
        filePath: symbol.filePath,
        range: {
          startLine: symbol.range ? symbol.range.startLine : 1,
          endLine: symbol.range ? symbol.range.endLine : 1
        },
        signature: symbol.normalizedSignature,
        returnType: symbol.returnType,
        parameters: symbol.parameters,
        docstring: symbol.docstring || null,
        source: sourceText,
        score: Number(cand.score.toFixed(4)),
        scoreBreakdown: cand.scoreBreakdown,
        matchReasons: cand.matchReasons || [],
        relatedSymbols: cand.relatedSymbols || { callers: [], callees: [], enclosingClass: null },
        extractionLimitations: symbol.extractionStatus === 'partial' ? 'Syntax errors present during AST parsing' : null
      });
    }

    return {
      results: selectedBlocks,
      totalCandidatesGenerated: rankedCandidates.length,
      returnedCount: selectedBlocks.length,
      omittedCount,
      budget: {
        tokenBudget,
        charBudget,
        consumedTokensEstimated: consumedTokens,
        consumedChars,
        budgetExceeded
      }
    };
  }
}

module.exports = ContextBuilder;
