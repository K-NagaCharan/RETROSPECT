// Read-only trace of B2 (historical channel) on the zod snapshot. No checkout, no writes except stdout.
const path = require('path');
const R = 'D:/base papers considered/Retrospect';
const { indexRepository } = require(path.join(R, 'src/structural/index'));
const QueryProcessor = require(path.join(R, 'src/structural/query/QueryProcessor'));
const HistoricalRetrievalAdapter = require(path.join(R, 'src/retrieval/HistoricalRetrievalAdapter'));
const { execFileSync } = require('child_process');

const REPO = 'D:/clones_eval_2026-10-22/phaseb_zod';
const PIN = '284243fb0d6532665afdc9239188773bb624f73c';
const cases = require(path.join(R, 'research_execution_2026-10-21/phase_b_input/phase_b_case_study_input.json'))
  .filter(c => ['ts_zod_04', 'ts_zod_05', 'ts_zod_08'].includes(c.case_id));

function match(sym, t) {
  const fp = (sym.filePath || '').replace(/\\/g, '/').toLowerCase();
  const tp = t.file_path.toLowerCase();
  return (fp.endsWith(tp) || tp.endsWith(fp)) && (sym.name === t.symbol_name.split('.').pop() || sym.name === t.symbol_name);
}
const short = p => ({
  names: p ? p.historicalNames : null, evo: p && p.evolutionType, conf: p && p.confidence,
  msg: p && (p.commitMessage || '').slice(0, 90), diffLen: p && (p.diffText || '').length, depth: p && p.historyDepth
});

(async () => {
  if (execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO }).toString().trim() !== PIN) throw new Error('isolated clone not at pin');
  const idx = await indexRepository(REPO, { forceRebuild: true });
  const syms = Array.from(idx.symbols.values());
  const ha = new HistoricalRetrievalAdapter();
  const hist = await ha.indexRepositoryHistory(REPO, syms, { maxCommits: 50, startCommit: PIN, firstParentOnly: false });
  const cands = syms.map(s => ({ symbol: s, historyProfile: hist.profileMap.get(s.id) || null }));
  const withEvidence = cands.filter(c => c.historyProfile && ((c.historyProfile.historicalNames || []).length || (c.historyProfile.commitMessage || '').trim() || (c.historyProfile.diffText || '').trim()));
  console.log('symbols', syms.length, '| profiles with evidence', withEvidence.length, '| stats', JSON.stringify(hist.stats || {}));
  const byFile = {};
  for (const c of withEvidence) { const f = c.symbol.filePath.replace(/\\/g, '/'); byFile[f] = (byFile[f] || 0) + 1; }
  console.log('files with most evidence-bearing symbols:', Object.entries(byFile).sort((a, b) => b[1] - a[1]).slice(0, 6));

  for (const c of cases) {
    const t = c.target_symbols[0];
    console.log('\n==========', c.case_id, '| target', t.symbol_name, t.file_path, '| query:', c.query.query_text);
    const tgts = cands.filter(x => match(x.symbol, t));
    for (const x of tgts) console.log('  target symbol', x.symbol.id, x.symbol.symbolType, 'lines', JSON.stringify(x.symbol.range), '| profile', JSON.stringify(short(x.historyProfile)));
    const q = QueryProcessor.process(c.query.query_text);
    console.log('  query terms', JSON.stringify(q.terms));
    const ranked = ha.rankHistoricalOnly(q, cands, {}, { enforceCandidateParity: true })
      .sort((a, b) => b.score - a.score || (a.symbol.id || a.symbol.name).localeCompare(b.symbol.id || b.symbol.name));
    console.log('  symbols with B2 score > 0:', ranked.filter(r => r.score > 0).length);
    const ti = ranked.findIndex(r => match(r.symbol, t));
    if (ti >= 0) console.log('  TARGET rank', ti + 1, 'score', ranked[ti].score.toFixed(4), 'reasons', JSON.stringify(ranked[ti].reasons || []).slice(0, 300));
    else console.log('  TARGET has no B2 score');
    for (const r of ranked.slice(0, 6)) {
      console.log('   top', r.score.toFixed(4), r.symbol.name, r.symbol.filePath.replace(/\\/g, '/').split('/').slice(-2).join('/'),
        '| evo', r.historyProfile && r.historyProfile.evolutionType, '| msg', (r.historyProfile && r.historyProfile.commitMessage || '').slice(0, 60),
        '| reasons', JSON.stringify(r.reasons || []).slice(0, 160));
    }
  }
})().catch(e => { console.error(e); process.exit(1); });
