const { buildPrompt, formatSources, SYSTEM } = require('../../src/cli/prompt');

const sym = (id, name, file, start, end, source) => ({ id, name, qualifiedName: name, symbolType: 'function', filePath: file, range: { startLine: start, endLine: end }, source });

describe('prompt assembly', () => {
  const ranked = [
    { symbol: sym('a', 'sumLineItems', 'src/billing.js', 4, 11, 'function sumLineItems(items) { return 1; }'), score: 1.2, formerly: { oldName: 'computeCartTotal' } },
    { symbol: sym('b', 'formatCurrency', 'src/billing.js', 13, 15, 'function formatCurrency(a) { return a; }'), score: 0.4, formerly: null }
  ];
  const lineage = { a: [{ oldName: 'computeCartTotal', commit: 'be764814f0b229cfc445e901dd266607ab71646c', date: '2026-10-23', subject: 'Rename computeCartTotal to sumLineItems' }] };

  test('has QUESTION / CURRENT CODE / HISTORICAL EVIDENCE sections in order, with paths and line ranges', () => {
    const p = buildPrompt('what happened to computeCartTotal?', ranked, { k: 5, tokenBudget: 4000, lineage });
    const u = p.user;
    expect(u.indexOf('QUESTION')).toBe(0);
    expect(u.indexOf('CURRENT CODE')).toBeGreaterThan(u.indexOf('what happened to computeCartTotal?'));
    expect(u.indexOf('HISTORICAL EVIDENCE')).toBeGreaterThan(u.indexOf('CURRENT CODE'));
    expect(u).toContain('[1] sumLineItems (function) — src/billing.js:4-11');
    expect(u).toContain('function formatCurrency(a)');
    expect(u).toContain('computeCartTotal → sumLineItems (src/billing.js); commit be764814f0b2, 2026-10-23; "Rename computeCartTotal to sumLineItems"');
  });

  test('system instructions require context-only answers, insufficiency notice, current-vs-former distinction and citations', () => {
    expect(SYSTEM).toMatch(/only from the provided context/i);
    expect(SYSTEM).toMatch(/insufficient/i);
    expect(SYSTEM).toMatch(/former names/i);
    expect(SYSTEM).toMatch(/file paths/i);
  });

  test('respects k and the token budget (ContextBuilder) and reports empty sections explicitly', () => {
    const one = buildPrompt('q', ranked, { k: 1, tokenBudget: 4000, lineage });
    expect(one.context.returnedCount).toBe(1);
    expect(one.user).not.toContain('formatCurrency');
    const none = buildPrompt('q', [], { k: 5 });
    expect(none.user).toContain('(no matching code found)');
    expect(none.user).toContain('(no rename or move history');
  });

  test('sources list file:line and the commit for historical evidence', () => {
    const p = buildPrompt('q', ranked, { k: 5, lineage });
    expect(p.sources).toEqual([
      { file: 'src/billing.js', line: 4, name: 'sumLineItems', commit: 'be764814f0b229cfc445e901dd266607ab71646c' },
      { file: 'src/billing.js', line: 13, name: 'formatCurrency', commit: null }
    ]);
    expect(formatSources(p.sources)).toBe('Sources:\n- src/billing.js:4 (sumLineItems) — history: commit be76481\n- src/billing.js:13 (formatCurrency)');
  });
});
