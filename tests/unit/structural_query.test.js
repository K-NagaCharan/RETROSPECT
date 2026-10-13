const QueryProcessor = require('../../src/structural/query/QueryProcessor');

describe('Structural Query Understanding Unit Tests', () => {
  test('handles empty and whitespace-only queries cleanly', () => {
    const q1 = QueryProcessor.process('');
    expect(q1.isEmpty).toBe(true);
    expect(q1.terms).toEqual([]);

    const q2 = QueryProcessor.process('   ');
    expect(q2.isEmpty).toBe(true);
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
  });

  test('detects target kind intent from query phrasing', () => {
    const qClass = QueryProcessor.process('Find the class handling customer payments');
    expect(qClass.targetKind).toBe('class');

    const qInterface = QueryProcessor.process('Show the interface definition for Logger');
    expect(qInterface.targetKind).toBe('interface');

    const qFunc = QueryProcessor.process('Which method calculates the total price?');
    expect(qFunc.targetKind).toBe('function');
  });
});
