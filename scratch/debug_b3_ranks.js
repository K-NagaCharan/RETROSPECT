const { indexRepository } = require('../src/structural/index');
const { StructuralRetriever } = require('../src/structural/retrieval/StructuralRetriever');
const QueryProcessor = require('../src/structural/query/QueryProcessor');
const HistoricalRetrievalAdapter = require('../src/retrieval/HistoricalRetrievalAdapter');
const { execFileSync } = require('child_process');

async function debugRanks() {
  const repoPath = 'D:/clones/checkstyle';
  const pin = '10a3a0777ced10983ebe6266c998957c10dba8f0';
  const structuralIndex = await indexRepository(repoPath, { forceRebuild: false });
  const allSymbols = Array.from(structuralIndex.symbols.values());
  const histAdapter = new HistoricalRetrievalAdapter();
  const histResult = await histAdapter.indexRepositoryHistory(repoPath, allSymbols, { maxCommits: 50, startCommit: pin });

  const candidates = allSymbols.map(sym => ({
    symbol: sym,
    historyProfile: histResult.profileMap.get(sym.id) || null
  }));

  const query = 'Construct AST block comment node structure from string content or token';
  const q = QueryProcessor.process(query);
  const retriever = new StructuralRetriever(structuralIndex);
  const b1_ranked = retriever.rankCandidates(q, allSymbols);
  b1_ranked.sort((a, b) => b.score - a.score || (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name));

  const b2_ranked = histAdapter.rankHistoricalOnly(q, candidates, {}, { enforceCandidateParity: true });
  b2_ranked.sort((a, b) => b.score - a.score || (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name));

  const sMap = new Map();
  b1_ranked.forEach(r => sMap.set(r.symbol.id, r.score));
  const hMap = new Map();
  b2_ranked.forEach(r => hMap.set(r.symbol.id, r.score));

  // Inspect b2 positive scores
  const b2Positive = b2_ranked.filter(r => r.score > 0);
  console.log('Positive B2 candidates count:', b2Positive.length);
  for (let i = 0; i < Math.min(10, b2Positive.length); i++) {
    console.log(`B2 Top ${i+1}: ${b2Positive[i].symbol.name} (${b2Positive[i].symbol.filePath}) score=${b2Positive[i].score}`);
  }

  // Original B3
  const b3_orig = candidates.map(cand => {
    const s = sMap.get(cand.symbol.id) || 0;
    const h = hMap.get(cand.symbol.id) || 0;
    return { name: cand.symbol.name, path: cand.symbol.filePath, score: HistoricalRetrievalAdapter.fuseScores(s, h), s, h };
  });
  b3_orig.sort((a, b) => b.score - a.score || (a.name).localeCompare(b.name));

  // Normalized B3
  const b3_norm = candidates.map(cand => {
    const s = sMap.get(cand.symbol.id) || 0;
    const h = hMap.get(cand.symbol.id) || 0;
    let score = 0;
    if (s > 0 && h > 0) score = 0.60 * s + 0.40 * h;
    else if (s > 0) score = s;
    else if (h > 0) score = h;
    return { name: cand.symbol.name, path: cand.symbol.filePath, score: parseFloat(score.toFixed(4)), s, h };
  });
  b3_norm.sort((a, b) => b.score - a.score || (a.name).localeCompare(b.name));

  console.log('\n--- TOP 25 IN B3 ORIG ---');
  for (let i = 0; i < 25; i++) {
    const it = b3_orig[i];
    const isTarget = it.path.includes('ParserUtil.java') && it.name === 'createBlockCommentNode';
    console.log(`${i+1}. [${isTarget ? 'TARGET' : 'OTHER'}] ${it.name} score=${it.score} (s=${it.s}, h=${it.h}) ${it.path}`);
  }

  console.log('\n--- TOP 25 IN B3 NORM ---');
  for (let i = 0; i < 25; i++) {
    const it = b3_norm[i];
    const isTarget = it.path.includes('ParserUtil.java') && it.name === 'createBlockCommentNode';
    console.log(`${i+1}. [${isTarget ? 'TARGET' : 'OTHER'}] ${it.name} score=${it.score} (s=${it.s}, h=${it.h}) ${it.path}`);
  }
}
debugRanks().catch(console.error);
