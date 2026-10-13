const HistoricalRetrievalAdapter = require('../../src/retrieval/HistoricalRetrievalAdapter');
const QueryProcessor = require('../../src/structural/query/QueryProcessor');

describe('Evaluation Integrity & Leakage Prevention Tests', () => {
  let adapter;

  beforeEach(() => {
    adapter = new HistoricalRetrievalAdapter();
  });

  test('1. Audit-note leakage prevention: audit_notes cannot affect retrieval score', () => {
    const currentSymbol = { name: 'get_undecorated_callback', filePath: 'bottle.py' };
    const query = QueryProcessor.process('magic inspection term from audit note');

    // Profile without audit_notes
    const profileClean = adapter.buildSymbolHistoryProfile({
      currentSymbol,
      commitMessage: 'refactor: clean up callbacks',
      diffText: '+ def get_undecorated_callback(self):'
    });

    // Profile where caller attempted to pass audit_notes
    const profileWithAuditNotes = adapter.buildSymbolHistoryProfile({
      currentSymbol,
      commitMessage: 'refactor: clean up callbacks',
      diffText: '+ def get_undecorated_callback(self):',
      audit_notes: 'magic inspection term from audit note that should never leak'
    });

    const scoreClean = adapter.scoreHistorical(query, profileClean);
    const scoreWithAudit = adapter.scoreHistorical(query, profileWithAuditNotes);

    expect(scoreClean.score).toBe(scoreWithAudit.score);
    expect(profileWithAuditNotes.audit_notes).toBeUndefined();
    expect(scoreWithAudit.breakdown.diffTerms).toBe(scoreClean.breakdown.diffTerms);
  });

  test('2. Real diff and commit-message provenance: diff and commit tokens are isolated', () => {
    const currentSymbol = { name: 'calculateTotal', filePath: 'cart.js' };
    const commitMsg = 'fix: prevent integer overflow in calculation';
    const realDiff = '@@ -10,3 +10,4 @@\n- return sum;\n+ return Math.min(sum, MAX_SAFE);';

    const profile = adapter.buildSymbolHistoryProfile({
      currentSymbol,
      commitMessage: commitMsg,
      diffText: realDiff
    });

    // Verify commit terms were extracted from real commit message
    expect(profile.commitTerms.tokens).toContain('overflow');
    expect(profile.commitTerms.tokens).toContain('calculation');

    // Verify diff terms were extracted from real diff text
    expect(profile.diffTerms.tokens).toContain('max_safe');
    expect(profile.diffTerms.tokens).toContain('math');

    // Query targeting diff term
    const diffQuery = QueryProcessor.process('max_safe limit');
    const diffScore = adapter.scoreHistorical(diffQuery, profile, { diffTermsOnly: true });
    expect(diffScore.score).toBeGreaterThan(0);

    // Query targeting commit term
    const commitQuery = QueryProcessor.process('integer overflow error');
    const commitScore = adapter.scoreHistorical(commitQuery, profile, { commitMessagesOnly: true });
    expect(commitScore.score).toBeGreaterThan(0);
  });

  test('3. Correct historical-to-current symbol association: file changes do not bleed across symbols', () => {
    const symbolA = { id: 'symA', name: 'processData', filePath: 'pipeline.js' };
    const symbolB = { id: 'symB', name: 'unrelatedHelper', filePath: 'pipeline.js' };

    // Symbol A underwent a rename
    const profileA = adapter.buildSymbolHistoryProfile({
      currentSymbol: symbolA,
      predecessorSymbol: { name: 'transformData' },
      commitMessage: 'rename transformData to processData'
    });

    // Symbol B was unchanged in the same file
    const profileB = adapter.buildSymbolHistoryProfile({
      currentSymbol: symbolB
    });

    const query = QueryProcessor.process('transformData stream');
    const scoreA = adapter.scoreHistorical(query, profileA);
    const scoreB = adapter.scoreHistorical(query, profileB);

    expect(scoreA.score).toBeGreaterThan(0.40);
    expect(scoreB.score).toBe(0.0);
  });

  test('4. Full candidate-pool parity: all candidates are retained and scored deterministically', () => {
    const candidates = [
      {
        symbol: { id: 'c1', name: 'symA', filePath: 'a.js' },
        historyProfile: adapter.buildSymbolHistoryProfile({
          currentSymbol: { name: 'symA', filePath: 'a.js' },
          commitMessage: 'relevant change for query'
        })
      },
      {
        symbol: { id: 'c2', name: 'symB', filePath: 'b.js' },
        historyProfile: adapter.buildSymbolHistoryProfile({
          currentSymbol: { name: 'symB', filePath: 'b.js' }
        })
      },
      {
        symbol: { id: 'c3', name: 'symC', filePath: 'c.js' },
        historyProfile: adapter.buildSymbolHistoryProfile({
          currentSymbol: { name: 'symC', filePath: 'c.js' }
        })
      }
    ];

    const query = 'relevant change';
    const ranked = adapter.rankHistoricalOnly(query, candidates, {}, { enforceCandidateParity: true });

    // Candidate parity: ALL 3 candidates must be present in the output
    expect(ranked.length).toBe(3);
    expect(ranked[0].symbol.id).toBe('c1');
    expect(ranked[0].score).toBeGreaterThan(0);

    // Unscored symbols remain with score 0
    expect(ranked[1].score).toBe(0);
    expect(ranked[2].score).toBe(0);
  });

  test('5. Unresolved lineage handling: applies confidence discount and records reasons', () => {
    const currentSymbol = { name: 'maybeMoved', filePath: 'service.js' };

    const certainProfile = adapter.buildSymbolHistoryProfile({
      currentSymbol,
      predecessorSymbol: { name: 'oldService' },
      confidence: 'certain'
    });

    const uncertainProfile = adapter.buildSymbolHistoryProfile({
      currentSymbol,
      predecessorSymbol: { name: 'oldService' },
      confidence: 'uncertain'
    });

    const query = QueryProcessor.process('oldService');
    const scoreCertain = adapter.scoreHistorical(query, certainProfile);
    const scoreUncertain = adapter.scoreHistorical(query, uncertainProfile);

    expect(scoreUncertain.score).toBeLessThan(scoreCertain.score);
    expect(scoreUncertain.breakdown.confidenceMultiplier).toBe(0.65);
    expect(scoreCertain.breakdown.confidenceMultiplier).toBe(1.0);
  });

  test('6. Deterministic rankings for identical inputs: multiple runs produce identical rankings', () => {
    const candidates = [];
    for (let i = 0; i < 20; i++) {
      candidates.push({
        symbol: { id: `sym_${i.toString().padStart(2, '0')}`, name: `name_${i}`, filePath: `file_${i}.js` },
        historyProfile: adapter.buildSymbolHistoryProfile({
          currentSymbol: { name: `name_${i}`, filePath: `file_${i}.js` },
          commitMessage: i % 2 === 0 ? 'common commit term' : 'unrelated text'
        })
      });
    }

    const query = 'common commit';
    const run1 = adapter.rankHistoricalOnly(query, candidates);
    const run2 = adapter.rankHistoricalOnly(query, candidates);

    expect(run1.length).toBe(20);
    expect(run2.length).toBe(20);
    for (let i = 0; i < 20; i++) {
      expect(run1[i].symbol.id).toBe(run2[i].symbol.id);
      expect(run1[i].score).toBe(run2[i].score);
    }
  });

  test('7. Adaptive fusion preserves high historical signal while linear fusion dilutes it', () => {
    const structuralScore = 0.05; // target was renamed/rewritten, current code has no query tokens
    const historicalScore = 0.85; // historical profile has strong predecessor name match

    const linear = HistoricalRetrievalAdapter.fuseScores(structuralScore, historicalScore, { structural: 0.60, historical: 0.40 });
    const adaptive = HistoricalRetrievalAdapter.adaptiveFuseScores(structuralScore, historicalScore, { boost: 0.25 });

    // Linear dilution: 0.60 * 0.05 + 0.40 * 0.85 = 0.03 + 0.34 = 0.37
    expect(linear).toBeLessThan(0.40);

    // Adaptive preserves high historical score: max(0.05, 0.85) + 0.25 * 0.05 = 0.8625
    expect(adaptive).toBeGreaterThanOrEqual(0.85);
  });

  test('8. Evaluator matches sibling_symbol target explicitly: q_ts_zod_09 evaluates against creditCard, not iban', () => {
    const q = {
      query_id: 'q_ts_zod_09',
      has_answer: true,
      target_symbol_name: 'creditCard',
      target_file_path: 'packages/zod/src/v4/classic/schemas.ts',
      target_role: 'sibling_symbol',
      benchmark_current_symbol: 'iban'
    };

    const rankedCandidates = [
      { symbol: { name: 'iban', filePath: 'packages/zod/src/v4/classic/schemas.ts', id: 'iban_id' }, score: 0.95 },
      { symbol: { name: 'creditCard', filePath: 'packages/zod/src/v4/classic/schemas.ts', id: 'creditCard_id' }, score: 0.85 }
    ];

    // Evaluator matching logic from evaluate_historical_retrieval.js
    let matchedSymbol = null;
    let rank = 0;
    for (let i = 0; i < rankedCandidates.length; i++) {
      const item = rankedCandidates[i];
      const symName = item.symbol.name;
      const symQual = item.symbol.qualifiedName || symName;
      const symFile = (item.symbol.filePath || '').replace(/\\/g, '/');
      const targetFile = (q.target_file_path || '').replace(/\\/g, '/');

      const nameMatches = symName === q.target_symbol_name ||
                          symName.endsWith('.' + q.target_symbol_name) ||
                          symQual === q.target_symbol_name ||
                          (symQual && symQual.endsWith('.' + q.target_symbol_name));
      const fileMatches = !targetFile || symFile.endsWith(targetFile);

      if (nameMatches && fileMatches) {
        matchedSymbol = item.symbol.name;
        rank = i + 1;
        break;
      }
    }

    expect(matchedSymbol).toBe('creditCard');
    expect(matchedSymbol).not.toBe('iban');
    expect(rank).toBe(2);
  });
});
