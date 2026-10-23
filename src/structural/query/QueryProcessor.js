// Common English stopwords and generic code filler terms
const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from',
  'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself',
  'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me', 'more', 'most',
  'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our',
  'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than',
  'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this',
  'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when',
  'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your', 'yours', 'yourself',
  // Code filler terms
  'code', 'file', 'files', 'logic', 'implementation', 'show', 'find', 'get', 'give', 'tell', 'locate',
  'functions', 'methods', 'classes', 'piece', 'snippets', 'block', 'blocks'
]);

// Common programming languages, data formats, and protocols that represent domain nouns rather than code symbols
const DOMAIN_TERMS = new Set([
  'java', 'python', 'javascript', 'typescript', 'js', 'ts', 'py', 'rb', 'go', 'rs',
  'http', 'https', 'html', 'css', 'json', 'xml', 'graphql', 'rest', 'grpc', 'api',
  'url', 'uri', 'sql', 'wasm', 'webassembly', 'ssl', 'tls'
]);

// Common morphological prefixes in programming identifiers and behavioral queries
const COMPOUND_PREFIXES = ['non', 'multi', 'sub', 'pre', 'post', 'un', 'auto', 'cross', 'read'];

// Common non-compound English words that start with prefix substrings (avoids over-splitting)
const NON_COMPOUND_WORDS = new Set([
  'notice', 'nothing', 'uncle', 'under', 'until', 'union', 'unit', 'unique', 'auto', 'read', 'ready', 'real', 'post', 'multi'
]);

// Conservative canonical action verb mappings for common behavioral query variations
const CANONICAL_ACTION_SYNONYMS = {
  'dispatch': 'send',
  'transmit': 'send',
  'retrieve': 'get',
  'fetch': 'get',
  'construct': 'build',
  'create': 'build'
};

class QueryProcessor {
  /**
   * Process a raw natural language or identifier query.
   * @param {string} rawQuery 
   * @returns {object} Processed query representation
   */
  static process(rawQuery) {
    if (!rawQuery || typeof rawQuery !== 'string') {
      return {
        rawQuery: '',
        normalizedQuery: '',
        tokens: [],
        terms: [],
        stemmedTerms: [],
        exactCandidateNames: [],
        targetKind: null,
        isEmpty: true
      };
    }

    const trimmed = rawQuery.trim();
    if (!trimmed) {
      return {
        rawQuery,
        normalizedQuery: '',
        tokens: [],
        terms: [],
        stemmedTerms: [],
        exactCandidateNames: [],
        targetKind: null,
        isEmpty: true
      };
    }

    // Detect target kind intent
    const lower = trimmed.toLowerCase();
    let targetKind = null;
    if (/\b(class|classes)\b/.test(lower)) targetKind = 'class';
    else if (/\b(interface|interfaces)\b/.test(lower)) targetKind = 'interface';
    else if (/\b(constructor|constructors)\b/.test(lower)) targetKind = 'constructor';
    else if (/\b(function|functions|method|methods)\b/.test(lower)) targetKind = 'function';

    // Extract exact identifier candidates (tokens with CamelCase, snake_case, dots, or single-word query)
    const rawWordTokens = trimmed.match(/[A-Za-z0-9_$.]+/g) || [];
    const exactCandidateNames = [];
    const isSingleWordQuery = !trimmed.includes(' ') && rawWordTokens.length === 1;

    for (let idx = 0; idx < rawWordTokens.length; idx++) {
      const w = rawWordTokens[idx];
      const cleanW = w.replace(/^[^\w]+|[^\w]+$/g, '');
      if (!cleanW) continue;
      const lowerW = cleanW.toLowerCase();
      if (STOPWORDS.has(lowerW)) continue;

      if (isSingleWordQuery) {
        exactCandidateNames.push(cleanW);
        continue;
      }

      // In multi-word queries, domain nouns (languages, protocols, formats) are not code identifiers
      if (DOMAIN_TERMS.has(lowerW)) continue;

      const isCamel = /[a-z0-9][A-Z]/.test(cleanW);
      const isSnake = cleanW.includes('_') && cleanW.length > 2;
      const hasDot = cleanW.includes('.') && cleanW.length > 3;
      const isPascal = /^[A-Z][a-z0-9]+[A-Z]/.test(cleanW); // At least two humps (e.g. TypeAdapter, ZodMiniType)
      const isQuoted = new RegExp(`['"\`]${cleanW}['"\`]`).test(trimmed);

      if (isCamel || isSnake || hasDot || isPascal || isQuoted) {
        if (!exactCandidateNames.includes(cleanW)) {
          exactCandidateNames.push(cleanW);
        }
      }
    }

    // Split query terms into words and sub-tokens
    const allTokens = [];
    for (const token of rawWordTokens) {
      const subTokens = QueryProcessor.splitIdentifiers(token);
      for (const st of subTokens) {
        if (st.length > 1) {
          allTokens.push(st.toLowerCase());
        }
      }
    }

    // Filter stopwords
    const terms = [];
    for (const t of allTokens) {
      if (!STOPWORDS.has(t) && t.length > 1) {
        if (!terms.includes(t)) {
          terms.push(t);
        }
      }
    }

    // Multi-token compound formation for adjacent prefix + word in sequential query token stream (e.g. 'non' + 'negative' -> 'nonnegative')
    for (let i = 0; i < allTokens.length - 1; i++) {
      const t1 = allTokens[i];
      const t2 = allTokens[i + 1];
      if (COMPOUND_PREFIXES.includes(t1) && t2.length >= 4 && !NON_COMPOUND_WORDS.has(t2) && !STOPWORDS.has(t2)) {
        const compound = t1 + t2;
        if (!terms.includes(compound)) {
          terms.push(compound);
        }
      }
    }

    // Conservative behavioral action synonyms (e.g. 'dispatch' -> 'send')
    const synonymAdditions = [];
    for (const t of terms) {
      const syn = CANONICAL_ACTION_SYNONYMS[t];
      if (syn && !terms.includes(syn) && !synonymAdditions.includes(syn)) {
        synonymAdditions.push(syn);
      }
    }
    for (const syn of synonymAdditions) {
      terms.push(syn);
    }

    // Stem terms
    const stemmedTerms = terms.map(t => QueryProcessor.stem(t));

    // Non-stopword query words (before subtoken splitting)
    const queryWords = rawWordTokens
      .map(w => w.replace(/^[^\w]+|[^\w]+$/g, ''))
      .filter(w => w && !STOPWORDS.has(w.toLowerCase()) && w.length > 1);

    return {
      rawQuery: trimmed,
      normalizedQuery: terms.join(' '),
      tokens: allTokens,
      terms,
      stemmedTerms,
      exactCandidateNames,
      queryWords,
      targetKind,
      isEmpty: terms.length === 0 && exactCandidateNames.length === 0
    };
  }

  /**
   * Split camelCase and snake_case tokens into constituent words.
   * e.g. "validateUserToken" -> ["validate", "User", "Token"]
   * e.g. "process_order_data" -> ["process", "order", "data"]
   */
  static splitIdentifiers(token) {
    if (!token) return [];
    // Split by underscore, dot, dollar, dash
    const parts = token.split(/[_.\-$]+/);
    const result = [];

    for (const p of parts) {
      if (!p) continue;
      // Split camelCase e.g. getUserById -> get, User, By, Id
      const camelParts = p.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
                          .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
                          .split(/\s+/);
      for (const cp of camelParts) {
        if (!cp) continue;
        result.push(cp);

        // Decompose compound prefix if present (e.g. 'nonnegative' -> 'non', 'negative')
        const lower = cp.toLowerCase();
        if (!NON_COMPOUND_WORDS.has(lower)) {
          for (const pfx of COMPOUND_PREFIXES) {
            if (lower.startsWith(pfx) && lower.length >= pfx.length + 4) {
              const base = lower.slice(pfx.length);
              if (!NON_COMPOUND_WORDS.has(base)) {
                result.push(cp.slice(0, pfx.length));
                result.push(cp.slice(pfx.length));
                break;
              }
            }
          }
        }
      }
    }

    return result;
  }

  /**
   * Light morphological suffix reduction / stemming.
   * e.g. "validating" -> "validate", "validates" -> "validate", "uploads" -> "upload"
   */
  static stem(word) {
    if (!word || word.length <= 3) return word;
    let s = word.toLowerCase();

    // Plurals / 3rd person singular
    if (s.endsWith('ies') && s.length > 4) {
      return s.slice(0, -3) + 'y'; // retries -> retry
    }
    if (s.endsWith('es') && (s.endsWith('shes') || s.endsWith('ches') || s.endsWith('sses') || s.endsWith('xes'))) {
      return s.slice(0, -2);
    }
    if (s.endsWith('s') && !s.endsWith('ss') && s.length > 3) {
      return s.slice(0, -1);
    }

    // Participles & gerunds
    if (s.endsWith('ing') && s.length > 5) {
      const base = s.slice(0, -3);
      if (base.endsWith('at') || base.endsWith('iz') || base.endsWith('iv') || base.endsWith('id') || base.endsWith('ut')) {
        return base + 'e'; // updating -> update, validating -> validate
      }
      return base;
    }

    // Past tense
    if (s.endsWith('ed') && s.length > 4) {
      const base = s.slice(0, -2);
      if (base.endsWith('at') || base.endsWith('iz') || base.endsWith('iv') || base.endsWith('id') || base.endsWith('ut')) {
        return base + 'e'; // updated -> update, validated -> validate
      }
      return base;
    }

    // Adverb suffix -ly (e.g. safely -> safe, recursively -> recursive)
    if (s.endsWith('ly') && s.length > 4) {
      if (s.endsWith('fully') || s.endsWith('ically')) {
        s = s.slice(0, -4);
      } else {
        s = s.slice(0, -2);
      }
    }

    // Common code abbreviations
    if (s.startsWith('synchron')) return 'sync';
    if (s.startsWith('asynchron')) return 'async';

    // Common derivations
    if (s.endsWith('ation') && s.length > 6) {
      return s.slice(0, -5) + 'ate'; // validation -> validate, authentication -> authenticate
    }

    return s;
  }
}

module.exports = QueryProcessor;
