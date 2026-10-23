const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { buildCases, groupSnapshots, parseArgs, run } = require('../../scratch/run_java_case_study');

const CATB_DATASET = 'D:/base papers considered/Test creation/results/category_b_benchmark_repair_2026-10-19/category_b_repaired.json';

describe('run_java_case_study driver', () => {
  let tmp;

  function git(repo, args) {
    return execFileSync('git', args, { cwd: repo, encoding: 'utf8', windowsHide: true }).trim();
  }

  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'retrospect-case-study-tests-'));
  });

  afterAll(() => {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch (e) {}
  });

  const catbTest = fs.existsSync(CATB_DATASET) ? test : test.skip;

  catbTest('builds 29 worker cases in 4 snapshots from the Category B dataset (read-only)', () => {
    const raw = JSON.parse(fs.readFileSync(CATB_DATASET, 'utf8'));
    const cases = buildCases(raw);
    expect(cases).toHaveLength(29);
    const snaps = groupSnapshots(cases);
    expect([...snaps.keys()].map(k => k.split('::')[0]).sort()).toEqual([
      'checkstyle/checkstyle', 'datastax/java-driver', 'graphhopper/graphhopper', 'undertow-io/undertow'
    ]);
    const c13 = cases.find(c => c.case_id === 'CASE-HIST-JAVA-0013');
    expect(c13.pin_sha).toBe('10a3a0777ced10983ebe6266c998957c10dba8f0');
    expect(c13.origin_commit).toBe('24ead56cf961060af6e08399e999440ef6945f84');
    expect(c13.target.symbol_name).toBe('com.puppycrawl.tools.checkstyle.api.AbstractCheck.getViolations');
    expect(c13.target.short_name).toBe('getViolations');
    expect(c13.query_text).toMatch(/^Locate current implementation corresponding to historical method getMessages/);
    expect(c13.cohort).toBe('in_policy_primary');
    for (const c of cases) {
      expect(c.query_text).not.toBe('');
      expect(c.target.file_path).not.toBe('');
    }
  });

  test('defaults: horizon 50, execute mode; requires dataset, clones and out', () => {
    const o = parseArgs(['--dataset', 'd.json', '--clones', 'c', '--out', 'o']);
    expect(o.horizon).toBe(50);
    expect(o.planOnly).toBe(false);
    expect(() => parseArgs(['--dataset', 'd.json', '--clones', 'c'])).toThrow(/--out is required/);
  });

  test('execute mode refuses D:/clones and creates no output', () => {
    const out = path.join(tmp, 'never-created');
    expect(() => run(['--dataset', CATB_DATASET, '--clones', 'D:/clones', '--out', out]))
      .toThrow(/refusing to use/);
    expect(fs.existsSync(out)).toBe(false);
  });

  describe('end-to-end on a temporary Java repository', () => {
    let clones, repo, origin, pin, dataset;

    beforeAll(() => {
      clones = path.join(tmp, 'clones');
      repo = path.join(clones, 'toy-report');
      fs.mkdirSync(repo, { recursive: true });
      git(repo, ['init', '-q', '-b', 'main']);
      git(repo, ['config', 'user.name', 'Case Study Tester']);
      git(repo, ['config', 'user.email', 'case@example.com']);
      const file = path.join(repo, 'src/main/java/demo/Report.java');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const body = name => `package demo;\n\nimport java.util.List;\n\npublic class Report {\n  private List<String> items;\n\n  /** Returns the collected report entries. */\n  public List<String> ${name}() {\n    return items;\n  }\n\n  public int size() {\n    return items.size();\n  }\n}\n`;
      fs.writeFileSync(file, body('getMessages'));
      git(repo, ['add', '.']);
      git(repo, ['commit', '-q', '-m', 'Add Report']);
      fs.writeFileSync(file, body('getViolations'));
      git(repo, ['commit', '-q', '-am', 'Rename getMessages to getViolations']);
      origin = git(repo, ['rev-parse', 'HEAD']);
      fs.writeFileSync(path.join(repo, 'README.md'), 'toy\n');
      git(repo, ['add', '.']);
      git(repo, ['commit', '-q', '-m', 'Add readme']);
      pin = git(repo, ['rev-parse', 'HEAD']);

      dataset = path.join(tmp, 'toy_dataset.json');
      fs.writeFileSync(dataset, JSON.stringify([{
        case_id: 'CASE-TOY-0001',
        repository_id: 'toy/report',
        target_language: 'Java',
        source_revision_sha: pin,
        query: { query_text: 'Locate current implementation corresponding to historical method getMessages in Report' },
        target_symbols: [{ symbol_name: 'demo.Report.getViolations', file_path: 'src/main/java/demo/Report.java' }],
        historical_evidence: { origin_commit_sha: origin, change_type: 'rename' }
      }]));
    });

    test('plan-only writes the worker input and leaves the repository unchanged', () => {
      const out = path.join(tmp, 'plan');
      const { manifest } = run(['--dataset', dataset, '--clones', clones, '--repo-dir', 'toy/report=toy-report', '--out', out, '--plan-only']);
      expect(manifest.mode).toBe('plan-only');
      expect(manifest.configuration.search_horizon).toBe(50);
      const files = fs.readdirSync(out).sort();
      expect(files).toEqual(['run_manifest.json', `worker_input__toy_report__${pin.substring(0, 12)}.json`]);
      const input = JSON.parse(fs.readFileSync(path.join(out, files[1]), 'utf8'));
      expect(input.pinSha).toBe(pin);
      expect(input.searchHorizon).toBe(50);
      expect(input.repoPath).toBe(repo);
      expect(input.cases[0].commit_distance_k).toBe(1);
      expect(git(repo, ['rev-parse', 'HEAD'])).toBe(pin);
      expect(git(repo, ['status', '--porcelain'])).toBe('');
    });

    test('refuses an existing output directory', () => {
      const out = path.join(tmp, 'plan');
      expect(() => run(['--dataset', dataset, '--clones', clones, '--repo-dir', 'toy/report=toy-report', '--out', out, '--plan-only']))
        .toThrow(/already exists/);
    });

    test('execute runs the real worker, records B1-B4 ranks, and restores the clone', () => {
      const out = path.join(tmp, 'exec');
      const { manifest } = run(['--dataset', dataset, '--clones', clones, '--repo-dir', 'toy/report=toy-report', '--out', out]);
      const snap = manifest.snapshots[0];
      expect(snap.worker_exit_code).toBe(0);
      expect(snap.branch_after).toBe('main');
      expect(snap.head_after).toBe(pin);
      expect(snap.dirty_after).toBe(false);
      expect(manifest.cases_evaluated).toBe(1);

      const csv = fs.readFileSync(path.join(out, 'per_case_results.csv'), 'utf8').trim().split('\n');
      const header = csv[0].split(',');
      const row = Object.fromEntries(csv[1].split(',').map((v, i) => [header[i], v]));
      expect(row.case_id).toBe('CASE-TOY-0001');
      expect(row.target_in_pool).toBe('true');
      expect(row.history_window_position).toBe('2');
      for (const m of ['b1', 'b2', 'b3', 'b4']) {
        expect(Number.isInteger(Number(row[`${m}_rank`]))).toBe(true);
      }
      // History links the old name to the renamed method: B2 ranks it first.
      expect(row.b2_rank).toBe('1');
    }, 180000);
  });
});
