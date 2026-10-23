#!/usr/bin/env node
/**
 * Retrospect benchmark harness for the 2026-10-21 dataset.
 *
 * Ranking code (B1-B4) is copied verbatim from scratch/evaluate_snapshot_worker.js, which produced all prior
 * measurements; equivalence is checked by reproducing E2 ranks (scripts/evaluation/check_harness_equivalence.py).
 * Differences from the worker: no checkout (the repository must already be clean at the pin), one structural index
 * per snapshot shared across several history horizons, multiple accepted targets, explicit reachability/indexing
 * diagnostics, and logging of the top-5 B2 candidates' inherited historical names (for negative cases).
 *
 * Usage: node run_benchmark.js --cases <cases.jsonl> --out <new dir> --horizons 50,400
 *          [--match exact|worker] [--repo-path name=path ...] [--only-repos a,b] [--tasks B_identifier,D_negative]
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const R = 'D:/base papers considered/Retrospect';
const { indexRepository, clearIndexCache } = require(path.join(R, 'src/structural/index'));
const { StructuralRetriever } = require(path.join(R, 'src/structural/retrieval/StructuralRetriever'));
const QueryProcessor = require(path.join(R, 'src/structural/query/QueryProcessor'));
const HistoricalRetrievalAdapter = require(path.join(R, 'src/retrieval/HistoricalRetrievalAdapter'));
const { fuseRRFv2 } = require(path.join(R, 'src/retrieval/RRFv2'));
const { classifyOriginInWindow } = require(path.join(R, 'src/git/historyWindow'));
const FunctionExtractor = require(path.join(R, 'src/parser/FunctionExtractor'));
// Configuration G (lineage-match gate), a separate retrieval mode added at eval-v1; B1-B4 below are unchanged.
const { rankLineageGate } = require(path.join(R, 'src/retrieval/LineageGate'));

// Parser health probe. Tree-sitter's WASM runtime can abort (Emscripten ExitStatus "exit(1)") while parsing some historical
// file version; the module is process-wide, so every later parse throws and Retrospect swallows it as "no symbols". A
// history pass during which this happens silently loses the rest of its profiles. Probe after every stage and record it.
const PROBE = { java: ['P.java', 'class P { int f(int x) { return x + 1; } }'], python: ['p.py', 'def f(x):\n    return x + 1\n'],
  javascript: ['p.js', 'function f(x) { return x + 1; }'], typescript: ['p.ts', 'function f(x: number): number { return x + 1; }'] };
async function parserHealthy(lang) {
  const [file, code] = PROBE[lang] || PROBE.javascript;
  try { return (await new FunctionExtractor().extract(code, file, lang)).symbols.length > 0; } catch { return false; }
}

function args() {
  const a = { horizons: [50, 400], match: 'exact', repoPath: {}, onlyRepos: null, tasks: null };
  const v = process.argv;
  for (let i = 2; i < v.length; i++) {
    const k = v[i], n = () => v[++i];
    if (k === '--cases') a.cases = n();
    else if (k === '--out') a.out = n();
    else if (k === '--horizons') a.horizons = n().split(',').map(Number);
    else if (k === '--match') a.match = n();
    else if (k === '--repo-path') { const [x, y] = n().split('='); a.repoPath[x] = y; }
    else if (k === '--only-repos') a.onlyRepos = new Set(n().split(','));
    else if (k === '--tasks') a.tasks = new Set(n().split(','));
    else throw new Error('unknown arg ' + k);
  }
  if (!a.cases || !a.out) throw new Error('--cases and --out are required');
  return a;
}

const git = (repo, gargs) => execFileSync('git', ['-c', 'core.longpaths=true', ...gargs], { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const norm = p => (p || '').replace(/\\/g, '/').toLowerCase();

// Verbatim from evaluate_snapshot_worker.js
function checkTargetMatch(candSymbol, target) {
  if (!candSymbol || !target) return false;
  const candPath = (candSymbol.filePath || '').replace(/\\/g, '/').toLowerCase();
  const tgtPath = (target.file_path || '').replace(/\\/g, '/').toLowerCase();
  const fileMatch = candPath.endsWith(tgtPath) || tgtPath.endsWith(candPath);
  if (!fileMatch) return false;
  const tgtName = target.symbol_name || '';
  const tgtShort = tgtName.split('.').pop();
  const candName = candSymbol.name || '';
  const candQName = candSymbol.qualifiedName || '';
  const nameMatch = candName === tgtShort || candName === tgtName ||
    (candQName && (candQName === tgtName || candQName.endsWith('.' + tgtShort) || candQName.endsWith('.' + tgtName)));
  return !!nameMatch;
}

// Exact rule for the new dataset: file path suffix + identical qualified name.
function exactMatch(sym, t) {
  const fp = norm(sym.filePath);
  return fp.endsWith('/' + norm(t.file)) || fp === norm(t.file) ? (sym.qualifiedName === t.qualifiedName) : false;
}

async function main() {
  const a = args();
  if (fs.existsSync(a.out)) throw new Error(`refusing to overwrite ${a.out}`);
  let cases = fs.readFileSync(a.cases, 'utf8').trim().split('\n').map(JSON.parse);
  if (a.onlyRepos) cases = cases.filter(c => a.onlyRepos.has(c.repository));
  if (a.tasks) cases = cases.filter(c => a.tasks.has(c.task));
  const inv = {};
  for (const line of fs.readFileSync(path.join(__dirname, '..', 'REPOSITORY_INVENTORY.csv'), 'utf8').trim().split('\n').slice(1)) {
    const cols = line.split(',');
    inv[cols[0]] = cols[1];
  }
  fs.mkdirSync(a.out, { recursive: true });
  const outRows = fs.openSync(path.join(a.out, 'case_results.jsonl'), 'w');
  const snaps = new Map();
  for (const c of cases) {
    const k = `${c.repository}::${c.pin}`;
    if (!snaps.has(k)) snaps.set(k, []);
    snaps.get(k).push(c);
  }
  const manifest = { started_utc: new Date().toISOString(), horizons: a.horizons, match: a.match, cases_file: a.cases, case_count: cases.length, snapshots: [] };
  for (const [key, snapCases] of snaps) {
    const [repoName, pin] = key.split('::');
    const repo = a.repoPath[repoName] || inv[repoName];
    const head = git(repo, ['rev-parse', 'HEAD']);
    const dirty = git(repo, ['status', '--porcelain', '--untracked-files=no']);
    const snapInfo = { repository: repoName, path: repo, pin, head_before: head, clean_before: dirty === '', cases: snapCases.length };
    if (head !== pin || dirty !== '') {
      snapInfo.skipped = `repository not clean at pin (HEAD ${head.slice(0, 10)}, dirty=${dirty !== ''}); no checkout is performed`;
      manifest.snapshots.push(snapInfo);
      for (const c of snapCases) fs.writeSync(outRows, JSON.stringify({ case_id: c.case_id, task: c.task, repository: repoName, skipped: snapInfo.skipped }) + '\n');
      continue;
    }
    const t0 = Date.now();
    clearIndexCache();
    const structuralIndex = await indexRepository(repo, { forceRebuild: true });
    const allSymbols = Array.from(structuralIndex.symbols.values());
    snapInfo.symbols = allSymbols.length;
    // Guard: StructuralIndex swallows extraction errors, so a broken parser yields an empty index rather than an error.
    // Writing ranks from an empty index would silently record every target as "not retrieved".
    if (allSymbols.length === 0) throw new Error(`zero symbols indexed for ${repoName} at ${pin}; aborting (no results written for this snapshot)`);
    snapInfo.index_seconds = (Date.now() - t0) / 1000;
    // Exposed by the parser-leak fix (Retrospect fix/wasm-leak); undefined on pre-fix code.
    snapInfo.structural_extraction_failures = structuralIndex.extractionFailures;
    const lang = snapCases[0].language;
    snapInfo.parser_healthy_after_index = await parserHealthy(lang);
    if (!snapInfo.parser_healthy_after_index) throw new Error(`parser aborted during structural indexing of ${repoName}; aborting`);
    const retriever = new StructuralRetriever(structuralIndex);
    const perH = {};
    for (const H of a.horizons) {
      const t1 = Date.now();
      const histAdapter = new HistoricalRetrievalAdapter();
      const histResult = await histAdapter.indexRepositoryHistory(repo, allSymbols, { maxCommits: H, startCommit: pin, firstParentOnly: false });
      perH[H] = { histAdapter, profileMap: histResult.profileMap, candidates: allSymbols.map(sym => ({ symbol: sym, historyProfile: histResult.profileMap.get(sym.id) || null })), seconds: (Date.now() - t1) / 1000 };
      snapInfo[`history_seconds_H${H}`] = perH[H].seconds;
      snapInfo[`history_extraction_failures_H${H}`] = histResult.stats.extractionFailures;
      snapInfo[`history_symbols_with_history_H${H}`] = histResult.stats.symbolsWithHistory;
      snapInfo[`history_commits_analyzed_H${H}`] = histResult.stats.commitsAnalyzed;
      // false => the parser aborted during this history pass; its profiles are truncated (Retrospect as-run behaviour).
      snapInfo[`parser_healthy_after_history_H${H}`] = await parserHealthy(lang);
    }
    for (const c of snapCases) {
      const q = QueryProcessor.process(c.query);
      const targets = c.accepted_targets || [];
      const isTarget = sym => targets.some(t => a.match === 'worker'
        ? checkTargetMatch(sym, { symbol_name: t.qualifiedName || t.name, file_path: t.file })
        : exactMatch(sym, t));
      const row = { case_id: c.case_id, task: c.task, repository: repoName, language: c.language, cluster_id: c.cluster_id, pin,
        commit: c.commit, topo_position: c.topo_position, lineage_label: c.lineage_label,
        target_indexed: targets.length ? allSymbols.some(isTarget) : null, accepted_target_count: targets.length, horizons: {},
        parser_healthy_after_history: Object.fromEntries(a.horizons.map(H => [H, snapInfo[`parser_healthy_after_history_H${H}`]])) };
      // B1 (independent of H) - verbatim ordering
      const tb1 = process.hrtime.bigint();
      const b1_raw = retriever.rankCandidates(q, allSymbols);
      b1_raw.sort((x, y) => y.score - x.score || (x.symbol.id || x.symbol.name).localeCompare(y.symbol.id || y.symbol.name));
      row.b1_latency_ms = Number(process.hrtime.bigint() - tb1) / 1e6;
      const findRank = list => {
        for (let i = 0; i < list.length; i++) {
          const item = list[i];
          const sym = item.symbol || item;
          const score = typeof item.score === 'number' ? item.score : 0.0;
          if (score > 0 && isTarget(sym)) return { rank: i + 1, score: +score.toFixed(4) };
        }
        return { rank: null, score: 0 };
      };
      const b1 = findRank(b1_raw);
      row.b1_rank = b1.rank;
      row.b1_top1 = b1_raw[0] && b1_raw[0].score > 0 ? (b1_raw[0].symbol.qualifiedName || b1_raw[0].symbol.name) : null;
      for (const H of a.horizons) {
        const { histAdapter, candidates } = perH[H];
        const tb2 = process.hrtime.bigint();
        const b2_raw = histAdapter.rankHistoricalOnly(q, candidates, {}, { enforceCandidateParity: true });
        b2_raw.sort((x, y) => y.score - x.score || (x.symbol.id || x.symbol.name).localeCompare(y.symbol.id || y.symbol.name));
        const b2_ms = Number(process.hrtime.bigint() - tb2) / 1e6;
        const tg = process.hrtime.bigint();
        const g = rankLineageGate(c.query, b1_raw, b2_raw, perH[H].profileMap);
        const gate_ms = Number(process.hrtime.bigint() - tg) / 1e6;
        const sMap = new Map(); b1_raw.forEach(r => sMap.set(r.symbol.id, r.score));
        const hMap = new Map(); b2_raw.forEach(r => hMap.set(r.symbol.id, r.score));
        const b3_raw = candidates.map(cand => {
          const sScore = sMap.get(cand.symbol.id) || 0.0;
          const hScore = hMap.get(cand.symbol.id) || 0.0;
          return { symbol: cand.symbol, score: HistoricalRetrievalAdapter.fuseScores(sScore, hScore, { structural: 0.60, historical: 0.40 }) };
        });
        b3_raw.sort((x, y) => y.score - x.score || (x.symbol.id || x.symbol.name).localeCompare(y.symbol.id || y.symbol.name));
        const b4_raw = fuseRRFv2(candidates.map(cand => cand.symbol), b1_raw.map(r => ({ id: r.symbol.id, score: r.score })),
          b2_raw.map(r => ({ id: r.symbol.id, score: r.score })), { k: 60, weightStructural: 0.50, weightHistorical: 0.50 });
        const reach = c.commit ? classifyOriginInWindow(repo, c.commit, pin, H, { firstParentOnly: false, topoOrder: true }) : null;
        const qn = (c.old_name || c.query || '').toLowerCase();
        const top5 = b2_raw.filter(r => r.score > 0).slice(0, 5).map(r => {
          const p = candidates.find(cc => cc.symbol.id === r.symbol.id).historyProfile || {};
          return { qualifiedName: r.symbol.qualifiedName || r.symbol.name, file: r.symbol.filePath ? path.relative(repo, r.symbol.filePath).replace(/\\/g, '/') : null,
            score: +r.score.toFixed(4), historicalNames: p.historicalNames || [] };
        });
        row.horizons[H] = {
          b2_rank: findRank(b2_raw).rank, b3_rank: findRank(b3_raw).rank, b4_rank: findRank(b4_raw).rank,
          g_rank: findRank(g.ranking).rank, g_ids: g.ids, g_lineage_matches: g.lineageMatches,
          // assertion support: with an empty L, G must be the B1 ranking itself (same order, same scores)
          g_identical_to_b1: g.lineageMatches === 0 ? (g.ranking === b1_raw || (g.ranking.length === b1_raw.length && g.ranking.every((x, i) => x.symbol.id === b1_raw[i].symbol.id && x.score === b1_raw[i].score))) : null,
          g_latency_ms: row.b1_latency_ms + b2_ms + gate_ms, b2_latency_ms: b2_ms,
          reach_status: reach ? reach.status : null, window_position: reach ? reach.window_position : null, origin_diff_analyzed: reach ? reach.origin_diff_analyzed : null,
          b2_top5: top5,
          b2_false_lineage_claim_top10: c.task === 'D_negative'
            ? b2_raw.filter(r => r.score > 0).slice(0, 10).some(r => ((candidates.find(cc => cc.symbol.id === r.symbol.id).historyProfile || {}).historicalNames || []).some(n => n.toLowerCase() === qn))
            : null
        };
      }
      fs.writeSync(outRows, JSON.stringify(row) + '\n');
    }
    snapInfo.head_after = git(repo, ['rev-parse', 'HEAD']);
    snapInfo.clean_after = git(repo, ['status', '--porcelain', '--untracked-files=no']) === '';
    snapInfo.seconds_total = (Date.now() - t0) / 1000;
    manifest.snapshots.push(snapInfo);
    fs.writeFileSync(path.join(a.out, 'run_manifest.json'), JSON.stringify(manifest, null, 2));
    console.log(`${repoName}: ${snapCases.length} cases, ${snapInfo.symbols} symbols, ${snapInfo.seconds_total}s`);
  }
  fs.closeSync(outRows);
  manifest.finished_utc = new Date().toISOString();
  fs.writeFileSync(path.join(a.out, 'run_manifest.json'), JSON.stringify(manifest, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
