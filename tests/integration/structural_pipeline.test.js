const path = require('path');
const {
  indexRepository,
  searchCurrentCode,
  getSymbol,
  getRelatedSymbols,
  clearIndexCache
} = require('../../src/structural');
const StructuralEvaluator = require('../../src/evaluation/StructuralEvaluator');

describe('Structural Current-Code Retrieval Integration Pipeline', () => {
  const pythonFixture = path.resolve(__dirname, '../../data/fixtures/eval_repos/python_repo');
  const jsFixture = path.resolve(__dirname, '../../data/fixtures/eval_repos/javascript_repo');

  beforeAll(() => {
    clearIndexCache();
  });

  afterAll(() => {
    clearIndexCache();
  });

  test('indexes repository and searches using programmatic API', async () => {
    const index = await indexRepository(pythonFixture);
    expect(index.symbols.size).toBeGreaterThan(0);

    const res = await searchCurrentCode(pythonFixture, 'Where is user authentication handled?');
    expect(res.results.length).toBeGreaterThan(0);
    expect(res.results[0].name).toBe('authenticate_user');
    expect(res.results[0].source).toContain('def authenticate_user');

    // Retrieve symbol directly by ID
    const symId = res.results[0].symbolId;
    const directSym = await getSymbol(pythonFixture, symId);
    expect(directSym).toBeDefined();
    expect(directSym.name).toBe('authenticate_user');

    // Retrieve related symbols
    const related = await getRelatedSymbols(pythonFixture, symId);
    expect(related.callees.some(c => c.name === 'verify_jwt_token')).toBe(true);
  });

  test('searches JavaScript repository with retry logic query', async () => {
    const res = await searchCurrentCode(jsFixture, 'Where is the retry logic for failed API requests?');
    expect(res.results.length).toBeGreaterThan(0);
    expect(res.results[0].name).toBe('retry_failed_request');
  });

  test('runs automated evaluation harness and checks metric thresholds', async () => {
    const datasetPath = path.resolve(__dirname, '../../data/structural_eval_benchmark.json');
    const evaluator = new StructuralEvaluator();
    const report = await evaluator.runEvaluation(datasetPath, { splitFilter: 'dev' });

    expect(report.totalQueries).toBeGreaterThan(0);
    // Dev split performance sanity checks
    expect(report.overallMetrics.recallAt5).toBeGreaterThanOrEqual(0.70);
    expect(report.overallMetrics.mrr).toBeGreaterThanOrEqual(0.60);
    expect(report.latencyStats.meanLatencyMs).toBeLessThan(100);
  });
});
