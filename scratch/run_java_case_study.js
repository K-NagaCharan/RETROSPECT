#!/usr/bin/env node
/**
 * scratch/run_java_case_study.js
 *
 * Driver for the Java rename case study (FINALIZATION_PLAN.md, experiment E1).
 * Runs scratch/evaluate_snapshot_worker.js (the worker that produced the 2026-10-20
 * measurements) once per repository snapshot, without any snapshot cache, and
 * writes only into a new output directory.
 *
 * Usage:
 *   node scratch/run_java_case_study.js --dataset <category_b_repaired.json> \
 *        --clones <isolated clones dir> --out <new dir> [--horizon 50] \
 *        [--repos slug1,slug2] [--repo-dir slug=folder ...] [--plan-only]
 *
 * --plan-only  Read-only: validates pins/origins with git and writes the worker inputs
 *              and a plan manifest to --out. Does not run the worker. May point at D:/clones.
 * (default)    Execute: runs the worker. The worker runs `git checkout --detach <pin>` in
 *              each clone, so --clones must NOT be D:/clones (or inside it) and every clone
 *              must have a clean working tree.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync, spawnSync } = require('child_process');

const RETROSPECT_DIR = path.resolve(__dirname, '..');
const WORKER = path.join(__dirname, 'evaluate_snapshot_worker.js');
const PROTECTED_CLONES_DIR = path.resolve('D:/clones');

const DEFAULT_REPO_DIRS = {
  'checkstyle/checkstyle': 'checkstyle',
  'graphhopper/graphhopper': 'graphhopper',
  'undertow-io/undertow': 'undertow',
  'datastax/java-driver': 'datastax-java-driver'
};

// Same cohort sets as scratch/run_full_multirepo_evaluation.js:239-240. The worker uses the
// cohort only for a descriptive outcome string; it never affects scores or ranks.
const LEGACY_IN_POLICY = new Set(['CASE-HIST-JAVA-0105', 'CASE-HIST-JAVA-0013', 'CASE-HIST-JAVA-0005', 'CASE-HIST-JAVA-0047', 'CASE-HIST-JAVA-0049']);
const LEGACY_QUARANTINED = new Set(['CASE-HIST-JAVA-0048', 'CASE-HIST-JAVA-0050', 'CASE-HIST-JAVA-0031', 'CASE-HIST-JAVA-0034']);

// Source files whose content determines ranks; fingerprinted in the run manifest.
const FINGERPRINT_FILES = [
  'scratch/evaluate_snapshot_worker.js',
  'scratch/run_java_case_study.js',
  'src/git/GitHistoryReader.js',
  'src/git/historyWindow.js',
  'src/retrieval/HistoricalRetrievalAdapter.js',
  'src/retrieval/RRFv2.js',
  'src/structural/retrieval/StructuralRetriever.js',
  'src/structural/query/QueryProcessor.js',
  'src/matcher/FunctionMatcher.js'
];

function parseArgs(argv) {
  const opts = { horizon: 50, planOnly: false, repos: null, repoDirs: { ...DEFAULT_REPO_DIRS } };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`Missing value for ${a}`);
      return argv[++i];
    };
    if (a === '--dataset') opts.dataset = next();
    else if (a === '--clones') opts.clones = next();
    else if (a === '--out') opts.out = next();
    else if (a === '--horizon') opts.horizon = parseInt(next(), 10);
    else if (a === '--repos') opts.repos = next().split(',').map(s => s.trim()).filter(Boolean);
    else if (a === '--repo-dir') {
      const [slug, dir] = next().split('=');
      opts.repoDirs[slug] = dir;
    } else if (a === '--plan-only') opts.planOnly = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  for (const req of ['dataset', 'clones', 'out']) {
    if (!opts[req]) throw new Error(`--${req} is required`);
  }
  if (!Number.isInteger(opts.horizon) || opts.horizon <= 0) throw new Error('--horizon must be a positive integer');
  return opts;
}

function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function git(repoPath, args) {
  return execFileSync('git', ['-c', 'core.longpaths=true', ...args], { cwd: repoPath, stdio: 'pipe', windowsHide: true }).toString().trim();
}

function tryGit(repoPath, args) {
  try {
    return { ok: true, out: git(repoPath, args) };
  } catch (e) {
    return { ok: false, out: '' };
  }
}

function isInside(child, parent) {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/** Convert category_b_repaired.json records into worker cases (same shape as run_full_multirepo_evaluation.js:243-275). */
function buildCases(rawCases) {
  return rawCases.map(raw => {
    const ts = (raw.target_symbols && raw.target_symbols[0]) || {};
    const symName = ts.symbol_name || '';
    let dist = raw.commit_distance_k;
    if (dist === undefined && raw.commit_distance !== undefined) dist = raw.commit_distance;
    let cohort = 'distance_stratified_diagnostic';
    if (LEGACY_IN_POLICY.has(raw.case_id)) cohort = 'in_policy_primary';
    else if (LEGACY_QUARANTINED.has(raw.case_id)) cohort = 'quarantined_negative';
    return {
      case_id: raw.case_id,
      dataset_source: 'category_b_repaired',
      cohort,
      language: raw.target_language || 'Java',
      repository_id: raw.repository_id,
      pin_sha: raw.source_revision_sha || raw.evaluation_pin_sha,
      origin_commit: (raw.historical_evidence && raw.historical_evidence.origin_commit_sha) || null,
      commit_distance_k: dist === undefined ? null : dist,
      query_text: raw.query ? (raw.query.query_text || raw.query_text) : '',
      target: {
        symbol_name: symName,
        short_name: symName.split('.').pop(),
        file_path: ts.file_path || '',
        line_range: ts.line_range || [0, 0]
      },
      hard_negatives: raw.hard_negatives || [],
      historical_evidence: raw.historical_evidence || null
    };
  });
}

/** Group cases by repository::pin, preserving dataset order. */
function groupSnapshots(cases) {
  const map = new Map();
  for (const c of cases) {
    const key = `${c.repository_id}::${c.pin_sha}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(c);
  }
  return map;
}

function prepareOutputDir(out) {
  const resolved = path.resolve(out);
  if (fs.existsSync(resolved)) {
    throw new Error(`Output directory already exists; refusing to overwrite: ${resolved}`);
  }
  fs.mkdirSync(resolved, { recursive: true });
  return resolved;
}

function writeOut(outDir, name, content) {
  const p = path.join(outDir, name);
  if (!isInside(p, outDir)) throw new Error(`Refusing to write outside output dir: ${p}`);
  fs.writeFileSync(p, content, 'utf8');
  return p;
}

function toCsv(rows, cols) {
  const esc = v => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n') + '\n';
}

function run(argv) {
  const opts = parseArgs(argv);
  const datasetPath = path.resolve(opts.dataset);
  const clonesDir = path.resolve(opts.clones);

  if (!opts.planOnly && isInside(clonesDir, PROTECTED_CLONES_DIR)) {
    throw new Error(`Execute mode checks out pins inside each clone; refusing to use ${clonesDir}. Use isolated clones or --plan-only.`);
  }

  const rawCases = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
  let cases = buildCases(rawCases);
  if (opts.repos) {
    const unknown = opts.repos.filter(r => !cases.some(c => c.repository_id === r));
    if (unknown.length) throw new Error(`--repos not present in dataset: ${unknown.join(', ')}`);
    cases = cases.filter(c => opts.repos.includes(c.repository_id));
  }
  const snapshots = groupSnapshots(cases);

  // Pre-flight (read-only): resolve every clone, pin and origin before writing anything.
  const preflight = [];
  for (const [key, snapCases] of snapshots) {
    const [repoSlug, pinSha] = key.split('::');
    const dirName = opts.repoDirs[repoSlug];
    if (!dirName) throw new Error(`No clone folder mapped for ${repoSlug}`);
    const repoPath = path.join(clonesDir, dirName);
    if (!fs.existsSync(repoPath)) throw new Error(`Clone not found: ${repoPath}`);
    if (!tryGit(repoPath, ['cat-file', '-e', `${pinSha}^{commit}`]).ok) throw new Error(`Pin ${pinSha} missing in ${repoPath}`);
    const status = tryGit(repoPath, ['status', '--porcelain']);
    if (!opts.planOnly && (!status.ok || status.out !== '')) {
      throw new Error(`Clone ${repoPath} has a dirty or unreadable working tree; refusing to check out.`);
    }
    for (const c of snapCases) {
      c.origin_exists = c.origin_commit ? tryGit(repoPath, ['cat-file', '-e', `${c.origin_commit}^{commit}`]).ok : null;
      if (c.commit_distance_k == null && c.origin_exists) {
        // Informational only (same as the original runner); horizon status uses the retrieval window.
        const d = tryGit(repoPath, ['rev-list', '--count', `${c.origin_commit}..${pinSha}`]);
        c.commit_distance_k = d.ok ? parseInt(d.out, 10) : null;
      }
    }
    preflight.push({
      repoSlug, pinSha, repoPath,
      case_ids: snapCases.map(c => c.case_id),
      head_before: tryGit(repoPath, ['rev-parse', 'HEAD']).out || null,
      branch_before: tryGit(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD']).out || null
    });
  }

  const outDir = prepareOutputDir(opts.out);
  const manifest = {
    experiment: 'E1_java_rename_case_study',
    mode: opts.planOnly ? 'plan-only' : 'execute',
    started_utc: new Date().toISOString(),
    configuration: {
      search_horizon: opts.horizon,
      traversal: 'git log --topo-order -n <H> <pin> (merge-aware)',
      b1: 'StructuralRetriever',
      b2: 'HistoricalRetrievalAdapter.rankHistoricalOnly (enforceCandidateParity)',
      b3: 'HistoricalRetrievalAdapter.fuseScores structural 0.60 / historical 0.40',
      b4: 'fuseRRFv2 k=60 weightStructural 0.50 weightHistorical 0.50',
      snapshot_cache: 'not used'
    },
    dataset: { path: datasetPath, sha256: sha256File(datasetPath), records: rawCases.length, selected: cases.length },
    clones_dir: clonesDir,
    worker: WORKER,
    source_fingerprints: Object.fromEntries(FINGERPRINT_FILES.map(f => [f, sha256File(path.join(RETROSPECT_DIR, f))])),
    retrospect_git: {
      head: tryGit(RETROSPECT_DIR, ['rev-parse', 'HEAD']).out,
      porcelain_entries: tryGit(RETROSPECT_DIR, ['status', '--porcelain']).out.split(/\r?\n/).filter(Boolean).length
    },
    runtime: { node: process.version, git: tryGit(RETROSPECT_DIR, ['--version']).out },
    snapshots: []
  };

  const allResults = [];
  for (const pf of preflight) {
    const snapCases = snapshots.get(`${pf.repoSlug}::${pf.pinSha}`);
    const tag = `${pf.repoSlug.replace(/[^a-zA-Z0-9_-]/g, '_')}__${pf.pinSha.substring(0, 12)}`;
    const input = { repoSlug: pf.repoSlug, repoPath: pf.repoPath, pinSha: pf.pinSha, cases: snapCases, searchHorizon: opts.horizon };
    const inputPath = writeOut(outDir, `worker_input__${tag}.json`, JSON.stringify(input, null, 2));
    const snapInfo = { ...pf, worker_input: path.basename(inputPath) };

    if (!opts.planOnly) {
      const outputPath = path.join(outDir, `worker_output__${tag}.json`);
      const t0 = Date.now();
      const res = spawnSync(process.execPath, [WORKER, inputPath, outputPath], { cwd: RETROSPECT_DIR, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      writeOut(outDir, `worker_log__${tag}.txt`, `${res.stdout || ''}\n--- stderr ---\n${res.stderr || ''}`);
      snapInfo.worker_exit_code = res.status;
      snapInfo.worker_seconds = (Date.now() - t0) / 1000;
      snapInfo.head_after = tryGit(pf.repoPath, ['rev-parse', 'HEAD']).out || null;
      snapInfo.branch_after = tryGit(pf.repoPath, ['rev-parse', '--abbrev-ref', 'HEAD']).out || null;
      snapInfo.dirty_after = tryGit(pf.repoPath, ['status', '--porcelain']).out !== '';
      if (res.status !== 0 || !fs.existsSync(outputPath)) {
        manifest.snapshots.push(snapInfo);
        writeOut(outDir, 'run_manifest.json', JSON.stringify(manifest, null, 2));
        throw new Error(`Worker failed for ${pf.repoSlug} (exit ${res.status}); see worker_log__${tag}.txt`);
      }
      snapInfo.worker_output = path.basename(outputPath);
      const out = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
      allResults.push(...out.perCaseResults);
    }
    manifest.snapshots.push(snapInfo);
  }

  if (!opts.planOnly) {
    const rows = allResults.map(r => ({
      case_id: r.case_id,
      repository_id: r.repository_id,
      pin_sha: r.pin_sha,
      origin_commit: r.origin_commit,
      b1_rank: r.b1_rank, b1_score: r.b1_score,
      b2_rank: r.b2_rank, b2_score: r.b2_score,
      b3_rank: r.b3_linear_rank, b3_score: r.b3_linear_score,
      b4_rank: r.b4_rrf_rank, b4_score: r.b4_rrf_score,
      target_in_pool: r.target_in_pool,
      stage_a_status: r.stage_a_status,
      history_window_position: r.history_window_position,
      stage_b_match_type: r.stage_b_match_type
    }));
    const cols = Object.keys(rows[0] || { case_id: '' });
    writeOut(outDir, 'per_case_results.csv', toCsv(rows, cols));
    manifest.cases_evaluated = rows.length;
  }
  manifest.finished_utc = new Date().toISOString();
  writeOut(outDir, 'run_manifest.json', JSON.stringify(manifest, null, 2));
  return { outDir, manifest };
}

if (require.main === module) {
  try {
    const { outDir, manifest } = run(process.argv.slice(2));
    console.log(`${manifest.mode}: ${manifest.snapshots.length} snapshot(s), ${manifest.dataset.selected} case(s) -> ${outDir}`);
  } catch (err) {
    console.error(`run_java_case_study: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { parseArgs, buildCases, groupSnapshots, run, isInside };
