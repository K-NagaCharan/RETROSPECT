/**
 * tests/evaluation/new_evaluator.test.js
 *
 * Comprehensive automated test suite for the rebuilt Retrospect benchmark evaluator harness.
 * Tests:
 * 1. SplitGuard discipline (protection of sealed test_confirmatory split).
 * 2. BenchmarkCaseLoader (canonical & legacy schema, valid, malformed, missing targets/repos/pins).
 * 3. ClusterBootstrap (cluster grouping, bootstrap resampling, paired differences, small cluster warnings).
 * 4. 3-Stage Historical Evaluation (Stage A Reachability, Stage B Detection, Stage C Ranking).
 * 5. Latency Measurement Boundary (standardized timing breakdown and common query boundary).
 * 6. Target Matching (name, path, parameter matching without internal IDs).
 */

const fs = require('fs');
const path = require('path');
const { SplitGuard, SplitGuardViolationError } = require('../../src/evaluation/SplitGuard');
const BenchmarkCaseLoader = require('../../src/evaluation/BenchmarkCaseLoader');
const ClusterBootstrap = require('../../src/evaluation/ClusterBootstrap');
const RetrospectEvaluator = require('../../src/evaluation/RetrospectEvaluator');

describe('Retrospect Evaluator Preparation — Test Suite', () => {
  // =========================================================================
  // 1. SPLIT GUARD DISCIPLINE TESTS
  // =========================================================================
  describe('SplitGuard Discipline', () => {
    test('Allows development and validation split cases by default', () => {
      const devCase = { case_id: 'DEV-001', split: 'dev' };
      const valCase = { case_id: 'VAL-001', split: 'val' };

      expect(() => SplitGuard.validateCase(devCase)).not.toThrow();
      expect(() => SplitGuard.validateCase(valCase)).not.toThrow();
    });

    test('Throws SplitGuardViolationError when encountering test_confirmatory without override', () => {
      const testCase = { case_id: 'SEALED-TEST-001', split: 'test_confirmatory' };

      expect(() => SplitGuard.validateCase(testCase)).toThrow(SplitGuardViolationError);
      expect(() => SplitGuard.validateCase(testCase, { allowSealedTest: false })).toThrow(
        /Attempted to evaluate sealed case/
      );
    });

    test('Allows test_confirmatory split when allowSealedTest is explicitly true', () => {
      const testCase = { case_id: 'SEALED-TEST-001', split: 'test_confirmatory' };

      expect(() => SplitGuard.validateCase(testCase, { allowSealedTest: true })).not.toThrow();
    });

    test('Filters case list, partitioning allowed cases and rejected sealed cases', () => {
      const mixedCases = [
        { case_id: 'C1', split: 'dev' },
        { case_id: 'C2', split: 'test_confirmatory' },
        { case_id: 'C3', split: 'val' },
        { case_id: 'C4', split: 'test_confirmatory' }
      ];

      const { allowed, rejected } = SplitGuard.filterAllowedCases(mixedCases, { allowSealedTest: false });
      expect(allowed.length).toBe(2);
      expect(rejected.length).toBe(2);
      expect(allowed.map(c => c.case_id)).toEqual(['C1', 'C3']);
      expect(rejected.map(r => r.case_id)).toEqual(['C2', 'C4']);
    });
  });

  // =========================================================================
  // 2. BENCHMARK CASE LOADER TESTS
  // =========================================================================
  describe('BenchmarkCaseLoader', () => {
    const validCanonicalCase = {
      case_id: 'CASE-TEST-001',
      repo: 'google/guava',
      pin_sha: 'db74bd2fdac443223d45e6fc5c66548542be1081',
      query: 'Construct an immutable list builder with preallocated capacity',
      target: {
        file_path: 'guava/src/com/google/common/collect/ImmutableList.java',
        symbol_name: 'ImmutableList.builder',
        parameter_types: [],
        line_span: [735, 737]
      },
      decoys: [
        {
          file_path: 'guava/src/com/google/common/collect/ImmutableSet.java',
          symbol_name: 'ImmutableSet.builder',
          distractor_type: 'same_file_adjacent',
          distractor_rationale: 'Builder for set rather than list'
        }
      ],
      category: 'historical_evolution',
      language: 'Java',
      origin_commit: '1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d',
      commit_distance_origin_to_pin: 25,
      contains_historical_identifier: false,
      split: 'dev'
    };

    test('Loads and validates valid canonical case without git check', () => {
      const loader = new BenchmarkCaseLoader({ verifyGitTree: false });
      const result = loader.load([validCanonicalCase]);

      expect(result.validCases.length).toBe(1);
      expect(result.excludedCases.length).toBe(0);
      expect(result.validCases[0].case_id).toBe('CASE-TEST-001');
      expect(result.validCases[0].repo).toBe('google/guava');
    });

    test('Rejects malformed case: missing target specification', () => {
      const badCase = { ...validCanonicalCase, target: null };
      const loader = new BenchmarkCaseLoader({ verifyGitTree: false });
      const result = loader.load([badCase]);

      expect(result.validCases.length).toBe(0);
      expect(result.excludedCases.length).toBe(1);
      expect(result.excludedCases[0].reason).toMatch(/Missing 'target' specification/);
    });

    test('Rejects malformed case: invalid pin SHA length or characters', () => {
      const badCase = { ...validCanonicalCase, pin_sha: 'invalid_sha_123' };
      const loader = new BenchmarkCaseLoader({ verifyGitTree: false });
      const result = loader.load([badCase]);

      expect(result.validCases.length).toBe(0);
      expect(result.excludedCases.length).toBe(1);
      expect(result.excludedCases[0].reason).toMatch(/Invalid 'pin_sha'/);
    });

    test('Rejects malformed case: missing repository slug', () => {
      const badCase = { ...validCanonicalCase, repo: '' };
      const loader = new BenchmarkCaseLoader({ verifyGitTree: false });
      const result = loader.load([badCase]);

      expect(result.validCases.length).toBe(0);
      expect(result.excludedCases.length).toBe(1);
      expect(result.excludedCases[0].reason).toMatch(/Missing or invalid 'repo'/);
    });

    test('Rejects malformed case: missing decoys/distractors', () => {
      const badCase = { ...validCanonicalCase, decoys: [] };
      const loader = new BenchmarkCaseLoader({ verifyGitTree: false });
      const result = loader.load([badCase]);

      expect(result.validCases.length).toBe(0);
      expect(result.excludedCases.length).toBe(1);
      expect(result.excludedCases[0].reason).toMatch(/must define at least one valid distractor/);
    });

    test('Rejects malformed case: invalid line_span (start > end or non-array)', () => {
      const badCase = {
        ...validCanonicalCase,
        target: { ...validCanonicalCase.target, line_span: [500, 200] }
      };
      const loader = new BenchmarkCaseLoader({ verifyGitTree: false });
      const result = loader.load([badCase]);

      expect(result.validCases.length).toBe(0);
      expect(result.excludedCases.length).toBe(1);
      expect(result.excludedCases[0].reason).toMatch(/Target 'line_span' must be a 2-element array/);
    });

    test('Normalizes legacy benchmark schema fields into canonical schema', () => {
      const legacyRaw = {
        case_id: 'LEGACY-001',
        repository_id: 'checkstyle/checkstyle',
        source_revision_sha: '1111111111111111111111111111111111111111',
        query: { query_text: 'Extract coordinate accessor from token structure' },
        target_symbols: [
          {
            symbol_name: 'FileContents.getLine',
            file_path: 'src/main/java/FileContents.java',
            line_range: [100, 110]
          }
        ],
        hard_negatives: [
          {
            symbol_name: 'FileContents.getLines',
            file_path: 'src/main/java/FileContents.java',
            distractor_type: 'same_file_adjacent'
          }
        ],
        target_language: 'Java',
        commit_distance: 14,
        contains_historical_identifier: true,
        split: 'val'
      };

      const loader = new BenchmarkCaseLoader({ verifyGitTree: false });
      const norm = loader.normalizeCase(legacyRaw);

      expect(norm.case_id).toBe('LEGACY-001');
      expect(norm.repo).toBe('checkstyle/checkstyle');
      expect(norm.pin_sha).toBe('1111111111111111111111111111111111111111');
      expect(norm.query).toBe('Extract coordinate accessor from token structure');
      expect(norm.target.symbol_name).toBe('FileContents.getLine');
      expect(norm.target.line_span).toEqual([100, 110]);
      expect(norm.decoys.length).toBe(1);
      expect(norm.commit_distance_origin_to_pin).toBe(14);
      expect(norm.contains_historical_identifier).toBe(true);
      expect(norm.split).toBe('val');
    });

    test('Excludes non-existent repository when verifyGitTree is enabled', () => {
      const loader = new BenchmarkCaseLoader({
        clonesDir: 'D:/non_existent_clones_directory_test',
        verifyGitTree: true
      });
      const result = loader.load([validCanonicalCase]);

      expect(result.validCases.length).toBe(0);
      expect(result.excludedCases.length).toBe(1);
      expect(result.excludedCases[0].reason).toMatch(/Repository clone not found/);
    });

    test('Resolves hyphenated repository clone directory names (e.g. datastax-java-driver for datastax/java-driver)', () => {
      const loader = new BenchmarkCaseLoader({ clonesDir: 'D:/clones' });
      const resolved = loader.resolveRepoPath('datastax/java-driver');
      expect(resolved).not.toBeNull();
      expect(resolved.replace(/\\/g, '/')).toMatch(/datastax-java-driver$/);
    });
  });

  // =========================================================================
  // 3. CLUSTER BOOTSTRAP RESAMPLING TESTS
  // =========================================================================
  describe('ClusterBootstrap Resampling', () => {
    // Synthetic dataset of 6 cases across 3 origin-commit clusters
    // Cluster 1 (origin A): 2 cases, both hit top-10
    // Cluster 2 (origin B): 2 cases, 1 hit, 1 miss
    // Cluster 3 (origin C): 2 cases, both miss
    const cases = [
      { case_id: 'C1', origin_commit: 'ORIGIN-A', target_rank: 1, target_score: 0.95 },
      { case_id: 'C2', origin_commit: 'ORIGIN-A', target_rank: 3, target_score: 0.85 },
      { case_id: 'C3', origin_commit: 'ORIGIN-B', target_rank: 5, target_score: 0.70 },
      { case_id: 'C4', origin_commit: 'ORIGIN-B', target_rank: 15, target_score: 0.40 },
      { case_id: 'C5', origin_commit: 'ORIGIN-C', target_rank: null, target_score: 0.0 },
      { case_id: 'C6', origin_commit: 'ORIGIN-C', target_rank: 25, target_score: 0.30 }
    ];

    test('Correctly groups cases by origin_commit cluster', () => {
      const clusters = ClusterBootstrap.buildClusters(cases);
      expect(clusters.size).toBe(3);
      expect(clusters.get('ORIGIN-A').length).toBe(2);
      expect(clusters.get('ORIGIN-B').length).toBe(2);
      expect(clusters.get('ORIGIN-C').length).toBe(2);
    });

    test('Calculates metrics accurately on original sample', () => {
      // Success@10: 3 hits out of 6 = 0.50
      expect(ClusterBootstrap.METRICS['success@10'](cases)).toBeCloseTo(0.50, 4);

      // Recall@1: 1 hit out of 6 = 0.1667
      expect(ClusterBootstrap.METRICS['recall@1'](cases)).toBeCloseTo(1 / 6, 4);

      // Recall@5: 3 hits out of 6 = 0.50
      expect(ClusterBootstrap.METRICS['recall@5'](cases)).toBeCloseTo(0.50, 4);

      // MRR: (1/1 + 1/3 + 1/5 + 1/15 + 0 + 1/25) / 6
      const expectedMRR = (1.0 + 1 / 3 + 1 / 5 + 1 / 15 + 0.0 + 1 / 25) / 6;
      expect(ClusterBootstrap.METRICS['mrr'](cases)).toBeCloseTo(expectedMRR, 4);

      // Abstention rate: 1 abstention (C5) out of 6 = 1/6
      expect(ClusterBootstrap.METRICS['abstention_rate'](cases)).toBeCloseTo(1 / 6, 4);
    });

    test('Generates reproducible 95% bootstrap confidence interval with fixed seed', () => {
      const boot = ClusterBootstrap.bootstrap(cases, 'success@10', {
        replicates: 500,
        confidence: 0.95,
        seed: 42
      });

      expect(boot.observed).toBeCloseTo(0.50, 2);
      expect(boot.ci_lower).toBeGreaterThanOrEqual(0.0);
      expect(boot.ci_upper).toBeLessThanOrEqual(1.0);
      expect(boot.ci_lower).toBeLessThanOrEqual(boot.observed);
      expect(boot.ci_upper).toBeGreaterThanOrEqual(boot.observed);
      expect(boot.cluster_count).toBe(3);
      expect(boot.warning).toMatch(/too small for asymptotic bootstrap coverage/i);
    });

    test('Calculates paired cluster-bootstrap differences (Delta) between configurations', () => {
      // Configuration A: 4 hits (66.7%)
      const casesA = [
        { case_id: 'C1', origin_commit: 'ORIGIN-A', target_rank: 1, target_score: 0.95 },
        { case_id: 'C2', origin_commit: 'ORIGIN-A', target_rank: 2, target_score: 0.85 },
        { case_id: 'C3', origin_commit: 'ORIGIN-B', target_rank: 3, target_score: 0.70 },
        { case_id: 'C4', origin_commit: 'ORIGIN-B', target_rank: 4, target_score: 0.65 }
      ];

      // Configuration B: 2 hits (50.0%)
      const casesB = [
        { case_id: 'C1', origin_commit: 'ORIGIN-A', target_rank: 1, target_score: 0.95 },
        { case_id: 'C2', origin_commit: 'ORIGIN-A', target_rank: 15, target_score: 0.30 },
        { case_id: 'C3', origin_commit: 'ORIGIN-B', target_rank: 2, target_score: 0.80 },
        { case_id: 'C4', origin_commit: 'ORIGIN-B', target_rank: 20, target_score: 0.20 }
      ];

      const diff = ClusterBootstrap.bootstrapPaired(casesA, casesB, 'success@10', {
        replicates: 500,
        confidence: 0.95,
        seed: 123
      });

      // Observed delta: 1.0 - 0.50 = 0.50
      expect(diff.observed_delta).toBeCloseTo(0.50, 2);
      expect(diff.ci_lower).toBeLessThanOrEqual(diff.observed_delta);
      expect(diff.ci_upper).toBeGreaterThanOrEqual(diff.observed_delta);
    });
  });

  // =========================================================================
  // 4. THREE-STAGE HISTORICAL EVALUATION & STANDARDIZED LATENCY TESTS
  // =========================================================================
  describe('Three-Stage Historical Evaluation & Standardized Latency', () => {
    const evaluator = new RetrospectEvaluator({ searchHorizon: 50, verifyGitTree: false });

    test('Stage A distinguishes reachability statuses accurately', () => {
      // Case 1: In horizon (dist 20 <= 50), historical evidence present
      const res1 = evaluator.evaluateStageA(
        null,
        '1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d',
        'pin123',
        20,
        { historicalNames: ['oldBuilder'], commitMessage: 'refactor builder' }
      );
      expect(res1.origin_within_budget).toBe(true);
      expect(res1.historical_evidence_discovered).toBe(true);

      // Case 2: Outside horizon (dist 120 > 50)
      const res2 = evaluator.evaluateStageA(
        null,
        '1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d',
        'pin123',
        120,
        { historicalNames: ['oldBuilder'] }
      );
      expect(res2.origin_within_budget).toBe(false);
      expect(res2.reachability_status).toBe('OUTSIDE_SEARCH_HORIZON');

      // Case 3: No origin specified
      const res3 = evaluator.evaluateStageA(null, null, 'pin123', null, null);
      expect(res3.reachability_status).toBe('NO_ORIGIN_SPECIFIED');
    });

    test('Stage B distinguishes detected predecessor vs ambiguous match vs unmatched', () => {
      // Detected rename
      const res1 = evaluator.evaluateStageB({
        evolutionType: 'rename',
        historicalNames: ['oldMethodName'],
        confidence: 'certain',
        commitMessage: 'Rename oldMethodName to newMethodName'
      });
      expect(res1.detected).toBe(true);
      expect(res1.match_type).toBe('RENAMED_SYMBOL');
      expect(res1.ambiguity_flag).toBe(false);

      // Ambiguous multiple names
      const res2 = evaluator.evaluateStageB({
        evolutionType: 'rename',
        historicalNames: ['methodCandidateA', 'methodCandidateB'],
        confidence: 'uncertain'
      });
      expect(res2.detected).toBe(false);
      expect(res2.match_type).toBe('AMBIGUOUS');
      expect(res2.ambiguity_flag).toBe(true);

      // Unmatched null profile
      const res3 = evaluator.evaluateStageB(null);
      expect(res3.detected).toBe(false);
      expect(res3.match_type).toBe('UNMATCHED');
    });

    test('Stage C evaluates ranking across B1, B2, B3, B4 separately', () => {
      const target = {
        file_path: 'com/test/Example.java',
        symbol_name: 'testMethod'
      };

      const targetSymbol = {
        filePath: 'com/test/Example.java',
        name: 'testMethod',
        id: 'sym_test'
      };

      const decoySymbol = {
        filePath: 'com/test/Example.java',
        name: 'decoyMethod',
        id: 'sym_decoy'
      };

      // B1: target is at rank 1
      const b1Ranked = [
        { symbol: targetSymbol, score: 0.90 },
        { symbol: decoySymbol, score: 0.60 }
      ];

      // B2: target is at rank 2
      const b2Ranked = [
        { symbol: decoySymbol, score: 0.80 },
        { symbol: targetSymbol, score: 0.40 }
      ];

      // B3: target is at rank 1
      const b3Fused = [
        { symbol: targetSymbol, score: 0.70 },
        { symbol: decoySymbol, score: 0.68 }
      ];

      // B4: target is at rank 1
      const b4Fused = [
        { symbol: targetSymbol, score: 0.015 },
        { symbol: decoySymbol, score: 0.012 }
      ];

      const stageC = evaluator.evaluateStageC(true, b1Ranked, b2Ranked, b3Fused, b4Fused, target);

      expect(stageC.target_present_in_candidates).toBe(true);
      expect(stageC.b1_structural.rank).toBe(1);
      expect(stageC.b1_structural.hit_at_1).toBe(true);
      expect(stageC.b1_structural.hit_at_10).toBe(true);
      expect(stageC.b1_structural.mrr).toBe(1.0);

      expect(stageC.b2_historical.rank).toBe(2);
      expect(stageC.b2_historical.hit_at_1).toBe(false);
      expect(stageC.b2_historical.hit_at_5).toBe(true);
      expect(stageC.b2_historical.mrr).toBe(0.5);

      expect(stageC.b3_linear.rank).toBe(1);
      expect(stageC.b4_rrf.rank).toBe(1);
    });

    test('Distance band stratification maps distances to documented bands', () => {
      expect(RetrospectEvaluator.getDistanceStratum(10)).toBe('[0, 50]');
      expect(RetrospectEvaluator.getDistanceStratum(50)).toBe('[0, 50]');
      expect(RetrospectEvaluator.getDistanceStratum(51)).toBe('[51, 150]');
      expect(RetrospectEvaluator.getDistanceStratum(150)).toBe('[51, 150]');
      expect(RetrospectEvaluator.getDistanceStratum(151)).toBe('[151, 500]');
      expect(RetrospectEvaluator.getDistanceStratum(500)).toBe('[151, 500]');
      expect(RetrospectEvaluator.getDistanceStratum(501)).toBe('> 500');
      expect(RetrospectEvaluator.getDistanceStratum(null)).toBe('UNKNOWN');
    });
  });

  // =========================================================================
  // 5. TARGET MATCHING TESTS (WITHOUT INTERNAL RETROSPECT IDS)
  // =========================================================================
  describe('Target Matching (Benchmark-Agnostic)', () => {
    const target = {
      file_path: 'src/main/java/com/example/MyClass.java',
      symbol_name: 'MyClass.executeAction',
      parameter_types: ['int', 'String']
    };

    test('Matches candidate by relative file path and short symbol name', () => {
      const cand = {
        filePath: 'com/example/MyClass.java',
        name: 'executeAction',
        qualifiedName: 'com.example.MyClass.executeAction',
        parameterTypes: ['int', 'String']
      };

      expect(RetrospectEvaluator.isTargetMatch(cand, target)).toBe(true);
    });

    test('Rejects candidate when file path does not match', () => {
      const cand = {
        filePath: 'com/other/OtherClass.java',
        name: 'executeAction'
      };

      expect(RetrospectEvaluator.isTargetMatch(cand, target)).toBe(false);
    });

    test('Rejects candidate when symbol name does not match', () => {
      const cand = {
        filePath: 'src/main/java/com/example/MyClass.java',
        name: 'differentAction'
      };

      expect(RetrospectEvaluator.isTargetMatch(cand, target)).toBe(false);
    });

    test('Rejects candidate with mismatched parameter arity when specified', () => {
      const cand = {
        filePath: 'src/main/java/com/example/MyClass.java',
        name: 'executeAction',
        parameterTypes: ['int'] // Arity 1 instead of 2
      };

      expect(RetrospectEvaluator.isTargetMatch(cand, target)).toBe(false);
    });
  });
});
