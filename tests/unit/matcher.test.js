const FunctionMatcher = require('../../src/matcher/FunctionMatcher');
const SymbolRecord = require('../../src/model/SymbolRecord');

describe('FunctionMatcher Unit Tests', () => {
  const matcher = new FunctionMatcher();

  test('Tier 1: exact source hash returns unchanged match with score 1.0', () => {
    const sym = new SymbolRecord({
      name: 'foo',
      source: 'def foo(): pass',
      filePath: 'a.py'
    });
    const candidate = new SymbolRecord({
      name: 'foo',
      source: 'def foo(): pass',
      filePath: 'a.py'
    });

    const res = matcher.match(sym, [candidate]);
    expect(res.decisionStatus).toBe('exact_match');
    expect(res.changeClassification).toBe('unchanged');
    expect(res.score).toBe(1.0);
    expect(res.selected.id).toBe(candidate.id);
  });

  test('Tier 1: exact name and scope with modified body returns high_confidence modified', () => {
    const sym = new SymbolRecord({
      name: 'compute',
      enclosingScope: ['Service'],
      source: 'compute() { const x = 1; return x * 10; }',
      filePath: 'service.js'
    });
    const candidate = new SymbolRecord({
      name: 'compute',
      enclosingScope: ['Service'],
      source: 'compute() { return 10; }',
      filePath: 'service.js'
    });

    const res = matcher.match(sym, [candidate]);
    expect(res.decisionStatus).toBe('high_confidence');
    expect(res.changeClassification).toBe('modified');
    expect(res.score).toBeGreaterThan(0.9);
  });

  test('Tier 2: renamed function with strong body similarity returns renamed', () => {
    const current = new SymbolRecord({
      name: 'executeTask',
      source: 'function executeTask(ctx, item) { const res = ctx.run(item); return res.ok; }',
      filePath: 'task.js'
    });
    const oldCandidate = new SymbolRecord({
      name: 'runTask',
      source: 'function runTask(ctx, item) { const res = ctx.run(item); return res.ok; }',
      filePath: 'task.js'
    });

    const res = matcher.match(current, [oldCandidate]);
    expect(res.decisionStatus).toBe('high_confidence');
    expect(res.changeClassification).toBe('renamed');
    expect(res.selected.name).toBe('runTask');
  });

  test('Tier 2: moved function to another file returns moved', () => {
    const current = new SymbolRecord({
      name: 'validate',
      source: 'function validate(input) { return input.length > 0; }',
      filePath: 'src/validator/input.js'
    });
    const oldCandidate = new SymbolRecord({
      name: 'validate',
      source: 'function validate(input) { return input.length > 0; }',
      filePath: 'src/legacy/utils.js'
    });

    const res = matcher.match(current, [oldCandidate]);
    expect(res.changeClassification).toBe('moved');
    expect(res.selected.filePath).toBe('src/legacy/utils.js');
  });

  test('Decision Policy: ambiguous candidates explicitly marked as uncertain', () => {
    const current = new SymbolRecord({
      name: 'processPayload',
      source: 'function processPayload(val) { return val.trim(); }',
      filePath: 'app.js'
    });
    // Two old functions that are virtually identical
    const candA = new SymbolRecord({
      name: 'processPayloadA',
      source: 'function processPayloadA(val) { return val.trim(); }',
      filePath: 'app.js'
    });
    const candB = new SymbolRecord({
      name: 'processPayloadB',
      source: 'function processPayloadB(val) { return val.trim(); }',
      filePath: 'app.js'
    });

    const res = matcher.match(current, [candA, candB]);
    expect(res.decisionStatus).toBe('uncertain');
    expect(res.changeClassification).toBe('uncertain');
    expect(res.selected).toBeNull();
    expect(res.rankedAlternatives.length).toBeGreaterThan(1);
    expect(res.evidence.reason).toContain('Ambiguous candidates');
  });

  test('New function in new file is classified as new with no_match status', () => {
    const current = new SymbolRecord({
      name: 'brandNewFunction',
      source: 'def brandNewFunction(): pass',
      filePath: 'new_file.py'
    });

    const res = matcher.match(current, [], { isNewFile: true });
    expect(res.decisionStatus).toBe('no_match');
    expect(res.changeClassification).toBe('new');
    expect(res.selected).toBeNull();
  });
});
