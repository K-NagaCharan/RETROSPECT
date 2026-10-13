const HistoricalRetrievalAdapter = require('../../src/retrieval/HistoricalRetrievalAdapter');
const QueryProcessor = require('../../src/structural/query/QueryProcessor');

describe('HistoricalRetrievalAdapter Unit Tests', () => {
  let adapter;

  beforeEach(() => {
    adapter = new HistoricalRetrievalAdapter();
  });

  test('Verified Rename: retrieves current symbol via query targeting previous name', () => {
    const profile = adapter.buildSymbolHistoryProfile({
      currentSymbol: { name: 'processSchema', filePath: 'packages/zod/src/v4/core/to-json-schema.ts' },
      predecessorSymbol: { name: 'process', filePath: 'packages/zod/src/v4/core/to-json-schema.ts' },
      commitMessage: 'Rename the JSON Schema process helper so bundler polyfills cannot collide',
      diffText: '-export function process(schema: core.$ZodType)\n+export function processSchema(schema: core.$ZodType)',
      evolutionType: 'rename',
      confidence: 'certain'
    });

    const query = QueryProcessor.process('find JSON schema process helper function');
    const result = adapter.scoreHistorical(query, profile);

    expect(result.score).toBeGreaterThan(0.3);
    expect(result.breakdown.historicalName).toBeGreaterThan(0);
    expect(result.breakdown.commitMessage).toBeGreaterThan(0);
    expect(result.reasons.some(r => r.includes("'process'"))).toBe(true);
  });

  test('Verified Move: retrieves relocated method via cross-file lineage', () => {
    const profile = adapter.buildSymbolHistoryProfile({
      currentSymbol: { name: 'checkValidFloatingPoint', filePath: 'gson/src/main/java/com/google/gson/internal/bind/TypeAdapters.java' },
      predecessorSymbol: { name: 'checkValidFloatingPoint', filePath: 'gson/src/main/java/com/google/gson/Gson.java' },
      commitMessage: 'refactor: move derived adapters from Gson to TypeAdapters',
      diffText: '-  static void checkValidFloatingPoint(double value) {\n+  private static void checkValidFloatingPoint(double value) {',
      evolutionType: 'move',
      confidence: 'certain'
    });

    const query = QueryProcessor.process('floating point validation logic moved from Gson');
    const result = adapter.scoreHistorical(query, profile);

    expect(result.score).toBeGreaterThan(0.2);
    expect(result.breakdown.commitMessage).toBeGreaterThan(0);
  });

  test('Substantial Rewrite: retrieves symbol matching algorithm changes in diff and commit message', () => {
    const profile = adapter.buildSymbolHistoryProfile({
      currentSymbol: { name: 'validate', filePath: 'packages/zod/src/v4/core/schemas.ts' },
      predecessorSymbol: { name: 'validate', filePath: 'packages/zod/src/v4/core/schemas.ts' },
      commitMessage: 'perf(v4): settle z.validate on the first failure in parse order',
      diffText: '+  if (ctx?.abortEarly && payload.issues.length) return payload;',
      evolutionType: 'rewrite',
      confidence: 'certain'
    });

    const query = QueryProcessor.process('parse loop early exit on first failure');
    const result = adapter.scoreHistorical(query, profile);

    expect(result.score).toBeGreaterThan(0.15);
    expect(result.breakdown.commitMessage).toBeGreaterThan(0);
  });

  test('Routine Modification: low diff impact scores accordingly', () => {
    const profile = adapter.buildSymbolHistoryProfile({
      currentSymbol: { name: '__repr__', filePath: 'bottle.py' },
      predecessorSymbol: { name: '__repr__', filePath: 'bottle.py' },
      commitMessage: 'Format options dictionary with %r string interpolation',
      diffText: '- args = ", ".join("%s=%s" % (k, repr(v)))\n+ args = ", ".join("%s=%r" % kv)',
      evolutionType: 'routine_modification',
      confidence: 'certain'
    });

    const query = QueryProcessor.process('string interpolation options representation');
    const result = adapter.scoreHistorical(query, profile);

    expect(result.score).toBeGreaterThan(0.1);
  });

  test('New Symbol: newly introduced symbol with no predecessor produces zero historical name score', () => {
    const profile = adapter.buildSymbolHistoryProfile({
      currentSymbol: { name: 'currencyCode', filePath: 'packages/zod/src/v4/classic/schemas.ts' },
      predecessorSymbol: null,
      commitMessage: 'feat: add z.currencyCode() over a vendored ISO 4217 list',
      diffText: '+export const currencyCode = ...',
      evolutionType: 'new_symbol',
      confidence: 'certain'
    });

    const query = QueryProcessor.process('old currency code validation');
    const result = adapter.scoreHistorical(query, profile);

    expect(result.breakdown.historicalName).toBe(0.0);
    expect(profile.historicalNames.length).toBe(0);
  });

  test('Hard Negative: unrelated sibling candidate is not matched on predecessor names', () => {
    const profile = adapter.buildSymbolHistoryProfile({
      currentSymbol: { name: 'checkArgument', filePath: 'gson/src/main/java/com/google/gson/internal/GsonPreconditions.java' },
      predecessorSymbol: { name: 'checkNotNull', filePath: 'gson/src/main/java/com/google/gson/internal/GsonPreconditions.java' },
      commitMessage: 'Remove GsonPreconditions#checkNotNull',
      diffText: '- public static <T> T checkNotNull(T obj) {',
      evolutionType: 'hard_negative',
      confidence: 'certain'
    });

    // Query asking about argument condition validation without matching null
    const query = QueryProcessor.process('boolean predicate condition validation failure');
    const result = adapter.scoreHistorical(query, profile);

    // Historical name 'checkNotNull' does not match predicate condition query
    expect(result.breakdown.historicalName).toBe(0.0);
  });

  test('Ambiguous Lineage: applies confidence discount when tracking is uncertain', () => {
    const certainProfile = adapter.buildSymbolHistoryProfile({
      currentSymbol: { name: 'render', filePath: 'lib/application.js' },
      predecessorSymbol: { name: 'render', filePath: 'lib/application.js' },
      commitMessage: 'Allow null or undefined options',
      confidence: 'certain'
    });

    const uncertainProfile = adapter.buildSymbolHistoryProfile({
      currentSymbol: { name: 'render', filePath: 'lib/application.js' },
      predecessorSymbol: { name: 'render', filePath: 'lib/application.js' },
      commitMessage: 'Allow null or undefined options',
      confidence: 'uncertain'
    });

    const query = QueryProcessor.process('render options undefined');
    const certainRes = adapter.scoreHistorical(query, certainProfile);
    const uncertainRes = adapter.scoreHistorical(query, uncertainProfile);

    expect(certainRes.score).toBeGreaterThan(uncertainRes.score);
    expect(uncertainRes.breakdown.confidenceMultiplier).toBe(0.65);
  });

  test('Missing History: empty history profile yields zero score gracefully', () => {
    const emptyProfile = adapter.buildSymbolHistoryProfile({
      currentSymbol: { name: 'unknownFunc', filePath: 'src/main.js' }
    });

    const query = QueryProcessor.process('refactor previous implementation');
    const result = adapter.scoreHistorical(query, emptyProfile);

    expect(result.score).toBe(0.0);
    expect(result.reasons.length).toBe(0);
  });

  test('Ablation Isolation: isolated signals evaluate strictly independently', () => {
    const profile = adapter.buildSymbolHistoryProfile({
      currentSymbol: { name: 'newMethod', filePath: 'service.ts' },
      predecessorSymbol: { name: 'legacyHelper', filePath: 'service.ts' },
      commitMessage: 'refactor database connection pool timeout logic',
      diffText: '+ const poolTimeout = config.timeout || 5000;',
      evolutionType: 'rename'
    });

    const query = QueryProcessor.process('legacyHelper pool timeout');

    // Names only: should match legacyHelper, ignore pool timeout in commit/diff
    const namesOnly = adapter.scoreHistorical(query, profile, { namesOnly: true });
    expect(namesOnly.breakdown.commitMessage).toBe(0.0);
    expect(namesOnly.breakdown.diffTerms).toBe(0.0);
    expect(namesOnly.score).toBe(namesOnly.breakdown.historicalName);

    // Commit messages only: should match pool timeout, ignore legacyHelper
    const commitOnly = adapter.scoreHistorical(query, profile, { commitMessagesOnly: true });
    expect(commitOnly.breakdown.historicalName).toBe(0.0);
    expect(commitOnly.score).toBe(commitOnly.breakdown.commitMessage);

    // Diff terms only: should match poolTimeout/timeout, ignore legacyHelper
    const diffOnly = adapter.scoreHistorical(query, profile, { diffTermsOnly: true });
    expect(diffOnly.breakdown.historicalName).toBe(0.0);
    expect(diffOnly.score).toBe(diffOnly.breakdown.diffTerms);
  });

  test('Linear Fusion: combines structural and historical scores with defined weights', () => {
    const structScore = 0.80;
    const histScore = 0.60;
    const combined = HistoricalRetrievalAdapter.fuseScores(structScore, histScore, { structural: 0.65, historical: 0.35 });

    // 0.80 * 0.65 + 0.60 * 0.35 = 0.52 + 0.21 = 0.73
    expect(combined).toBeCloseTo(0.73, 2);
  });
});
