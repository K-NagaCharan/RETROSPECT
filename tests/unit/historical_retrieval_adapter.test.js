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

  describe('Transitive Historical Lineage Stitching', () => {
    test('Two-step rename (A -> B -> C): inherits names, commit messages, and diff tokens across multiple renames', () => {
      const currentSymbol = { id: 'symC', name: 'parseConfig', filePath: 'src/config.js' };
      const evolutionMap = new Map();

      // C (childCommit c3, parentCommit c2): renamed from B
      evolutionMap.set('src/config.js::parseConfig', [{
        childCommit: 'c3',
        parentCommit: 'c2',
        commitMessage: 'refactor: rename loadConfig to parseConfig',
        changeClassification: 'renamed',
        predecessorSymbol: { name: 'loadConfig', filePath: 'src/config.js', qualifiedName: 'loadConfig' },
        confidence: 'high_confidence',
        diffText: '-function loadConfig()\n+function parseConfig()',
        normPath: 'src/config.js'
      }]);

      // B (childCommit c2, parentCommit c1): renamed from A
      evolutionMap.set('src/config.js::loadConfig', [{
        childCommit: 'c2',
        parentCommit: 'c1',
        commitMessage: 'refactor: rename readConfig to loadConfig and add yaml support',
        changeClassification: 'renamed',
        predecessorSymbol: { name: 'readConfig', filePath: 'src/config.js', qualifiedName: 'readConfig' },
        confidence: 'high_confidence',
        diffText: '-function readConfig()\n+function loadConfig()',
        normPath: 'src/config.js'
      }]);

      // A (childCommit c1, parentCommit c0): modification to original implementation
      evolutionMap.set('src/config.js::readConfig', [{
        childCommit: 'c1',
        parentCommit: 'c0',
        commitMessage: 'feat: initial json config parser implementation',
        changeClassification: 'modified',
        predecessorSymbol: { name: 'readConfig', filePath: 'src/config.js', qualifiedName: 'readConfig' },
        confidence: 'exact_match',
        diffText: '+function readConfig(path) { return JSON.parse(readFileSync(path)); }',
        normPath: 'src/config.js'
      }]);

      const commitIndexMap = new Map([['c3', 0], ['c2', 1], ['c1', 2], ['c0', 3]]);
      const records = adapter.stitchLineage(currentSymbol, evolutionMap, commitIndexMap);

      // Verify all 3 ancestor steps are traversed in reverse-chronological order
      expect(records.length).toBe(3);
      expect(records[0].childCommit).toBe('c3');
      expect(records[1].childCommit).toBe('c2');
      expect(records[2].childCommit).toBe('c1');

      // Accumulate into historical profile
      const historicalNames = new Set();
      const commitMessages = [];
      const diffSnippets = [];
      for (const rec of records) {
        if (rec.predecessorSymbol?.name) historicalNames.add(rec.predecessorSymbol.name);
        if (rec.commitMessage) commitMessages.push(rec.commitMessage);
        if (rec.diffText) diffSnippets.push(rec.diffText);
      }

      // Historical names must include both immediate (B) and transitive (A) predecessors
      expect(historicalNames.has('loadConfig')).toBe(true);
      expect(historicalNames.has('readConfig')).toBe(true);

      const profile = {
        currentSymbolName: currentSymbol.name,
        currentFilePath: currentSymbol.filePath,
        historicalNames: Array.from(historicalNames),
        historicalQualifiedNames: Array.from(historicalNames),
        commitMessage: commitMessages.join('\n'),
        commitTerms: HistoricalRetrievalAdapter.extractTerms(commitMessages.join('\n')),
        diffText: diffSnippets.join('\n'),
        diffTerms: HistoricalRetrievalAdapter.extractTerms(diffSnippets.join('\n')),
        historicalDocstrings: [],
        docstringTerms: { tokens: [], stems: [] },
        evolutionType: records[0].changeClassification,
        confidence: 'certain',
        historyDepth: records.length
      };

      // Query targeting the earliest ancestor name 'readConfig'
      const queryName = QueryProcessor.process('find readConfig helper');
      const scoreName = adapter.scoreHistorical(queryName, profile);
      expect(scoreName.score).toBeGreaterThan(0.35);
      expect(scoreName.breakdown.historicalName).toBeGreaterThan(0);

      // Query targeting diff terms from commit c1 ('readfilesync', 'json')
      const queryDiff = QueryProcessor.process('readfilesync json parse logic');
      const scoreDiff = adapter.scoreHistorical(queryDiff, profile);
      expect(scoreDiff.score).toBeGreaterThan(0.20);
      expect(scoreDiff.breakdown.diffTerms).toBeGreaterThan(0);
    });

    test('Cross-file move followed by another change: chains through file relocation and preserves earlier diffs', () => {
      const currentSymbol = { id: 'vp', name: 'validatePayload', filePath: 'src/core/schema.js' };
      const evolutionMap = new Map();

      // Recent modification in new file (c3 -> c2)
      // File move from legacy path to core path (c2 -> c1)
      evolutionMap.set('src/core/schema.js::validatePayload', [
        {
          childCommit: 'c3',
          parentCommit: 'c2',
          commitMessage: 'fix: handle empty arrays in schema validation',
          changeClassification: 'modified',
          predecessorSymbol: { name: 'validatePayload', filePath: 'src/core/schema.js' },
          confidence: 'exact_match',
          diffText: '+ if (Array.isArray(x) && !x.length) return false;',
          normPath: 'src/core/schema.js'
        },
        {
          childCommit: 'c2',
          parentCommit: 'c1',
          commitMessage: 'refactor: relocate validator from legacy directory to core schema',
          changeClassification: 'moved',
          predecessorSymbol: { name: 'validatePayload', filePath: 'src/legacy/validator.js' },
          confidence: 'high_confidence',
          diffText: '- export function validatePayload\n+ export function validatePayload',
          normPath: 'src/core/schema.js'
        }
      ]);

      // Earlier change in legacy file (c1 -> c0)
      evolutionMap.set('src/legacy/validator.js::validatePayload', [
        {
          childCommit: 'c1',
          parentCommit: 'c0',
          commitMessage: 'perf: optimize regex pattern in legacy validator',
          changeClassification: 'modified',
          predecessorSymbol: { name: 'validatePayload', filePath: 'src/legacy/validator.js' },
          confidence: 'exact_match',
          diffText: '- const regex = /[a-z]/g;\n+ const regex = /^[a-z]+$/;',
          normPath: 'src/legacy/validator.js'
        }
      ]);

      const commitIndexMap = new Map([['c3', 0], ['c2', 1], ['c1', 2], ['c0', 3]]);
      const records = adapter.stitchLineage(currentSymbol, evolutionMap, commitIndexMap);

      expect(records.length).toBe(3);
      expect(records[0].childCommit).toBe('c3');
      expect(records[1].childCommit).toBe('c2');
      expect(records[2].childCommit).toBe('c1');

      // Diff snippets from both the new file and the legacy file should be present
      const allDiffs = records.map(r => r.diffText).join('\n');
      const diffTerms = HistoricalRetrievalAdapter.extractTerms(allDiffs);
      expect(diffTerms.tokens).toContain('array');
      expect(diffTerms.tokens).toContain('regex');
    });

    test('Broken predecessor chain: stops cleanly at root or missing predecessor without errors', () => {
      const currentSymbol = { id: 'stream', name: 'transformStream', filePath: 'src/stream.js' };
      const evolutionMap = new Map();

      evolutionMap.set('src/stream.js::transformStream', [
        {
          childCommit: 'c2',
          parentCommit: 'c1',
          commitMessage: 'refactor stream buffering',
          changeClassification: 'modified',
          predecessorSymbol: { name: 'transformStream', filePath: 'src/stream.js' },
          confidence: 'exact_match',
          diffText: '+ buffer.flush();',
          normPath: 'src/stream.js'
        },
        {
          childCommit: 'c1',
          parentCommit: 'c0',
          commitMessage: 'feat: add transformStream helper',
          changeClassification: 'new',
          predecessorSymbol: null, // Origin reached
          confidence: 'certain',
          diffText: '+ function transformStream() {}',
          normPath: 'src/stream.js'
        }
      ]);

      const commitIndexMap = new Map([['c2', 0], ['c1', 1], ['c0', 2]]);
      const records = adapter.stitchLineage(currentSymbol, evolutionMap, commitIndexMap);

      expect(records.length).toBe(2);
      expect(records[1].predecessorSymbol).toBeNull();
    });

    test('Ambiguous predecessor chain: applies uncertainty discount and halts speculative ancestor traversal', () => {
      const currentSymbol = { id: 'route', name: 'dispatchRoute', filePath: 'src/router.js' };
      const evolutionMap = new Map();

      // Recent modification
      // Followed by an uncertain / ambiguous rename where matcher could not disambiguate
      evolutionMap.set('src/router.js::dispatchRoute', [
        {
          childCommit: 'c3',
          parentCommit: 'c2',
          commitMessage: 'fix: async next handling',
          changeClassification: 'modified',
          predecessorSymbol: { name: 'dispatchRoute', filePath: 'src/router.js' },
          confidence: 'certain',
          diffText: '+ await next();',
          normPath: 'src/router.js'
        },
        {
          childCommit: 'c2',
          parentCommit: 'c1',
          commitMessage: 'refactor: ambiguous rewrite of dispatch logic',
          changeClassification: 'uncertain',
          predecessorSymbol: { name: 'handleOldRoute', filePath: 'src/router.js' },
          confidence: 'uncertain', // Ambiguity policy
          diffText: '- handleOldRoute\n+ dispatchRoute',
          normPath: 'src/router.js'
        }
      ]);

      // Speculative ancestor that should NOT be traversed due to uncertain link
      evolutionMap.set('src/router.js::handleOldRoute', [
        {
          childCommit: 'c1',
          parentCommit: 'c0',
          commitMessage: 'unrelated speculative ancestor',
          changeClassification: 'modified',
          predecessorSymbol: { name: 'handleOldRoute', filePath: 'src/router.js' },
          confidence: 'certain',
          diffText: '+ speculative();',
          normPath: 'src/router.js'
        }
      ]);

      const commitIndexMap = new Map([['c3', 0], ['c2', 1], ['c1', 2], ['c0', 3]]);
      const records = adapter.stitchLineage(currentSymbol, evolutionMap, commitIndexMap);

      // Traversal stops at the uncertain link (c2), so speculative ancestor (c1) is excluded
      expect(records.length).toBe(2);
      expect(records[1].confidence).toBe('uncertain');

      // Lowest confidence flag is propagated
      let lowestConfidence = 'certain';
      for (const rec of records) {
        if (rec.confidence === 'uncertain' || rec.changeClassification === 'uncertain') {
          lowestConfidence = 'uncertain';
        }
      }
      expect(lowestConfidence).toBe('uncertain');
    });

    test('Regression test: single-hop rename behavior remains strictly preserved', () => {
      const currentSymbol = { id: 'p', name: 'printFormatted', filePath: 'src/printer.js' };
      const evolutionMap = new Map();

      evolutionMap.set('src/printer.js::printFormatted', [{
        childCommit: 'c1',
        parentCommit: 'c0',
        commitMessage: 'rename formatOutput to printFormatted',
        changeClassification: 'renamed',
        predecessorSymbol: { name: 'formatOutput', filePath: 'src/printer.js' },
        confidence: 'high_confidence',
        diffText: '-function formatOutput()\n+function printFormatted()',
        normPath: 'src/printer.js'
      }]);

      const commitIndexMap = new Map([['c1', 0], ['c0', 1]]);
      const records = adapter.stitchLineage(currentSymbol, evolutionMap, commitIndexMap);

      expect(records.length).toBe(1);
      expect(records[0].predecessorSymbol.name).toBe('formatOutput');
      expect(records[0].changeClassification).toBe('renamed');
    });
  });
});
