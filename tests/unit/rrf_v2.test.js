const { fuseRRFv2, computeAverageRanks } = require('../../src/retrieval/RRFv2');
const { UnifiedSearch } = require('../../src/retrieval/UnifiedSearch');

describe('RRF-v2 Isolated Implementation and Regression Tests', () => {
  const k = 60;
  const wS = 0.60;
  const wH = 0.40;

  // Synthetic candidate symbols
  const candidates = [
    { id: 'sym_dual', name: 'processData' },
    { id: 'sym_struct_only', name: 'parseConfig' },
    { id: 'sym_hist_only', name: 'legacyMigrate' },
    { id: 'sym_tied_alpha', name: 'alphaHelper' },
    { id: 'sym_tied_zebra', name: 'zebraHelper' },
    { id: 'sym_none', name: 'unrelatedUtil' }
  ];

  // Structural scores:
  // rank 1: sym_dual (1.0)
  // rank 2: sym_struct_only (0.8)
  // ranks 3 & 4 (tied): sym_tied_alpha (0.5), sym_tied_zebra (0.5)
  // sym_hist_only and sym_none are absent / 0
  const structuralScored = [
    { id: 'sym_dual', score: 1.0 },
    { id: 'sym_struct_only', score: 0.8 },
    { id: 'sym_tied_alpha', score: 0.5 },
    { id: 'sym_tied_zebra', score: 0.5 }
  ];

  // Historical scores:
  // rank 1: sym_dual (0.9)
  // rank 2: sym_hist_only (0.7)
  // sym_struct_only, sym_tied_alpha, sym_tied_zebra, sym_none are absent / 0
  const historicalScored = [
    { id: 'sym_dual', score: 0.9 },
    { id: 'sym_hist_only', score: 0.7 }
  ];

  test('1. A candidate with no evidence in either channel receives score 0', () => {
    const results = fuseRRFv2(candidates, structuralScored, historicalScored, { k, weightStructural: wS, weightHistorical: wH });
    const noneItem = results.find(r => r.symbol.id === 'sym_none');

    expect(noneItem).toBeDefined();
    expect(noneItem.score).toBe(0.0);
    expect(noneItem.structuralContribution).toBe(0.0);
    expect(noneItem.historicalContribution).toBe(0.0);
    expect(noneItem.hasStructuralEvidence).toBe(false);
    expect(noneItem.hasHistoricalEvidence).toBe(false);
    expect(noneItem.hasAnyEvidence).toBe(false);
    expect(noneItem.structuralRank).toBeNull();
    expect(noneItem.historicalRank).toBeNull();
  });

  test('2. A structural-only candidate receives no historical contribution', () => {
    const results = fuseRRFv2(candidates, structuralScored, historicalScored, { k, weightStructural: wS, weightHistorical: wH });
    const item = results.find(r => r.symbol.id === 'sym_struct_only');

    expect(item).toBeDefined();
    // Rank 2 in structural
    const expectedStructContrib = wS / (k + 2); // 0.60 / 62
    expect(item.structuralRank).toBe(2);
    expect(item.structuralContribution).toBeCloseTo(expectedStructContrib, 10);
    expect(item.historicalContribution).toBe(0.0);
    expect(item.historicalRank).toBeNull();
    expect(item.hasStructuralEvidence).toBe(true);
    expect(item.hasHistoricalEvidence).toBe(false);
    expect(item.score).toBeCloseTo(expectedStructContrib, 10);
  });

  test('3. A historical-only candidate receives no structural contribution', () => {
    const results = fuseRRFv2(candidates, structuralScored, historicalScored, { k, weightStructural: wS, weightHistorical: wH });
    const item = results.find(r => r.symbol.id === 'sym_hist_only');

    expect(item).toBeDefined();
    // Rank 2 in historical
    const expectedHistContrib = wH / (k + 2); // 0.40 / 62
    expect(item.structuralContribution).toBe(0.0);
    expect(item.structuralRank).toBeNull();
    expect(item.historicalRank).toBe(2);
    expect(item.historicalContribution).toBeCloseTo(expectedHistContrib, 10);
    expect(item.hasStructuralEvidence).toBe(false);
    expect(item.hasHistoricalEvidence).toBe(true);
    expect(item.score).toBeCloseTo(expectedHistContrib, 10);
  });

  test('4. A candidate retrieved by both channels receives both valid contributions', () => {
    const results = fuseRRFv2(candidates, structuralScored, historicalScored, { k, weightStructural: wS, weightHistorical: wH });
    const item = results.find(r => r.symbol.id === 'sym_dual');

    expect(item).toBeDefined();
    const expectedStructContrib = wS / (k + 1); // 0.60 / 61
    const expectedHistContrib = wH / (k + 1);   // 0.40 / 61
    const expectedFusedScore = expectedStructContrib + expectedHistContrib; // 1.00 / 61

    expect(item.structuralRank).toBe(1);
    expect(item.historicalRank).toBe(1);
    expect(item.structuralContribution).toBeCloseTo(expectedStructContrib, 10);
    expect(item.historicalContribution).toBeCloseTo(expectedHistContrib, 10);
    expect(item.hasStructuralEvidence).toBe(true);
    expect(item.hasHistoricalEvidence).toBe(true);
    expect(item.score).toBeCloseTo(expectedFusedScore, 10);
    expect(item.rank).toBe(1); // Rank 1 overall
  });

  test('5. Equal channel scores yield equal rank contributions regardless of symbol names', () => {
    const results = fuseRRFv2(candidates, structuralScored, historicalScored, { k, weightStructural: wS, weightHistorical: wH });
    const alphaItem = results.find(r => r.symbol.id === 'sym_tied_alpha');
    const zebraItem = results.find(r => r.symbol.id === 'sym_tied_zebra');

    expect(alphaItem).toBeDefined();
    expect(zebraItem).toBeDefined();

    // Both occupy positions 3 and 4 in structural channel: average rank = (3 + 4) / 2 = 3.5
    const expectedAvgRank = 3.5;
    const expectedStructContrib = wS / (k + expectedAvgRank); // 0.60 / 63.5

    expect(alphaItem.structuralRank).toBe(3.5);
    expect(zebraItem.structuralRank).toBe(3.5);

    expect(alphaItem.structuralContribution).toBeCloseTo(expectedStructContrib, 12);
    expect(zebraItem.structuralContribution).toBeCloseTo(expectedStructContrib, 12);

    expect(alphaItem.historicalContribution).toBe(0.0);
    expect(zebraItem.historicalContribution).toBe(0.0);

    // Exact score equality: alphabetical naming does NOT distort score
    expect(alphaItem.score).toBe(zebraItem.score);
    expect(alphaItem.score).toBeCloseTo(expectedStructContrib, 12);

    // Presentation order sorts alpha before zebra on equal score
    expect(alphaItem.rank).toBe(3);
    expect(zebraItem.rank).toBe(4);
  });

  test('6. Missing candidates do not receive a fallback-rank contribution', () => {
    // cand_none was in candidate pool but omitted from both score lists
    const results = fuseRRFv2(candidates, structuralScored, historicalScored, { k, weightStructural: wS, weightHistorical: wH });
    const noneItem = results.find(r => r.symbol.id === 'sym_none');

    // If a fallback rank N = 6 were used, it would have received 0.60/(60+6) = 0.00909
    // Under RRF-v2, it MUST NOT receive this manufactured score
    expect(noneItem.score).toBe(0.0);
    expect(noneItem.score).not.toBeCloseTo(wS / (k + candidates.length), 4);
    expect(noneItem.score).not.toBeCloseTo(wH / (k + candidates.length), 4);
  });

  test('7. Repeated executions produce deterministic results', () => {
    const run1 = fuseRRFv2(candidates, structuralScored, historicalScored, { k, weightStructural: wS, weightHistorical: wH });
    const run2 = fuseRRFv2(candidates, structuralScored, historicalScored, { k, weightStructural: wS, weightHistorical: wH });

    expect(run1.length).toBe(run2.length);
    for (let i = 0; i < run1.length; i++) {
      expect(run1[i].symbol.id).toBe(run2[i].symbol.id);
      expect(run1[i].score).toBe(run2[i].score);
      expect(run1[i].rank).toBe(run2[i].rank);
      expect(run1[i].structuralContribution).toBe(run2[i].structuralContribution);
      expect(run1[i].historicalContribution).toBe(run2[i].historicalContribution);
    }
  });

  test('8. The existing RRF-v1 implementation remains unchanged', () => {
    // Verify that UnifiedSearch class exists, defaults to strategy 'linear', and handles 'rrf' v1
    const searcher = new UnifiedSearch();
    expect(searcher.defaultStrategy).toBe('linear');

    // Confirm UnifiedSearch.js source code still uses v1 logic
    const fs = require('fs');
    const path = require('path');
    const unifiedSrc = fs.readFileSync(path.resolve(__dirname, '../../src/retrieval/UnifiedSearch.js'), 'utf8');

    // v1 fallback rank to candidates.length must still be present
    expect(unifiedSrc).toContain('const sRank = sRankMap.get(c.symbol.id) || candidates.length;');
    expect(unifiedSrc).toContain('const hRank = hRankMap.get(c.symbol.id) || candidates.length;');
    expect(unifiedSrc).toContain('fusedScore = (0.60 / (k + sRank)) + (0.40 / (k + hRank));');

    // Confirm scripts/evaluate_phase_b_fusion.js still contains v1
    const evalSrc = fs.readFileSync(path.resolve(__dirname, '../../scripts/evaluate_phase_b_fusion.js'), 'utf8');
    expect(evalSrc).toContain('const sRank = sRankMap.get(c.symbol.id) || candidates.length;');
    expect(evalSrc).toContain('const hRank = hRankMap.get(c.symbol.id) || candidates.length;');
  });

  test('Fractional average rank computation handles multi-tier ties correctly', () => {
    const items = [
      { id: 'a', score: 1.0 },
      { id: 'b', score: 0.8 },
      { id: 'c', score: 0.8 },
      { id: 'd', score: 0.8 },
      { id: 'e', score: 0.4 },
      { id: 'f', score: 0.0 } // 0-score should be ignored
    ];

    const rankMap = computeAverageRanks(items);
    expect(rankMap.size).toBe(5); // 0-score item f is not in rankMap

    expect(rankMap.get('a').rank).toBe(1.0);
    // b, c, d occupy positions 2, 3, 4: average = (2 + 3 + 4) / 3 = 3.0
    expect(rankMap.get('b').rank).toBe(3.0);
    expect(rankMap.get('c').rank).toBe(3.0);
    expect(rankMap.get('d').rank).toBe(3.0);
    // e occupies position 5
    expect(rankMap.get('e').rank).toBe(5.0);
    expect(rankMap.has('f')).toBe(false);
  });

  test('10. Accepts Map inputs for both numeric scores and object values', () => {
    const sMap = new Map([
      ['sym_both', 0.95],
      ['sym_struct', 0.85]
    ]);
    const hMap = new Map([
      ['sym_both', { score: 0.90 }],
      ['sym_hist', { score: 0.70 }]
    ]);
    const testCandidates = [
      { id: 'sym_both' },
      { id: 'sym_struct' },
      { id: 'sym_hist' },
      { id: 'sym_absent' }
    ];

    const results = fuseRRFv2(testCandidates, sMap, hMap, { k: 60, weightStructural: 0.60, weightHistorical: 0.40 });
    expect(results).toHaveLength(4);

    const both = results.find(r => r.symbol.id === 'sym_both');
    const struct = results.find(r => r.symbol.id === 'sym_struct');
    const hist = results.find(r => r.symbol.id === 'sym_hist');
    const absent = results.find(r => r.symbol.id === 'sym_absent');

    expect(both.structuralRank).toBe(1);
    expect(both.historicalRank).toBe(1);
    expect(both.score).toBeCloseTo(0.60 / 61 + 0.40 / 61, 10);
    expect(both.rank).toBe(1);

    expect(struct.structuralRank).toBe(2);
    expect(struct.historicalRank).toBeNull();
    expect(struct.score).toBeCloseTo(0.60 / 62, 10);

    expect(hist.structuralRank).toBeNull();
    expect(hist.historicalRank).toBe(2);
    expect(hist.score).toBeCloseTo(0.40 / 62, 10);

    expect(absent.score).toBe(0.0);
    expect(absent.rank).toBe(4);
  });

  test('11. Non-finite (NaN, Infinity, -Infinity) and non-positive scores do not contribute', () => {
    const rawItems = [
      { id: 'sym_inf', score: Infinity },
      { id: 'sym_neg_inf', score: -Infinity },
      { id: 'sym_nan', score: NaN },
      { id: 'sym_neg', score: -0.5 },
      { id: 'sym_zero', score: 0 },
      { id: 'sym_valid', score: 0.75 }
    ];

    // In computeAverageRanks, only sym_valid should receive a rank
    const rankMap = computeAverageRanks(rawItems);
    expect(rankMap.size).toBe(1);
    expect(rankMap.has('sym_valid')).toBe(true);
    expect(rankMap.get('sym_valid').rank).toBe(1.0);
    expect(rankMap.has('sym_inf')).toBe(false);
    expect(rankMap.has('sym_neg_inf')).toBe(false);
    expect(rankMap.has('sym_nan')).toBe(false);
    expect(rankMap.has('sym_neg')).toBe(false);
    expect(rankMap.has('sym_zero')).toBe(false);

    // In fuseRRFv2, non-finite/negative scores must receive 0 contribution and rank null
    const testCandidates = [
      { id: 'sym_valid' },
      { id: 'sym_inf' },
      { id: 'sym_nan' },
      { id: 'sym_neg' }
    ];
    const results = fuseRRFv2(testCandidates, rawItems, [], { k: 60, weightStructural: 0.60, weightHistorical: 0.40 });

    const validItem = results.find(r => r.symbol.id === 'sym_valid');
    const infItem = results.find(r => r.symbol.id === 'sym_inf');
    const nanItem = results.find(r => r.symbol.id === 'sym_nan');
    const negItem = results.find(r => r.symbol.id === 'sym_neg');

    expect(validItem.score).toBeCloseTo(0.60 / 61, 10);
    expect(validItem.rank).toBe(1);

    expect(infItem.score).toBe(0.0);
    expect(infItem.structuralContribution).toBe(0.0);
    expect(infItem.structuralRank).toBeNull();
    expect(infItem.hasStructuralEvidence).toBe(false);

    expect(nanItem.score).toBe(0.0);
    expect(nanItem.structuralContribution).toBe(0.0);
    expect(nanItem.structuralRank).toBeNull();

    expect(negItem.score).toBe(0.0);
    expect(negItem.structuralContribution).toBe(0.0);
    expect(negItem.structuralRank).toBeNull();
  });

  test('12. Duplicate candidate IDs in score lists take max score; duplicate candidate symbols preserve first', () => {
    // Structural list has duplicate IDs with different scores
    // Chosen behavior: max-pooling (retains highest finite score so candidate occupies exactly one rank)
    const structWithDups = [
      { id: 'sym_dup', score: 0.30 },
      { id: 'sym_dup', score: 0.90 },
      { id: 'sym_other', score: 0.60 }
    ];

    const sRanks = computeAverageRanks(structWithDups);
    expect(sRanks.size).toBe(2);
    // sym_dup max score is 0.90 -> rank 1; sym_other score is 0.60 -> rank 2
    expect(sRanks.get('sym_dup').rank).toBe(1.0);
    expect(sRanks.get('sym_dup').score).toBe(0.90);
    expect(sRanks.get('sym_other').rank).toBe(2.0);

    // Candidate pool with duplicates
    // Chosen behavior: deduplicate preserving first occurrence
    const poolWithDups = [
      { id: 'sym_dup', name: 'sym_dup_first' },
      { id: 'sym_dup', name: 'sym_dup_second' },
      { id: 'sym_other', name: 'sym_other' }
    ];

    const results = fuseRRFv2(poolWithDups, structWithDups, [], { k: 60, weightStructural: 0.60, weightHistorical: 0.40 });
    expect(results).toHaveLength(2);
    expect(results[0].symbol.name).toBe('sym_dup_first');
    expect(results[0].rank).toBe(1);
    expect(results[1].symbol.name).toBe('sym_other');
    expect(results[1].rank).toBe(2);
  });

  test('13. Candidates tied in both channels receive identical scores; ties broken alphabetically by ID', () => {
    const tiedCandidates = [
      { id: 'zebra_cand', name: 'zebra' },
      { id: 'alpha_cand', name: 'alpha' }
    ];

    // Both candidates have identical scores in both channels
    const sInput = [
      { id: 'zebra_cand', score: 0.85 },
      { id: 'alpha_cand', score: 0.85 }
    ];
    const hInput = [
      { id: 'zebra_cand', score: 0.70 },
      { id: 'alpha_cand', score: 0.70 }
    ];

    const results = fuseRRFv2(tiedCandidates, sInput, hInput, { k: 60, weightStructural: 0.60, weightHistorical: 0.40 });

    const alpha = results.find(r => r.symbol.id === 'alpha_cand');
    const zebra = results.find(r => r.symbol.id === 'zebra_cand');

    // Both occupy ranks (1+2)/2 = 1.5 in both channels
    expect(alpha.structuralRank).toBe(1.5);
    expect(zebra.structuralRank).toBe(1.5);
    expect(alpha.historicalRank).toBe(1.5);
    expect(zebra.historicalRank).toBe(1.5);

    // Exact score equality: identical contributions
    const expectedScore = (0.60 / 61.5) + (0.40 / 61.5); // 1.00 / 61.5
    expect(alpha.score).toBe(zebra.score);
    expect(alpha.score).toBeCloseTo(expectedScore, 12);

    // Presentation tie-break: alpha before zebra, ranks 1 and 2, without mutating scores
    expect(results[0].symbol.id).toBe('alpha_cand');
    expect(results[0].rank).toBe(1);
    expect(results[1].symbol.id).toBe('zebra_cand');
    expect(results[1].rank).toBe(2);
    expect(results[0].score).toBe(results[1].score);
  });

  test('14. Absent candidates receive score 0; positive evidence candidates are ordered strictly ahead', () => {
    const candidatesPool = [
      { id: 'absent_cand_z', name: 'Zeta' },
      { id: 'absent_cand_a', name: 'Alpha' },
      { id: 'zero_score_cand', name: 'Zero' },
      { id: 'pos_cand_struct', name: 'StructOnly' },
      { id: 'pos_cand_hist', name: 'HistOnly' }
    ];

    const sInput = [
      { id: 'pos_cand_struct', score: 0.20 },
      { id: 'zero_score_cand', score: 0.0 }
    ];
    const hInput = [
      { id: 'pos_cand_hist', score: 0.15 }
    ];

    const results = fuseRRFv2(candidatesPool, sInput, hInput, { k: 60, weightStructural: 0.60, weightHistorical: 0.40 });
    expect(results).toHaveLength(5);

    // Ranks 1 and 2 must be positive evidence candidates
    expect(results[0].score).toBeGreaterThan(0.0);
    expect(results[1].score).toBeGreaterThan(0.0);
    expect(['pos_cand_struct', 'pos_cand_hist']).toContain(results[0].symbol.id);
    expect(['pos_cand_struct', 'pos_cand_hist']).toContain(results[1].symbol.id);

    // Ranks 3, 4, 5 must be 0-score candidates
    expect(results[2].score).toBe(0.0);
    expect(results[3].score).toBe(0.0);
    expect(results[4].score).toBe(0.0);
    expect(results[2].rank).toBe(3);
    expect(results[3].rank).toBe(4);
    expect(results[4].rank).toBe(5);

    // Zero-score candidates sorted alphabetically by ID among themselves: absent_cand_a, absent_cand_z, zero_score_cand
    expect(results[2].symbol.id).toBe('absent_cand_a');
    expect(results[3].symbol.id).toBe('absent_cand_z');
    expect(results[4].symbol.id).toBe('zero_score_cand');
  });

  test('15. Sorting comparator satisfies strict weak ordering contract without tolerance cycles', () => {
    // In tolerance-based comparators, if |b.score - a.score| > epsilon is checked inside sort(),
    // items with scores:
    // a: 0.1000000000, b: 0.1000000006, c: 0.1000000012 with epsilon=1e-9
    // create an intransitive cycle: |a - b| <= eps, |b - c| <= eps, but |a - c| > eps!
    // This previously caused sorting [a, b, c] to rank lowest-score 'a' first and highest-score 'c' last.
    const items = [
      { id: 'a', score: 0.1000000000 },
      { id: 'b', score: 0.1000000006 },
      { id: 'c', score: 0.1000000012 }
    ];

    // Direct computeAverageRanks test:
    const rankMap = computeAverageRanks(items, { epsilon: 1e-9 });
    // c and b are within epsilon (diff 0.6e-9 <= 1e-9) -> group together at average rank 1.5
    // a is outside epsilon from c (diff 1.2e-9 > 1e-9) -> rank 3
    expect(rankMap.get('c').rank).toBe(1.5);
    expect(rankMap.get('b').rank).toBe(1.5);
    expect(rankMap.get('a').rank).toBe(3.0);

    // Permutation invariance test: input order must not affect output ranks
    const reversedItems = [...items].reverse();
    const rankMapRev = computeAverageRanks(reversedItems, { epsilon: 1e-9 });
    expect(rankMapRev.get('c').rank).toBe(1.5);
    expect(rankMapRev.get('b').rank).toBe(1.5);
    expect(rankMapRev.get('a').rank).toBe(3.0);

    // Full fuseRRFv2 presentation sort test:
    const cands = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const fusedResults = fuseRRFv2(cands, items, [], { k: 60, weightStructural: 0.60, weightHistorical: 0.40, epsilon: 1e-9 });

    // Higher scores must NEVER be ranked behind lower scores
    expect(fusedResults[0].score).toBeGreaterThanOrEqual(fusedResults[1].score);
    expect(fusedResults[1].score).toBeGreaterThanOrEqual(fusedResults[2].score);
    expect(fusedResults[2].symbol.id).toBe('a'); // lowest score 'a' is rank 3
    // 'b' and 'c' share rank 1.5 so equal fused score; alphabetical breaks tie ('b' before 'c')
    expect(fusedResults[0].symbol.id).toBe('b');
    expect(fusedResults[1].symbol.id).toBe('c');
  });

  test('16. Channel-Balanced Cormack RRF prevents top structural noise from suppressing high-confidence historical matches', () => {
    // Regression test for DIAG-01 / DIAG-08 failure mode:
    // When a symbol is renamed, it has zero structural score. Historical retrieval finds it at Rank 2.
    // In a large repository, 40 unrelated symbols have weak/incidental structural scores.
    const structPool = [];
    for (let i = 1; i <= 40; i++) {
      structPool.push({ id: `struct_noise_${i}`, score: 1.0 - (i * 0.01) });
    }
    const histPool = [
      { id: 'top_hist_other', score: 0.95 },
      { id: 'sym_renamed_target', score: 0.85 } // Rank 2 in historical
    ];
    const candidatePool = [
      ...structPool.map(s => ({ id: s.id })),
      { id: 'top_hist_other' },
      { id: 'sym_renamed_target' }
    ];

    // Under legacy asymmetric weights (0.60 / 0.40):
    // Max historical score = 0.40 / (60 + 2) = 0.0064516
    // Any structural rank <= 33 receives 0.60 / (60 + 33) = 0.0064516
    // The top 33 structural candidates outrank the target, collapsing its rank to 34+
    const legacyFused = fuseRRFv2(candidatePool, structPool, histPool, {
      k: 60,
      weightStructural: 0.60,
      weightHistorical: 0.40
    });
    const legacyTarget = legacyFused.find(r => r.symbol.id === 'sym_renamed_target');
    expect(legacyTarget.rank).toBeGreaterThan(30);

    // Under balanced Cormack weights (0.50 / 0.50):
    // Target historical score = 0.50 / (60 + 2) = 0.0080645
    // Structural candidates with rank >= 2 receive <= 0.50 / 62 = 0.0080645
    // Target is safely placed in top-5 (rank 4, tied with structural rank 2)!
    const balancedFused = fuseRRFv2(candidatePool, structPool, histPool, {
      k: 60,
      weightStructural: 0.50,
      weightHistorical: 0.50
    });
    const balancedTarget = balancedFused.find(r => r.symbol.id === 'sym_renamed_target');
    expect(balancedTarget.rank).toBeLessThanOrEqual(5);
    expect(balancedTarget.rank).toBe(4);
  });

  test('17. Default configuration in fuseRRFv2 uses balanced weights (0.50 / 0.50)', () => {
    const structPool = [{ id: 's1', score: 0.8 }];
    const histPool = [{ id: 'h1', score: 0.8 }];
    const candidatePool = [{ id: 's1' }, { id: 'h1' }];

    // Default call with no options specified
    const results = fuseRRFv2(candidatePool, structPool, histPool);
    const s1 = results.find(r => r.symbol.id === 's1');
    const h1 = results.find(r => r.symbol.id === 'h1');

    // Both rank 1 in their respective channels; with balanced 0.50/0.50, scores must be identical
    expect(s1.score).toBeCloseTo(h1.score, 6);
    expect(s1.score).toBeCloseTo(0.50 / 61, 6);
    expect(h1.score).toBeCloseTo(0.50 / 61, 6);
  });
});
