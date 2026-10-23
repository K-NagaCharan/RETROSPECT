const path = require('path');
const R = 'D:/base papers considered/Retrospect';
const { indexRepository } = require(path.join(R, 'src/structural/index'));
const { StructuralRetriever } = require(path.join(R, 'src/structural/retrieval/StructuralRetriever'));
const QueryProcessor = require(path.join(R, 'src/structural/query/QueryProcessor'));
const HA = require(path.join(R, 'src/retrieval/HistoricalRetrievalAdapter'));
const REPO = 'D:/clones_eval_2026-10-22/phaseb_zod', PIN = '284243fb0d6532665afdc9239188773bb624f73c';
const sortFn = (a, b) => b.score - a.score || (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name);
(async () => {
  const idx = await indexRepository(REPO, { forceRebuild: true });
  const syms = Array.from(idx.symbols.values());
  const ha = new HA();
  const h = await ha.indexRepositoryHistory(REPO, syms, { maxCommits: 50, startCommit: PIN, firstParentOnly: false });
  const cands = syms.map(s => ({ symbol: s, historyProfile: h.profileMap.get(s.id) || null }));
  const q = QueryProcessor.process('Ensure array size stays within defined limits during schema validation');
  const b1 = new StructuralRetriever(idx).rankCandidates(q, syms).sort(sortFn);
  const b2 = ha.rankHistoricalOnly(q, cands, {}, { enforceCandidateParity: true }).sort(sortFn);
  const inFile = s => s.filePath.split(path.sep).join('/').split('\\').join('/').endsWith('packages/zod/src/v4/core/schemas.ts');
  for (const name of ['$ZodArray', 'capSize', 'arraySize']) {
    for (const s of syms.filter(x => x.name === name && inFile(x))) {
      const r1 = b1.findIndex(r => r.symbol.id === s.id), r2 = b2.findIndex(r => r.symbol.id === s.id);
      const p = h.profileMap.get(s.id) || {};
      console.log(name, s.symbolType, 'line', s.range.startLine, '| B1', r1 >= 0 && b1[r1].score > 0 ? r1 + 1 : '-', '| B2', r2 >= 0 && b2[r2].score > 0 ? r2 + 1 : '-', '| evo', p.evolutionType, '| msg', (p.commitMessage || '').slice(0, 60));
    }
  }
})().catch(e => { console.error(e); process.exit(1); });
