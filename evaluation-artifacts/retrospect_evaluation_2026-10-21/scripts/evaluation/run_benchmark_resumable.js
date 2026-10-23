#!/usr/bin/env node
/**
 * Resumable, one-process-per-repository driver for run_benchmark.js.
 *
 * Why: in a single process, indexing guava's history broke the shared Tree-sitter extractor, and every later repository
 * indexed 0 symbols (StructuralIndex swallows extraction errors). A fresh process per repository isolates parser state.
 * Resume: a repository whose snapshot directory has a run_manifest.json with finished_utc is skipped. An unfinished
 * directory is renamed to <repo>.incomplete-<timestamp> (never deleted) and the repository is rerun.
 *
 * Usage: node run_benchmark_resumable.js --cases <cases.jsonl> --out <run dir> [--tasks B_identifier,C_docstring]
 *          [--horizons 50,400] [--order small-first]
 * Output: <run dir>/snapshots/<repo>/{case_results.jsonl,run_manifest.json}, <run dir>/progress.log,
 *         and, once every repository has finished, <run dir>/case_results.jsonl (merged) + run_manifest.json.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const a = { horizons: '50,400', tasks: null };
for (let i = 2; i < process.argv.length; i++) {
  const k = process.argv[i], v = process.argv[++i];
  if (k === '--cases') a.cases = v; else if (k === '--out') a.out = v; else if (k === '--tasks') a.tasks = v;
  else if (k === '--horizons') a.horizons = v; else throw new Error('unknown arg ' + k);
}
if (!a.cases || !a.out) throw new Error('--cases and --out are required');
const tasks = a.tasks ? new Set(a.tasks.split(',')) : null;
const cases = fs.readFileSync(a.cases, 'utf8').trim().split('\n').map(JSON.parse).filter(c => !tasks || tasks.has(c.task));
const byRepo = new Map();
for (const c of cases) { if (!byRepo.has(c.repository)) byRepo.set(c.repository, []); byRepo.get(c.repository).push(c); }
// Smallest repositories first, so most repositories finish early.
const repos = [...byRepo.keys()].sort((x, y) => byRepo.get(x).length - byRepo.get(y).length || x.localeCompare(y));
const snapDir = path.join(a.out, 'snapshots');
fs.mkdirSync(snapDir, { recursive: true });
const log = m => { const line = `${new Date().toISOString()} ${m}`; fs.appendFileSync(path.join(a.out, 'progress.log'), line + '\n'); console.log(line); };
const finished = d => { try { return !!JSON.parse(fs.readFileSync(path.join(d, 'run_manifest.json'), 'utf8')).finished_utc; } catch { return false; } };
log(`start cases=${a.cases} tasks=${a.tasks || 'all'} repos=${repos.length} cases=${cases.length}`);
const failed = [];
for (const repo of repos) {
  const d = path.join(snapDir, repo);
  if (finished(d)) { log(`skip ${repo} (finished)`); continue; }
  if (fs.existsSync(d)) { const moved = `${d}.incomplete-${Date.now()}`; fs.renameSync(d, moved); log(`moved unfinished ${repo} -> ${path.basename(moved)}`); }
  const tmp = path.join(snapDir, `${repo}.cases.jsonl`);
  fs.writeFileSync(tmp, byRepo.get(repo).map(c => JSON.stringify(c)).join('\n') + '\n');
  log(`run ${repo} (${byRepo.get(repo).length} cases)`);
  const r = spawnSync(process.execPath, ['--max-old-space-size=8192', path.join(__dirname, 'run_benchmark.js'), '--cases', tmp, '--out', d,
    '--horizons', a.horizons, '--match', 'exact'], { stdio: ['ignore', 'inherit', 'inherit'] });
  if (r.status !== 0 || !finished(d)) { failed.push(repo); log(`FAILED ${repo} exit=${r.status}`); } else log(`done ${repo}`);
}
const all = repos.every(r => finished(path.join(snapDir, r)));
if (all) {
  const rows = [], snaps = [];
  for (const repo of repos) {
    const d = path.join(snapDir, repo);
    rows.push(...fs.readFileSync(path.join(d, 'case_results.jsonl'), 'utf8').trim().split('\n').filter(Boolean));
    snaps.push(...JSON.parse(fs.readFileSync(path.join(d, 'run_manifest.json'), 'utf8')).snapshots);
  }
  fs.writeFileSync(path.join(a.out, 'case_results.jsonl'), rows.join('\n') + '\n');
  fs.writeFileSync(path.join(a.out, 'run_manifest.json'), JSON.stringify({ cases_file: a.cases, tasks: a.tasks, horizons: a.horizons, match: 'exact',
    driver: 'run_benchmark_resumable.js (one process per repository)', case_count: rows.length, finished_utc: new Date().toISOString(), snapshots: snaps }, null, 2));
  log(`ALL DONE: ${rows.length} case rows merged`);
} else log(`INCOMPLETE: failed=${failed.join(',') || 'none'}; rerun the same command to resume`);
process.exit(all ? 0 : 1);
