const { indexRepository } = require('../src/structural/index');
const { StructuralRetriever } = require('../src/structural/retrieval/StructuralRetriever');
const QueryProcessor = require('../src/structural/query/QueryProcessor');

async function testHarness() {
  const repoPath = 'D:/clones/guava';
  const t0_idx = Date.now();
  const index = await indexRepository(repoPath, { forceRebuild: false });
  console.log(`Indexed in ${Date.now() - t0_idx} ms. Symbols: ${index.symbols.size}`);

  const testQueries = [
    { id: 'DIAG-04', q: 'Check that integer index is non-negative and throw appropriate exception' },
    { id: 'DIAG-05', q: 'Construct an immutable list builder with preallocated capacity' },
    { id: 'Q3', q: 'builder' },
    { id: 'Q4', q: 'immutable list' }
  ];

  const allSymbols = Array.from(index.symbols.values());
  const retriever = new StructuralRetriever(index);

  for (const tq of testQueries) {
    console.log(`\n=================== ${tq.id}: "${tq.q}" ===================`);
    const q = QueryProcessor.process(tq.q);

    // Full scan
    const t0_full = Date.now();
    const rankedFull = retriever.rankCandidates(q, allSymbols);
    rankedFull.sort((a, b) => b.score - a.score || (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name));
    const t_full = Date.now() - t0_full;

    // Prefiltered scan
    const t0_gen = Date.now();
    const prefiltered = retriever.generateCandidates(q);
    const t_gen = Date.now() - t0_gen;

    const t0_rankPref = Date.now();
    const rankedPref = retriever.rankCandidates(q, prefiltered);
    rankedPref.sort((a, b) => b.score - a.score || (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name));
    const t_rankPref = Date.now() - t0_rankPref;
    const t_totalPref = t_gen + t_rankPref;

    console.log(`Full Scan: Time = ${t_full} ms | Nonzero Candidates = ${rankedFull.length}`);
    console.log(`Prefiltered: Time = ${t_totalPref} ms (Gen: ${t_gen} ms, Rank: ${t_rankPref} ms) | Candidates Gen = ${prefiltered.length} | Nonzero = ${rankedPref.length}`);
    console.log(`Speedup: ${(t_full / Math.max(1, t_totalPref)).toFixed(1)}x`);

    // Compare coverage
    const fullMap = new Map(rankedFull.map(r => [r.symbol.id, r.score]));
    const prefMap = new Map(rankedPref.map(r => [r.symbol.id, r.score]));

    let missingCount = 0;
    let scoreMismatchCount = 0;
    for (const [id, score] of fullMap.entries()) {
      if (!prefMap.has(id)) {
        missingCount++;
      } else {
        if (Math.abs(prefMap.get(id) - score) > 1e-4) {
          scoreMismatchCount++;
        }
      }
    }

    console.log(`Nonzero candidates in full scan: ${fullMap.size}`);
    console.log(`Nonzero candidates in prefiltered: ${prefMap.size}`);
    console.log(`Missing in prefiltered: ${missingCount}`);
    console.log(`Score mismatches on common: ${scoreMismatchCount}`);

    // Top 10 parity
    let top10Matches = 0;
    const compareTopK = Math.min(10, rankedFull.length);
    for (let i = 0; i < compareTopK; i++) {
      if (i < rankedPref.length && rankedFull[i].symbol.id === rankedPref[i].symbol.id) {
        top10Matches++;
      }
    }
    console.log(`Top-10 exact position matches: ${top10Matches}/${compareTopK}`);
    if (top10Matches < compareTopK) {
      console.log('Top 5 Full:');
      for (let i = 0; i < Math.min(5, rankedFull.length); i++) {
        console.log(`  ${i+1}. [${rankedFull[i].symbol.name}] score=${rankedFull[i].score} id=${rankedFull[i].symbol.id}`);
      }
      console.log('Top 5 Prefiltered:');
      for (let i = 0; i < Math.min(5, rankedPref.length); i++) {
        console.log(`  ${i+1}. [${rankedPref[i].symbol.name}] score=${rankedPref[i].score} id=${rankedPref[i].symbol.id}`);
      }
    }
  }
}

testHarness().catch(console.error);
