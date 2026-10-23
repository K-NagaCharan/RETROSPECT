#!/usr/bin/env node
/**
 * Gate G3 for the parser-leak fix (Deviation 2):
 *  (a) the 317 KB guava stress repro: 6,000 extractions of PublicSuffixPatterns.java (pre-fix: aborted at #418);
 *  (b) a full guava structural index + H=400 history pass (the pass that aborted in v3) followed by a parser probe.
 * Pass = no abort, healthy probe, extractionFailures = 0 in both the index and the history pass.
 * Read-only on the repository. Usage: node gate_g3_guava.js <out.json>
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const R = 'D:/base papers considered/Retrospect';
const FunctionExtractor = require(path.join(R, 'src/parser/FunctionExtractor'));
const { indexRepository, clearIndexCache } = require(path.join(R, 'src/structural/index'));
const HistoricalRetrievalAdapter = require(path.join(R, 'src/retrieval/HistoricalRetrievalAdapter'));

const REPO = 'D:/clones/guava';
const STRESS_FILE = path.join(REPO, 'guava/src/com/google/thirdparty/publicsuffix/PublicSuffixPatterns.java');

async function probe() {
  try { return (await new FunctionExtractor().extract('class P { int f(int x) { return x + 1; } }', 'P.java', 'java')).symbols.length > 0; }
  catch { return false; }
}

(async () => {
  const out = { started_utc: new Date().toISOString(), retrospect_head: execFileSync('git', ['-C', R, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() };
  // (a) stress
  const src = fs.readFileSync(STRESS_FILE, 'utf8');
  const ex = new FunctionExtractor();
  let t = Date.now(), failedAt = null, err = null;
  for (let i = 1; i <= 6000; i++) {
    try { await ex.extract(src, STRESS_FILE, 'java'); } catch (e) { failedAt = i; err = String(e && (e.message || e.name)); break; }
  }
  out.stress = { file: STRESS_FILE, bytes: src.length, iterations: 6000, failed_at: failedAt, error: err, seconds: (Date.now() - t) / 1000, probe_after: await probe() };
  console.log('stress', JSON.stringify(out.stress));
  // (b) index + H=400 history pass at the clone HEAD
  const pin = execFileSync('git', ['-C', REPO, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  t = Date.now();
  clearIndexCache();
  const idx = await indexRepository(REPO, { forceRebuild: true });
  const syms = Array.from(idx.symbols.values());
  out.index = { pin, symbols: syms.length, extractionFailures: idx.extractionFailures, seconds: (Date.now() - t) / 1000, probe_after: await probe() };
  console.log('index', JSON.stringify(out.index));
  t = Date.now();
  const h = await new HistoricalRetrievalAdapter().indexRepositoryHistory(REPO, syms, { maxCommits: 400, startCommit: pin, firstParentOnly: false });
  out.history_H400 = { commitsAnalyzed: h.stats.commitsAnalyzed, changedFilesAnalyzed: h.stats.changedFilesAnalyzed, symbolsWithHistory: h.stats.symbolsWithHistory,
    extractionFailures: h.stats.extractionFailures, seconds: (Date.now() - t) / 1000, probe_after: await probe() };
  console.log('history_H400', JSON.stringify(out.history_H400));
  out.pass = out.stress.failed_at === null && out.stress.probe_after && out.index.probe_after && out.history_H400.probe_after &&
    out.index.extractionFailures.count === 0 && out.history_H400.extractionFailures.count === 0;
  out.finished_utc = new Date().toISOString();
  if (fs.existsSync(process.argv[2])) throw new Error('refusing to overwrite ' + process.argv[2]);
  fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 2));
  console.log('G3', out.pass ? 'PASS' : 'FAIL');
})().catch(e => { console.error('G3 ERROR', e); process.exit(1); });
