/**
 * Retrospect Phase C — Query Leakage Automated Screening Utility
 *
 * Implements reproducible lexical and semantic leakage screening for candidate queries.
 * NOTE: Automated screening is a filter, not proof of independence.
 * All queries must still pass human review before benchmark admission.
 */

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'were', 'will', 'with', 'function', 'method', 'code',
  'error', 'handling', 'call', 'caller', 'options', 'object', 'value'
]);

function tokenizeSubwords(identifier) {
  if (!identifier) return [];
  // Split on dots, slashes, underscores, and camelCase boundaries
  return identifier
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(token => token.length > 2 && !STOPWORDS.has(token));
}

function extractNgrams(text, n = 3) {
  if (!text) return [];
  const words = text
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));
  const ngrams = [];
  for (let i = 0; i <= words.length - n; i++) {
    ngrams.push(words.slice(i, i + n).join(' '));
  }
  return ngrams;
}

function screenQueryForLeakage(queryText, targetMetadata) {
  const queryLower = queryText.toLowerCase();
  const queryWords = new Set(tokenizeSubwords(queryText));

  // 1. Identifier Token Overlap
  const targetSubwords = tokenizeSubwords(targetMetadata.target_symbol);
  const matchedSubwords = targetSubwords.filter(sw => queryWords.has(sw));
  const exactSymbolPresent = queryLower.includes(targetMetadata.target_symbol.toLowerCase());

  // 2. File / Path Clues
  const pathTokens = tokenizeSubwords(targetMetadata.source_file);
  const matchedPathTokens = pathTokens.filter(pt => queryWords.has(pt) && pt !== 'js' && pt !== 'lib');

  // 3. Distinctive N-gram Overlap (from diff / commit subject)
  const commitNgrams = extractNgrams(targetMetadata.commit_subject, 2);
  const matchedNgrams = commitNgrams.filter(ngram => queryLower.includes(ngram));

  // 4. Semantic Clues (e.g., CVE, unique parameter names)
  const semanticClues = [];
  if (targetMetadata.issue_references && targetMetadata.issue_references.length > 0) {
    targetMetadata.issue_references.forEach(ref => {
      if (queryLower.includes(ref.toLowerCase().replace('#', ''))) {
        semanticClues.push(`Issue reference ${ref} present in query`);
      }
    });
  }

  const isFlagged = exactSymbolPresent || 
                    matchedSubwords.length > 0 || 
                    matchedPathTokens.length > 0 || 
                    matchedNgrams.length > 0 || 
                    semanticClues.length > 0;

  return {
    query_text: queryText,
    target_symbol: targetMetadata.target_symbol,
    source_file: targetMetadata.source_file,
    identifier_overlap: {
      target_subwords: targetSubwords,
      matched_subwords: matchedSubwords,
      exact_symbol_present: exactSymbolPresent,
      flagged: exactSymbolPresent || matchedSubwords.length > 0
    },
    path_clues: {
      path_tokens: pathTokens,
      matched_path_tokens: matchedPathTokens,
      flagged: matchedPathTokens.length > 0
    },
    ngram_overlap: {
      tested_ngrams: commitNgrams,
      matched_ngrams: matchedNgrams,
      flagged: matchedNgrams.length > 0
    },
    semantic_clues: {
      flagged_clues: semanticClues,
      flagged: semanticClues.length > 0
    },
    screening_verdict: isFlagged ? 'SCREEN_FLAGGED_FOR_HUMAN_ATTENTION' : 'SCREEN_CLEAR'
  };
}

module.exports = {
  tokenizeSubwords,
  extractNgrams,
  screenQueryForLeakage
};

if (require.main === module) {
  // Quick test execution
  const testTarget = {
    target_symbol: 'res.clearCookie',
    source_file: 'lib/response.js',
    commit_subject: 'Ignore expires and maxAge in res.clearCookie() (#5792)',
    issue_references: ['#5792']
  };

  const leakyQuery = "How does res.clearCookie handle maxAge options when clearing cookies?";
  const cleanQuery = "Where are client cookie expiration headers formatted and deleted during a logout operation?";

  console.log('--- LEAKY QUERY SCREENING ---');
  console.log(screenQueryForLeakage(leakyQuery, testTarget));

  console.log('\n--- CLEAN QUERY SCREENING ---');
  console.log(screenQueryForLeakage(cleanQuery, testTarget));
}
