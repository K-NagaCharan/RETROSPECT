const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const GitHistoryReader = require('../../src/git/GitHistoryReader');
const {
  buildHistoryWindowLogArgs,
  getHistoryWindowSync,
  classifyOriginInWindow
} = require('../../src/git/historyWindow');
const RetrospectEvaluator = require('../../src/evaluation/RetrospectEvaluator');

// Regression tests for Stage A horizon labelling: status must follow the commits that
// historical retrieval actually reads (git log --topo-order -n H <pin>), not rev-list distance.
describe('Historical search window and Stage A horizon status', () => {
  const H = 50;
  const WINDOW_OPTS = { firstParentOnly: false, topoOrder: true };
  const evidence = { historicalNames: ['oldName'], commitMessage: 'rename oldName' };
  let testDir;
  let evaluator;

  function git(repo, args) {
    return execFileSync('git', args, { cwd: repo, encoding: 'utf8', windowsHide: true }).trim();
  }

  function createRepo(name) {
    const repo = fs.mkdtempSync(path.join(testDir, `${name}-`));
    git(repo, ['init', '-q', '-b', 'main']);
    git(repo, ['config', 'user.name', 'Retrospect Window Tester']);
    git(repo, ['config', 'user.email', 'window@example.com']);
    return repo;
  }

  function commit(repo, message) {
    git(repo, ['commit', '-q', '--allow-empty', '-m', message]);
    return git(repo, ['rev-parse', 'HEAD']);
  }

  function revListDistance(repo, origin, pin) {
    return parseInt(git(repo, ['rev-list', '--count', `${origin}..${pin}`]), 10);
  }

  // Linear repository: c[1]..c[55]; pin = c[55]; window = c[55]..c[6]
  let linear;
  // Merge repository: origin on a short merged branch, 48 mainline commits after the fork
  let merge;

  beforeAll(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'retrospect-history-window-tests-'));
    evaluator = new RetrospectEvaluator({ searchHorizon: H, verifyGitTree: false });

    const repo = createRepo('linear');
    const c = [null];
    for (let i = 1; i <= 55; i++) c.push(commit(repo, `c${i}`));
    git(repo, ['checkout', '-q', '-b', 'other', c[3]]);
    const unrelated = commit(repo, 'not merged into main');
    git(repo, ['checkout', '-q', 'main']);
    linear = { repo, c, pin: c[55], unrelated };

    const mrepo = createRepo('merge');
    const base = commit(mrepo, 'base');
    git(mrepo, ['checkout', '-q', '-b', 'side']);
    const origin = commit(mrepo, 'rename oldName -> newName');
    const side2 = commit(mrepo, 'side follow-up');
    git(mrepo, ['checkout', '-q', 'main']);
    const mainline = [];
    for (let i = 1; i <= 48; i++) mainline.push(commit(mrepo, `main ${i}`));
    git(mrepo, ['merge', '-q', '--no-ff', 'side', '-m', 'merge side']);
    const mergeCommit = git(mrepo, ['rev-parse', 'HEAD']);
    const p1 = commit(mrepo, 'p1');
    const p2 = commit(mrepo, 'p2');
    const pin = commit(mrepo, 'p3');
    merge = { repo: mrepo, base, origin, side2, mainline, mergeCommit, p1, p2, pin };
  }, 120000);

  afterAll(() => {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch (e) {}
  });

  test('window arguments are identical to the previous GitHistoryReader arguments', () => {
    expect(buildHistoryWindowLogArgs('abc', 50, { firstParentOnly: false, topoOrder: true }))
      .toEqual(['log', '--format=%H', '--topo-order', '-n', '50', 'abc']);
    expect(buildHistoryWindowLogArgs('abc', 50, { firstParentOnly: true, topoOrder: true }))
      .toEqual(['log', '--format=%H', '--topo-order', '--first-parent', '-n', '50', 'abc']);
    expect(buildHistoryWindowLogArgs('abc', 50, { topoOrder: false }))
      .toEqual(['log', '--format=%H', '-n', '50', 'abc']);
  });

  test('labelling window equals the commit list historical retrieval reads (merge fixture)', async () => {
    const reader = new GitHistoryReader();
    const commits = await reader.getCommitHistory(merge.repo, merge.pin, H, WINDOW_OPTS);
    const { hashes } = getHistoryWindowSync(merge.repo, merge.pin, H, WINDOW_OPTS);
    expect(hashes).toEqual(commits.map(cm => cm.hash));
    expect(hashes.length).toBe(H);
  });

  test('1 + 7. origin equal to pin is at window position 1 and REACHABLE', () => {
    const w = classifyOriginInWindow(linear.repo, linear.pin, linear.pin, H, WINDOW_OPTS);
    expect(w.status).toBe('IN_WINDOW');
    expect(w.window_position).toBe(1);
    expect(w.rev_list_distance).toBe(0);
    expect(w.origin_diff_analyzed).toBe(true);

    const a = evaluator.evaluateStageA(linear.repo, linear.pin, linear.pin, null, evidence);
    expect(a.reachability_status).toBe('REACHABLE');
    expect(a.origin_within_budget).toBe(true);
    expect(a.history_window_position).toBe(1);
  });

  test('1. origin at the second window position is REACHABLE', () => {
    const a = evaluator.evaluateStageA(linear.repo, linear.c[54], linear.pin, null, evidence);
    expect(a.reachability_status).toBe('REACHABLE');
    expect(a.history_window_position).toBe(2);
    expect(a.commit_distance).toBe(1);
  });

  test('2. origin at the final window position is in the window but its diff is not analyzed', () => {
    const w = classifyOriginInWindow(linear.repo, linear.c[6], linear.pin, H, WINDOW_OPTS);
    expect(w.status).toBe('IN_WINDOW');
    expect(w.window_position).toBe(50);
    expect(w.origin_diff_analyzed).toBe(false);

    const a = evaluator.evaluateStageA(linear.repo, linear.c[6], linear.pin, null, evidence);
    expect(a.origin_within_budget).toBe(true);
    expect(a.reachability_status).toBe('IN_WINDOW_DIFF_NOT_ANALYZED');
  });

  test('3. origin immediately outside the window is OUTSIDE_SEARCH_HORIZON', () => {
    const w = classifyOriginInWindow(linear.repo, linear.c[5], linear.pin, H, WINDOW_OPTS);
    expect(w.status).toBe('OUTSIDE_WINDOW');
    expect(w.window_position).toBeNull();
    expect(w.rev_list_distance).toBe(50);

    const a = evaluator.evaluateStageA(linear.repo, linear.c[5], linear.pin, null, evidence);
    expect(a.reachability_status).toBe('OUTSIDE_SEARCH_HORIZON');
    expect(a.origin_within_budget).toBe(false);
    expect(a.origin_is_ancestor).toBe(true);
  });

  test('4. rev-list distance > 50 but topological position within the window is REACHABLE', () => {
    // Fixture precondition: the old rev-list rule would have called this outside the horizon.
    expect(revListDistance(merge.repo, merge.origin, merge.pin)).toBeGreaterThan(H);

    const w = classifyOriginInWindow(merge.repo, merge.origin, merge.pin, H, WINDOW_OPTS);
    expect(w.status).toBe('IN_WINDOW');
    expect(w.window_position).toBeLessThanOrEqual(H);
    expect(w.origin_diff_analyzed).toBe(true);

    const a = evaluator.evaluateStageA(merge.repo, merge.origin, merge.pin, null, evidence);
    expect(a.reachability_status).toBe('REACHABLE');
    expect(a.origin_within_budget).toBe(true);
    expect(a.commit_distance).toBeGreaterThan(H);
  });

  test('4b. a supplied rev-list distance > 50 no longer overrides the measured window', () => {
    const a = evaluator.evaluateStageA(merge.repo, merge.origin, merge.pin, 62, evidence);
    expect(a.reachability_status).toBe('REACHABLE');
    expect(a.horizon_basis).toBe('retrieval_window');
  });

  test('4c. a mainline ancestor pushed past position 50 by the merged branch is OUTSIDE_SEARCH_HORIZON', () => {
    // main 1 is listed after the side-branch commits and 47 later mainline commits.
    const w = classifyOriginInWindow(merge.repo, merge.mainline[0], merge.pin, H, WINDOW_OPTS);
    expect(w.status).toBe('OUTSIDE_WINDOW');
    const a = evaluator.evaluateStageA(merge.repo, merge.mainline[0], merge.pin, null, evidence);
    expect(a.reachability_status).toBe('OUTSIDE_SEARCH_HORIZON');
  });

  test('5. missing origin commit is NOT_IN_DAG, never OUTSIDE_SEARCH_HORIZON', () => {
    const missing = '0123456789abcdef0123456789abcdef01234567';
    const w = classifyOriginInWindow(linear.repo, missing, linear.pin, H, WINDOW_OPTS);
    expect(w.status).toBe('ORIGIN_NOT_FOUND');
    expect(w.rev_list_distance).toBeNull();

    const a = evaluator.evaluateStageA(linear.repo, missing, linear.pin, null, evidence);
    expect(a.reachability_status).toBe('NOT_IN_DAG');
    expect(a.origin_in_dag).toBe(false);
    expect(a.origin_within_budget).toBe(false);
  });

  test('6. origin not reachable from the pin is NOT_ANCESTOR_OF_PIN, never OUTSIDE_SEARCH_HORIZON', () => {
    const w = classifyOriginInWindow(linear.repo, linear.unrelated, linear.pin, H, WINDOW_OPTS);
    expect(w.status).toBe('ORIGIN_NOT_ANCESTOR');
    expect(w.origin_exists).toBe(true);
    expect(w.rev_list_distance).toBeNull();

    const a = evaluator.evaluateStageA(linear.repo, linear.unrelated, linear.pin, null, evidence);
    expect(a.reachability_status).toBe('NOT_ANCESTOR_OF_PIN');
    expect(a.origin_in_dag).toBe(true);
    expect(a.origin_within_budget).toBe(false);
  });

  test('8. merge commit as origin is in the window but not diffed in merge-aware mode', () => {
    const w = classifyOriginInWindow(merge.repo, merge.mergeCommit, merge.pin, H, WINDOW_OPTS);
    expect(w.status).toBe('IN_WINDOW');
    expect(w.origin_is_merge).toBe(true);
    expect(w.origin_diff_analyzed).toBe(false);

    const a = evaluator.evaluateStageA(merge.repo, merge.mergeCommit, merge.pin, null, evidence);
    expect(a.reachability_status).toBe('IN_WINDOW_DIFF_NOT_ANALYZED');
  });

  test('unresolvable pin is REACHABILITY_UNVERIFIABLE', () => {
    const a = evaluator.evaluateStageA(linear.repo, linear.c[54], 'ffffffffffffffffffffffffffffffffffffffff', null, evidence);
    expect(a.reachability_status).toBe('REACHABILITY_UNVERIFIABLE');
    expect(a.origin_within_budget).toBe(false);
  });

  test('in-window origin without extracted evidence is NO_HISTORICAL_EVIDENCE', () => {
    const a = evaluator.evaluateStageA(linear.repo, linear.c[54], linear.pin, null, null);
    expect(a.reachability_status).toBe('NO_HISTORICAL_EVIDENCE');
    expect(a.origin_within_budget).toBe(true);
  });
});
