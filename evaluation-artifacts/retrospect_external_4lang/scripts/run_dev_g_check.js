// Phase 1.4: G correctness check on the development split of retrospect_evaluation_2026-10-21 (Tasks B and A, H=400).
// Read-only on that workspace; output in phase1/dev_check_run. Asserts G == B1 whenever L is empty; G's MRR is not reported.
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const W = path.resolve(__dirname, '..');
const OLD = 'D:/base papers considered/Test creation/retrospect_evaluation_2026-10-21';
const inv = {};
for (const l of fs.readFileSync(path.join(OLD, 'REPOSITORY_INVENTORY.csv'), 'utf8').trim().split('\n').slice(1)) { const c = l.split(','); inv[c[0]] = c[1]; }
const cases = fs.readFileSync(path.join(OLD, 'retrieval_cases', 'development', 'cases.jsonl'), 'utf8').trim().split('\n').map(JSON.parse)
  .filter(c => ['B_identifier', 'A_current_doc'].includes(c.task));
const repos = [...new Set(cases.map(c => c.repository))].sort();
const args = ['--max-old-space-size=8192', path.join(__dirname, 'run_benchmark.js'), '--cases', path.join(OLD, 'retrieval_cases', 'development', 'cases.jsonl'),
  '--out', path.join(W, 'phase1', 'dev_check_run'), '--horizons', '400', '--match', 'exact', '--tasks', 'B_identifier,A_current_doc',
  ...repos.flatMap(r => ['--repo-path', `${r}=${inv[r]}`])];
const r = spawnSync(process.execPath, args, { stdio: 'inherit' });
process.exit(r.status);
