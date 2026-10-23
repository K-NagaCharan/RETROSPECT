const fs = require('fs');
const testFile = 'tests/unit/structural_query.test.js';

const updatedContent = `const QueryProcessor = require('../../src/structural/query/QueryProcessor');

describe('Structural Query Understanding Unit Tests', () => {
  // --- Backward Compatibility Tests ---
  test('handles empty and whitespace-only queries cleanly', () => {
    const q1 = QueryProcessor.process('');
    expect(q1.isEmpty).toBe(true);
    expect(q1.terms).toEqual([]);

    const q2 = QueryProcessor.process('   ');
    expect(q2.isEmpty).toBe(true);
    expect(q2.terms).toEqual([]);

    const qNull = QueryProcessor.process(null);
    expect(qNull.isEmpty).toBe(true);
    expect(qNull.terms).toEqual([]);

    const qUndefined = QueryProcessor.process(undefined);
    expect(qUndefined.isEmpty).toBe(true);
    expect(qUndefined.terms).toEqual([]);
  });

  test('extracts exact identifier candidates (camelCase and snake_case)', () => {
    const q = QueryProcessor.process('Where is validateUserToken and process_order_data located?');
    expect(q.exactCandidateNames).toContain('validateUserToken');
    expect(q.exactCandidateNames).toContain('process_order_data');
  });

  test('splits camelCase and snake_case into subtokens and removes stopwords', () => {
    const q = QueryProcessor.process('Which functions update conversation memory for the user?');
    expect(q.terms).toContain('update');
    expect(q.terms).toContain('conversation');
    expect(q.terms).toContain('memory');
    expect(q.terms).toContain('user');
    // Stopwords like 'which', 'for', 'the' should be absent
    expect(q.terms).not.toContain('which');
    expect(q.terms).not.toContain('for');
    expect(q.terms).not.toContain('the');
  });

  test('performs morphological stemming on verbs and plurals', () => {
    expect(QueryProcessor.stem('validates')).toBe('validate');
    expect(QueryProcessor.stem('validating')).toBe('validate');
    expect(QueryProcessor.stem('retries')).toBe('retry');
    expect(QueryProcessor.stem('connections')).toBe('connection');
    expect(QueryProcessor.stem('internally')).toBe('internal');
  });

  test('detects target kind intent from query phrasing', () => {
    const qClass = QueryProcessor.process('Find the class handling customer payments');
    expect(qClass.targetKind).toBe('class');

    const qInterface = QueryProcessor.process('Show the interface definition for Logger');
    expect(qInterface.targetKind).toBe('interface');

    const qFunc = QueryProcessor.process('Which method calculates the total price?');
    expect(qFunc.targetKind).toBe('function');
  });

  // --- Compound Identifier Decomposition Tests ---
  test('decomposes uncapitalized compound prefixes in identifiers', () => {
    // Guava DIAG-04 pattern: checkNonnegative
    const parts04 = QueryProcessor.splitIdentifiers('checkNonnegative');
    expect(parts04).toContain('check');
    expect(parts04).toContain('Nonnegative');
    expect(parts04.map(p => p.toLowerCase())).toContain('non');
    expect(parts04.map(p => p.toLowerCase())).toContain('negative');

    // Multi-thread pattern
    const partsMulti = QueryProcessor.splitIdentifiers('multithreadedWorker');
    expect(partsMulti.map(p => p.toLowerCase())).toContain('multi');
    expect(partsMulti.map(p => p.toLowerCase())).toContain('threaded');

    // Sub-network pattern
    const partsSub = QueryProcessor.splitIdentifiers('subnetworkRouting');
    expect(partsSub.map(p => p.toLowerCase())).toContain('sub');
    expect(partsSub.map(p => p.toLowerCase())).toContain('network');

    // Pre/Post-process patterns
    const partsPre = QueryProcessor.splitIdentifiers('preprocessPayload');
    expect(partsPre.map(p => p.toLowerCase())).toContain('pre');
    expect(partsPre.map(p => p.toLowerCase())).toContain('process');

    const partsPost = QueryProcessor.splitIdentifiers('postprocessOutput');
    expect(partsPost.map(p => p.toLowerCase())).toContain('post');
    expect(partsPost.map(p => p.toLowerCase())).toContain('process');
  });

  // --- Multiple Query Tokens Matching Compound Identifiers ---
  test('forms compound tokens when query contains adjacent prefix and base words', () => {
    // Hyphenated input e.g. "non-negative"
    const qHyphen = QueryProcessor.process('Check non-negative integer values');
    expect(qHyphen.terms).toContain('non');
    expect(qHyphen.terms).toContain('negative');
    expect(qHyphen.terms).toContain('nonnegative');

    // Spaced input e.g. "non negative"
    const qSpaced = QueryProcessor.process('Check that index is non negative');
    expect(qSpaced.terms).toContain('non');
    expect(qSpaced.terms).toContain('negative');
    expect(qSpaced.terms).toContain('nonnegative');

    // "sub network"
    const qSub = QueryProcessor.process('Prepare road network sub network');
    expect(qSub.terms).toContain('sub');
    expect(qSub.terms).toContain('network');
    expect(qSub.terms).toContain('subnetwork');
  });

  // --- Punctuation and Casing Variations ---
  test('handles punctuation and casing variations consistently', () => {
    const variations = [
      'non-negative',
      'Non-Negative',
      'non_negative',
      'non negative',
      'NON_NEGATIVE'
    ];

    for (const v of variations) {
      const q = QueryProcessor.process(\`Ensure value is \${v} always\`);
      expect(q.terms).toContain('non');
      expect(q.terms).toContain('negative');
      expect(q.terms).toContain('nonnegative');
    }
  });

  // --- Over-splitting Safeguards (Negative Tests) ---
  test('does not over-split non-compound words sharing prefix substrings', () => {
    // False positives should NOT be split into nonsense prefixes/bases
    const testCases = ['unit', 'uncle', 'notice', 'nothing', 'under', 'until', 'union', 'unique', 'auto', 'read'];

    for (const word of testCases) {
      const parts = QueryProcessor.splitIdentifiers(word);
      expect(parts.length).toBe(1);
      expect(parts[0]).toBe(word);
    }

    // Short base words (< 4 chars) should not be split
    const shortBases = ['undo', 'prefix', 'preset'];
    for (const sb of shortBases) {
      const parts = QueryProcessor.splitIdentifiers(sb);
      // e.g. undo has base 'do' (length 2), prefix has base 'fix' (length 3), preset has base 'set' (length 3)
      expect(parts).toEqual([sb]);
    }
  });

  // --- Repeated Tokens and Empty Handling ---
  test('handles repeated tokens and edge cases without duplication', () => {
    const q = QueryProcessor.process('check check non-negative non-negative check');
    // Ensure no redundant duplicate entries in terms
    const nonCount = q.terms.filter(t => t === 'non').length;
    const negCount = q.terms.filter(t => t === 'negative').length;
    const compoundCount = q.terms.filter(t => t === 'nonnegative').length;
    expect(nonCount).toBe(1);
    expect(negCount).toBe(1);
    expect(compoundCount).toBe(1);

    expect(QueryProcessor.splitIdentifiers('')).toEqual([]);
    expect(QueryProcessor.splitIdentifiers(null)).toEqual([]);
    expect(QueryProcessor.splitIdentifiers(undefined)).toEqual([]);
  });

  // --- Conservative Action Synonym Mapping ---
  test('maps conservative action verbs to canonical forms', () => {
    // Undertow DIAG-07 pattern: dispatch -> send
    const qDispatch = QueryProcessor.process('Process and dispatch websocket binary frames');
    expect(qDispatch.terms).toContain('dispatch');
    expect(qDispatch.terms).toContain('send');

    // Checkstyle DIAG-01 pattern: retrieve -> get
    const qRetrieve = QueryProcessor.process('Retrieve logged style violations');
    expect(qRetrieve.terms).toContain('retrieve');
    expect(qRetrieve.terms).toContain('get');

    // Builder pattern: construct -> build
    const qConstruct = QueryProcessor.process('Construct an immutable list builder');
    expect(qConstruct.terms).toContain('construct');
    expect(qConstruct.terms).toContain('build');
  });
});
`;

fs.writeFileSync(testFile, updatedContent, 'utf8');
console.log('Successfully updated tests/unit/structural_query.test.js');
