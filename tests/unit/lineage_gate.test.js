const { extractIdentifiers, rankLineageGate } = require('../../src/retrieval/LineageGate');

describe('extractIdentifiers (ids)', () => {
  test('(a) backtick contents win, with () stripped and the last dotted segment kept', () => {
    expect(extractIdentifiers('Show me the current code for `foo.barBaz()`.')).toEqual(['foo.barBaz', 'barBaz']);
    expect(extractIdentifiers('Show me the current code for `render`.')).toEqual(['render']);
    expect(extractIdentifiers('compare `a_b` with getUser')).toEqual(['a_b']);
  });

  test('(b) identifier-like tokens: camelCase, underscore, dot, trailing ()', () => {
    expect(extractIdentifiers('Where is the function getUserName now?')).toEqual(['getUserName']);
    expect(extractIdentifiers('What happened to parse_args after the refactor?')).toEqual(['parse_args']);
    expect(extractIdentifiers('where did Fiber.isSuspendable() go')).toEqual(['Fiber.isSuspendable', 'isSuspendable']);
    expect(extractIdentifiers('call render() please')).toEqual(['render']);
  });

  test('(c) a single bare token is taken whole; plain words in a sentence are not identifiers', () => {
    expect(extractIdentifiers('render')).toEqual(['render']);
    expect(extractIdentifiers('  getUser  ')).toEqual(['getUser']);
    expect(extractIdentifiers('Where is the function render now?')).toEqual([]);
    expect(extractIdentifiers('')).toEqual([]);
  });

  test('is deterministic and de-duplicates', () => {
    expect(extractIdentifiers('getUser and getUser and a.getUser')).toEqual(['getUser', 'a.getUser']);
    expect(extractIdentifiers('x.y.z')).toEqual(['x.y.z', 'z']);
  });

  test('never throws on non-string input', () => {
    expect(extractIdentifiers(null)).toEqual([]);
    expect(extractIdentifiers(undefined)).toEqual([]);
    expect(extractIdentifiers(42)).toEqual([]);
  });
});

describe('rankLineageGate (G)', () => {
  const sym = id => ({ id, name: id });
  const b1 = [{ symbol: sym('a'), score: 0.9 }, { symbol: sym('b'), score: 0.5 }, { symbol: sym('c'), score: 0.1 }, { symbol: sym('d'), score: 0 }];
  const b2 = [{ symbol: sym('c'), score: 0.8 }, { symbol: sym('d'), score: 0.6 }, { symbol: sym('b'), score: 0 }];
  const profiles = new Map([['c', { historicalNames: ['oldName'] }], ['d', { historicalNames: ['oldName', 'other'] }], ['b', { historicalNames: ['oldName'] }]]);

  test('G == B1 (same array, same order) when L is empty', () => {
    const r1 = rankLineageGate('unrelatedName', b1, b2, profiles);
    expect(r1.lineageMatches).toBe(0);
    expect(r1.ranking).toBe(b1);
    const r2 = rankLineageGate('Where is the function render now?', b1, b2, profiles); // ids() empty
    expect(r2.ranking).toBe(b1);
    const r3 = rankLineageGate('oldName', b1, [], profiles); // no B2 candidates
    expect(r3.ranking).toBe(b1);
  });

  test('L (B2 order, positive B2 score, exact case-sensitive name) comes first, then B1 without L', () => {
    const r = rankLineageGate('oldName', b1, b2, profiles);
    expect(r.lineageMatches).toBe(2); // b has B2 score 0, so it is not in L
    expect(r.ranking.map(x => x.symbol.id)).toEqual(['c', 'd', 'a', 'b']);
    expect(r.ranking[0].score).toBeGreaterThan(r.ranking[1].score);
    expect(r.ranking[1].score).toBeGreaterThan(0.9);
    expect(r.ranking[3].score).toBe(0.5);
    expect(rankLineageGate('oldname', b1, b2, profiles).lineageMatches).toBe(0); // case-sensitive
  });

  test('never throws on missing or malformed inputs', () => {
    expect(() => rankLineageGate(undefined, undefined, undefined, undefined)).not.toThrow();
    expect(rankLineageGate('oldName', null, null, null).ranking).toEqual([]);
    expect(() => rankLineageGate('oldName', b1, [{ symbol: null, score: 1 }, null, { score: 2 }], { get: () => { throw new Error('x'); } })).not.toThrow();
    expect(rankLineageGate('oldName', b1, b2, id => profiles.get(id)).lineageMatches).toBe(2);
  });
});
