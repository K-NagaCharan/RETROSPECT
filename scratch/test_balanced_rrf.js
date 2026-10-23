const fs = require('fs');
const path = require('path');
const { fuseRRFv2 } = require('../src/retrieval/RRFv2');

// Let's test on Checkstyle snapshot directly
const { indexRepository } = require('../src/structural/index');
const { StructuralRetriever } = require('../src/structural/retrieval/StructuralRetriever');
const QueryProcessor = require('../src/structural/query/QueryProcessor');
const HistoricalRetrievalAdapter = require('../src/retrieval/HistoricalRetrievalAdapter');

async function test() {
  const repoPath = 'D:/clones/checkstyle';
  const structuralIndex = await indexRepository(repoPath);
  const allSymbols = Array.from(structuralIndex.symbols.values());

  const histAdapter = new HistoricalRetrievalAdapter();
  const histResult = await histAdapter.indexRepositoryHistory(repoPath, allSymbols, {
    maxCommits: 50,
    startCommit: '10a3a0777ced10983ebe6266c998957c10dba8f0'
  });

  const candidates = allSymbols.map(sym => ({
    symbol: sym,
    historyProfile: histResult.profileMap.get(sym.id) || null
  }));

  // DIAG-01
  const qStr = 'Retrieve the collection of logged style violations and inspection messages';
  const q = QueryProcessor.process(qStr);
  const retriever = new StructuralRetriever(structuralIndex);
  const b1_ranked = retriever.rankCandidates(q, allSymbols);
  b1_ranked.sort((a, b) => b.score - a.score || (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name));

  const b2_ranked = histAdapter.rankHistoricalOnly(q, candidates, {}, { enforceCandidateParity: true });
  b2_ranked.sort((a, b) => b.score - a.score || (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name));

  const target = {
    file_path: 'src/main/java/com/puppycrawl/tools/checkstyle/api/AbstractCheck.java',
    symbol_name: 'AbstractCheck.getViolations',
    short_name: 'getViolations'
  };

  function findRank(ranked) {
    for (let i = 0; i < ranked.length; i++) {
      const cand = ranked[i].symbol;
      const normCandPath = (cand.filePath || '').replace(/\\/g, '/').toLowerCase();
      const normTarget = (target.file_path || '').replace(/\\/g, '/').toLowerCase();
      if ((normCandPath.endsWith(normTarget) || normTarget.endsWith(normCandPath)) &&
          (cand.name === target.short_name || cand.name === target.symbol_name)) {
        return { rank: i + 1, score: ranked[i].score };
      }
    }
    return null;
  }

  console.log('DIAG-01 B1 Rank:', findRank(b1_ranked));
  console.log('DIAG-01 B2 Rank:', findRank(b2_ranked));

  // Asymmetric (Current baseline)
  const b4_asym = fuseRRFv2(
    candidates.map(c => c.symbol),
    b1_ranked.map(r => ({ id: r.symbol.id, score: r.score })),
    b2_ranked.map(r => ({ id: r.symbol.id, score: r.score })),
    { k: 60, weightStructural: 0.60, weightHistorical: 0.40 }
  );
  console.log('DIAG-01 B4 Asymmetric (0.60 / 0.40) Rank:', findRank(b4_asym));

  // Symmetric Cormack (0.50 / 0.50)
  const b4_sym = fuseRRFv2(
    candidates.map(c => c.symbol),
    b1_ranked.map(r => ({ id: r.symbol.id, score: r.score })),
    b2_ranked.map(r => ({ id: r.symbol.id, score: r.score })),
    { k: 60, weightStructural: 0.50, weightHistorical: 0.50 }
  );
  console.log('DIAG-01 B4 Balanced (0.50 / 0.50) Rank:', findRank(b4_sym));

  // Also test DIAG-08 (Violation.getLineNo)
  const qStr8 = 'Get the line coordinate number for logged violation warning';
  const q8 = QueryProcessor.process(qStr8);
  const b1_8 = retriever.rankCandidates(q8, allSymbols);
  b1_8.sort((a, b) => b.score - a.score || (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name));
  const b2_8 = histAdapter.rankHistoricalOnly(q8, candidates, {}, { enforceCandidateParity: true });
  b2_8.sort((a, b) => b.score - a.score || (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name));

  const target8 = {
    file_path: 'src/main/java/com/puppycrawl/tools/checkstyle/api/Violation.java',
    symbol_name: 'Violation.getLineNo',
    short_name: 'getLineNo'
  };

  function findRank8(ranked) {
    for (let i = 0; i < ranked.length; i++) {
      const cand = ranked[i].symbol;
      const normCandPath = (cand.filePath || '').replace(/\\/g, '/').toLowerCase();
      const normTarget = (target8.file_path || '').replace(/\\/g, '/').toLowerCase();
      if ((normCandPath.endsWith(normTarget) || normTarget.endsWith(normCandPath)) &&
          (cand.name === target8.short_name || cand.name === target8.symbol_name)) {
        return { rank: i + 1, score: ranked[i].score };
      }
    }
    return null;
  }

  console.log('\nDIAG-08 B1 Rank:', findRank8(b1_8));
  console.log('DIAG-08 B2 Rank:', findRank8(b2_8));

  const b4_8_asym = fuseRRFv2(
    candidates.map(c => c.symbol),
    b1_8.map(r => ({ id: r.symbol.id, score: r.score })),
    b2_8.map(r => ({ id: r.symbol.id, score: r.score })),
    { k: 60, weightStructural: 0.60, weightHistorical: 0.40 }
  );
  console.log('DIAG-08 B4 Asymmetric (0.60 / 0.40) Rank:', findRank8(b4_8_asym));

  const b4_8_sym = fuseRRFv2(
    candidates.map(c => c.symbol),
    b1_8.map(r => ({ id: r.symbol.id, score: r.score })),
    b2_8.map(r => ({ id: r.symbol.id, score: r.score })),
    { k: 60, weightStructural: 0.50, weightHistorical: 0.50 }
  );
  console.log('DIAG-08 B4 Balanced (0.50 / 0.50) Rank:', findRank8(b4_8_sym));
}

test().catch(console.error);
