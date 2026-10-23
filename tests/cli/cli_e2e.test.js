const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { makeRenameRepo, run, git, withTempHome } = require('./helpers');

jest.setTimeout(180000);
const BIN = path.join(__dirname, '..', '..', 'bin', 'rtro.js');

describe('errors before init', () => {
  let home;
  beforeAll(() => { home = withTempHome(); });
  afterAll(() => home.restore());

  test('non-git directory gives a clear error', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtro-nogit-'));
    for (const argv of [['init'], ['search', 'x'], ['status']]) {
      const r = await run(argv, { cwd: dir });
      expect(r.code).toBe(1);
      expect(r.stderr).toMatch(/^Not inside a git repository/);
    }
  });

  test('search and ask before init print the init hint', async () => {
    const repo = makeRenameRepo();
    for (const argv of [['search', 'computeCartTotal'], ['ask', 'what happened to computeCartTotal?', '--dry-run']]) {
      const r = await run(argv, { cwd: repo });
      expect(r.code).toBe(1);
      expect(r.stderr.trim()).toBe('Not initialised — run: rtro init');
    }
    expect((await run(['status'], { cwd: repo })).stdout).toMatch(/Initialised: no — run: rtro init/);
  });
});

describe('end-to-end on a repository with a renamed function', () => {
  let home, repo;
  beforeAll(() => { home = withTempHome(); repo = makeRenameRepo(); });
  afterAll(() => home.restore());

  test('init builds both indexes, excludes .retrospect/ and leaves tracked files untouched', async () => {
    const r = await run(['init'], { cwd: repo });
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/structural index: \d+ symbols/);
    expect(r.stdout).toMatch(/history index: \d+ commits analysed/);
    for (const f of ['config.json', 'structural-index.json', 'history.json', 'meta.json']) expect(fs.existsSync(path.join(repo, '.retrospect', f))).toBe(true);
    expect(fs.readFileSync(path.join(repo, '.git', 'info', 'exclude'), 'utf8')).toMatch(/^\.retrospect\/$/m);
    expect(git(repo, ['status', '--porcelain'])).toBe('');
    // idempotent exclude line
    await run(['init'], { cwd: repo });
    expect(fs.readFileSync(path.join(repo, '.git', 'info', 'exclude'), 'utf8').match(/^\.retrospect\/$/mg)).toHaveLength(1);
  });

  test('status reports fresh index, window, sizes and provider', async () => {
    const r = await run(['status'], { cwd: repo, env: { RETROSPECT_MODEL: 'claude-test', ANTHROPIC_API_KEY: '' } });
    expect(r.stdout).toMatch(/Initialised: yes/);
    expect(r.stdout).toMatch(/-> fresh/);
    expect(r.stdout).toMatch(/History window: 400 commits/);
    expect(r.stdout).toMatch(/Index size on disk: structural [\d.]+ KB, history [\d.]+ KB/);
    expect(r.stdout).toMatch(/LLM: provider anthropic, model claude-test; ANTHROPIC_API_KEY is not set/);
  });

  test('search by the old name ranks the renamed function first, with its rename commit', async () => {
    const r = await run(['search', 'computeCartTotal'], { cwd: repo });
    expect(r.code).toBe(0);
    const lines = r.stdout.split('\n').filter(Boolean);
    expect(lines[0]).toMatch(/^ 1\. sumLineItems  src\/billing\.js:4$/);
    const renameSha = git(repo, ['rev-parse', 'HEAD']).slice(0, 7);
    expect(lines[1]).toMatch(new RegExp(`^    formerly computeCartTotal \\(renamed in ${renameSha}, \\d{4}-\\d{2}-\\d{2}\\)$`));
  });

  test('--json parses and identifies the lineage match', async () => {
    const r = await run(['search', 'where is computeCartTotal now?', '--json', '--k', '3'], { cwd: repo });
    const j = JSON.parse(r.stdout);
    expect(j.mode).toBe('lineage_gate');
    expect(j.extractedIdentifiers).toEqual(['computeCartTotal']);
    expect(j.results[0]).toMatchObject({ rank: 1, name: 'sumLineItems', file: 'src/billing.js', line: 4, historyMatch: true });
    expect(j.results[0].formerly.oldName).toBe('computeCartTotal');
    expect(j.results.length).toBeLessThanOrEqual(3);
  });

  test('ask --dry-run prints the full prompt and sources, with no network call', async () => {
    const fetchSpy = jest.fn();
    let stdout = '';
    const { main } = require('../../src/cli');
    const code = await main(['ask', 'what happened to computeCartTotal?', '--dry-run'], { cwd: repo, env: {}, fetch: fetchSpy,
      stdout: { write: s => { stdout += s; } }, stderr: { write: () => {} } });
    expect(code).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(stdout).toMatch(/=== SYSTEM ===[\s\S]*QUESTION\nwhat happened to computeCartTotal\?[\s\S]*CURRENT CODE\n\[1\] sumLineItems[\s\S]*HISTORICAL EVIDENCE\n- computeCartTotal → sumLineItems/);
    expect(stdout).toMatch(/Sources:\n- src\/billing\.js:4 \(sumLineItems\) — history: commit [0-9a-f]{7}/);
  });

  test('ask without a key fails with the variable name (after retrieval, before any request)', async () => {
    const r = await run(['ask', 'what happened to computeCartTotal?'], { cwd: repo, env: { ANTHROPIC_API_KEY: '', RETROSPECT_MODEL: 'm' } });
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/set the ANTHROPIC_API_KEY environment variable/);
  });

  test('stale index (HEAD changed) is detected and rebuilt on search', async () => {
    fs.appendFileSync(path.join(repo, 'src', 'billing.js'), '\nfunction roundToCents(x) { return Math.round(x * 100) / 100; }\n');
    git(repo, ['commit', '-qam', 'Add roundToCents']);
    const head = git(repo, ['rev-parse', 'HEAD']);
    expect((await run(['status'], { cwd: repo })).stdout).toMatch(/-> stale/);
    const r = await run(['search', 'roundToCents'], { cwd: repo });
    expect(r.stderr).toMatch(/^Index is stale \(indexed [0-9a-f]{7}, HEAD [0-9a-f]{7}\); rebuilding\.\.\.$/m);
    expect(r.stdout).toMatch(/roundToCents/);
    expect(JSON.parse(fs.readFileSync(path.join(repo, '.retrospect', 'meta.json'), 'utf8')).indexedHead).toBe(head);
    expect((await run(['status'], { cwd: repo })).stdout).toMatch(/-> fresh/);
    expect((await run(['search', 'computeCartTotal'], { cwd: repo })).stdout.split('\n')[0]).toMatch(/sumLineItems/);
  });

  test('the bin script runs as a process (--version, --help, search)', () => {
    const env = { ...process.env, NODE_OPTIONS: '' };
    const v = spawnSync(process.execPath, [BIN, '--version'], { cwd: repo, encoding: 'utf8', env });
    expect(v.stdout.trim()).toBe(require('../../package.json').version);
    const h = spawnSync(process.execPath, [BIN, 'search', '--help'], { cwd: repo, encoding: 'utf8', env });
    expect(h.stdout).toMatch(/Usage: rtro search/);
    const s = spawnSync(process.execPath, [BIN, 'search', 'computeCartTotal', '--json'], { cwd: repo, encoding: 'utf8', env });
    expect(JSON.parse(s.stdout).results[0].name).toBe('sumLineItems');
  });
});
