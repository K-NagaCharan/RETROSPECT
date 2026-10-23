const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const GitHistoryReader = require('../../src/git/GitHistoryReader');

describe('GitHistoryReader Merge-Aware Traversal and Regression Tests', () => {
  let testDir;
  let gitReader;

  function runGit(repoPath, args) {
    return execFileSync('git', args, { cwd: repoPath, encoding: 'utf8', windowsHide: true });
  }

  function createRepo(name) {
    const repoPath = fs.mkdtempSync(path.join(testDir, `${name}-`));
    runGit(repoPath, ['init', '-b', 'main']);
    runGit(repoPath, ['config', 'user.name', 'Retrospect Traversal Tester']);
    runGit(repoPath, ['config', 'user.email', 'traversal@example.com']);
    return repoPath;
  }

  function commitFile(repoPath, relPath, content, message) {
    const fullPath = path.join(repoPath, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
    runGit(repoPath, ['add', relPath]);
    runGit(repoPath, ['commit', '-m', message]);
    return runGit(repoPath, ['rev-parse', 'HEAD']).trim();
  }

  beforeAll(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'retrospect-git-reader-tests-'));
    gitReader = new GitHistoryReader();
  });

  afterAll(() => {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch (e) {}
  });

  test('1. Linear history compatibility: returns commits in correct order with metadata', async () => {
    const repo = createRepo('linear');
    const c1 = commitFile(repo, 'a.txt', 'v1', 'commit 1');
    const c2 = commitFile(repo, 'a.txt', 'v2', 'commit 2');
    const c3 = commitFile(repo, 'a.txt', 'v3', 'commit 3');

    const commits = await gitReader.getCommitHistory(repo, 'HEAD', 10);
    expect(commits.length).toBe(3);
    expect(commits.map(c => c.hash)).toEqual([c3, c2, c1]);

    expect(commits[0].subject).toBe('commit 3');
    expect(commits[0].parents).toEqual([c2]);
    expect(commits[0].isMerge).toBe(false);
    expect(commits[0].isRoot).toBe(false);

    expect(commits[2].hash).toBe(c1);
    expect(commits[2].isRoot).toBe(true);
    expect(commits[2].parents).toEqual([]);
  });

  test('2. Second-parent branch commit retrieval: merge-aware mode discovers PR branch commits', async () => {
    const repo = createRepo('pr-branch');
    const cRoot = commitFile(repo, 'app.js', 'console.log("init");\n', 'root commit');

    // Create PR branch with relevant commit
    runGit(repo, ['checkout', '-b', 'feature-pr']);
    const cBranch = commitFile(repo, 'app.js', 'console.log("feature change");\n', 'feature: relevant change on PR branch');

    // Return to main and commit on main
    runGit(repo, ['checkout', 'main']);
    const cMain = commitFile(repo, 'readme.md', '# Readme\n', 'main: update readme');

    // Merge PR branch into main with a merge commit
    runGit(repo, ['merge', 'feature-pr', '--no-ff', '-m', 'Merge pull request #42 from feature-pr']);
    const cMerge = runGit(repo, ['rev-parse', 'HEAD']).trim();

    // In default merge-aware mode, cBranch MUST be present
    const mergeAwareCommits = await gitReader.getCommitHistory(repo, cMerge, 10);
    const hashes = mergeAwareCommits.map(c => c.hash);

    expect(hashes).toContain(cBranch);
    expect(hashes).toContain(cMerge);
    expect(hashes).toContain(cMain);
    expect(hashes).toContain(cRoot);
    expect(hashes.length).toBe(4);
  });

  test('3. History horizon: relevant commit within configured horizon is retrieved', async () => {
    const repo = createRepo('horizon-within');
    const c1 = commitFile(repo, 'file.txt', 'line 1\n', 'c1');
    const c2 = commitFile(repo, 'file.txt', 'line 2\n', 'c2');
    const c3 = commitFile(repo, 'file.txt', 'line 3\n', 'c3: target change');
    const c4 = commitFile(repo, 'file.txt', 'line 4\n', 'c4');

    // Horizon of 3 from HEAD (c4) should include c4, c3, c2
    const commits = await gitReader.getCommitHistory(repo, 'HEAD', 3);
    const hashes = commits.map(c => c.hash);

    expect(commits.length).toBe(3);
    expect(hashes).toContain(c3);
    expect(hashes).toEqual([c4, c3, c2]);
  });

  test('4. History horizon: commit outside configured horizon is strictly excluded', async () => {
    const repo = createRepo('horizon-outside');
    const c1 = commitFile(repo, 'file.txt', 'target in old history\n', 'c1: relevant ancient commit');
    const c2 = commitFile(repo, 'file.txt', 'v2\n', 'c2');
    const c3 = commitFile(repo, 'file.txt', 'v3\n', 'c3');
    const c4 = commitFile(repo, 'file.txt', 'v4\n', 'c4');
    const c5 = commitFile(repo, 'file.txt', 'v5\n', 'c5');

    // Max count = 3 from c5 should only retrieve c5, c4, c3
    const commits = await gitReader.getCommitHistory(repo, c5, 3);
    const hashes = commits.map(c => c.hash);

    expect(commits.length).toBe(3);
    expect(hashes).not.toContain(c1);
    expect(hashes).not.toContain(c2);
    expect(hashes).toEqual([c5, c4, c3]);
  });

  test('5. Duplicate prevention: criss-cross / diamond merge graph returns unique commits', async () => {
    const repo = createRepo('diamond-merge');
    const cRoot = commitFile(repo, 'base.txt', 'base\n', 'root commit');

    // Branch A
    runGit(repo, ['checkout', '-b', 'branch-a']);
    const cA = commitFile(repo, 'a.txt', 'data A\n', 'commit A');

    // Branch B
    runGit(repo, ['checkout', 'main']);
    runGit(repo, ['checkout', '-b', 'branch-b']);
    const cB = commitFile(repo, 'b.txt', 'data B\n', 'commit B');

    // Merge A into B
    runGit(repo, ['merge', 'branch-a', '--no-ff', '-m', 'Merge A into B']);
    const cMergeB = runGit(repo, ['rev-parse', 'HEAD']).trim();

    // Main commits and merges both
    runGit(repo, ['checkout', 'main']);
    commitFile(repo, 'main.txt', 'data M\n', 'commit M');
    runGit(repo, ['merge', 'branch-a', '--no-ff', '-m', 'Merge A into main']);
    runGit(repo, ['merge', 'branch-b', '--no-ff', '-m', 'Merge B into main']);
    const cHead = runGit(repo, ['rev-parse', 'HEAD']).trim();

    const commits = await gitReader.getCommitHistory(repo, cHead, 50);
    const hashes = commits.map(c => c.hash);

    // Verify all hashes are unique (no duplicates)
    expect(new Set(hashes).size).toBe(hashes.length);
    expect(hashes).toContain(cA);
    expect(hashes).toContain(cB);
    expect(hashes).toContain(cRoot);
  });

  test('6. Deterministic topological ordering: child commits strictly precede parent commits', async () => {
    const repo = createRepo('topo-order');
    const c0 = commitFile(repo, 'base.txt', 'base content\n', 'c0');

    runGit(repo, ['checkout', '-b', 'feat1']);
    const cFeat1 = commitFile(repo, 'feat1.txt', 'feat1 content\n', 'feat1');

    runGit(repo, ['checkout', 'main']);
    runGit(repo, ['checkout', '-b', 'feat2']);
    const cFeat2 = commitFile(repo, 'feat2.txt', 'feat2 content\n', 'feat2');

    runGit(repo, ['checkout', 'main']);
    commitFile(repo, 'm.txt', 'main content\n', 'cMain');
    runGit(repo, ['merge', 'feat1', '--no-ff', '-m', 'Merge feat1']);
    runGit(repo, ['merge', 'feat2', '--no-ff', '-m', 'Merge feat2']);
    const cHead = runGit(repo, ['rev-parse', 'HEAD']).trim();

    // Run 5 repeated executions to test determinism
    const runs = [];
    for (let r = 0; r < 5; r++) {
      const res = await gitReader.getCommitHistory(repo, cHead, 50);
      runs.push(res.map(c => c.hash));
    }

    for (let r = 1; r < runs.length; r++) {
      expect(runs[r]).toEqual(runs[0]);
    }

    // Verify topological ordering: every parent must appear AFTER its child
    const commitMap = new Map();
    const commits = await gitReader.getCommitHistory(repo, cHead, 50);
    commits.forEach((c, idx) => commitMap.set(c.hash, idx));

    for (const commit of commits) {
      const childIdx = commitMap.get(commit.hash);
      for (const parentHash of commit.parents) {
        if (commitMap.has(parentHash)) {
          const parentIdx = commitMap.get(parentHash);
          expect(parentIdx).toBeGreaterThan(childIdx);
        }
      }
    }
  });

  test('7. Evaluation-pin ancestry restrictions: never retrieves commits outside pin ancestry', async () => {
    const repo = createRepo('pin-ancestry');
    const cRoot = commitFile(repo, 'base.txt', 'base\n', 'cRoot');

    // Pinned branch (main)
    const cPin1 = commitFile(repo, 'base.txt', 'pinned v1\n', 'cPin1');
    const cPin2 = commitFile(repo, 'base.txt', 'pinned v2\n', 'cPin2 (EVALUATION PIN)');

    // Divergent unmerged branch created after cPin2
    runGit(repo, ['checkout', '-b', 'future-divergent', cRoot]);
    const cUnmerged1 = commitFile(repo, 'unmerged.txt', 'u1\n', 'cUnmerged1');
    const cUnmerged2 = commitFile(repo, 'unmerged.txt', 'u2\n', 'cUnmerged2');

    // Query history pinned at cPin2
    const commits = await gitReader.getCommitHistory(repo, cPin2, 50);
    const hashes = commits.map(c => c.hash);

    expect(hashes).toContain(cPin2);
    expect(hashes).toContain(cPin1);
    expect(hashes).toContain(cRoot);
    // Commits from divergent branch MUST NEVER be retrieved
    expect(hashes).not.toContain(cUnmerged1);
    expect(hashes).not.toContain(cUnmerged2);
  });

  test('8. Existing first-parent-only behavior: explicit option restricts traversal to first-parent spine', async () => {
    const repo = createRepo('first-parent-mode');
    const cRoot = commitFile(repo, 'file.txt', 'init\n', 'cRoot');

    runGit(repo, ['checkout', '-b', 'feature-branch']);
    const cBranch = commitFile(repo, 'file.txt', 'feature\n', 'branch commit');

    runGit(repo, ['checkout', 'main']);
    const cMain = commitFile(repo, 'main.txt', 'main\n', 'main commit');
    runGit(repo, ['merge', 'feature-branch', '--no-ff', '-m', 'Merge feature-branch']);
    const cMerge = runGit(repo, ['rev-parse', 'HEAD']).trim();

    // Call with boolean true
    const boolCommits = await gitReader.getCommitHistory(repo, cMerge, 50, true);
    const boolHashes = boolCommits.map(c => c.hash);
    expect(boolHashes).toContain(cMerge);
    expect(boolHashes).toContain(cMain);
    expect(boolHashes).toContain(cRoot);
    expect(boolHashes).not.toContain(cBranch);

    // Call with options object { firstParentOnly: true }
    const objCommits = await gitReader.getCommitHistory(repo, cMerge, 50, { firstParentOnly: true });
    const objHashes = objCommits.map(c => c.hash);
    expect(objHashes).toEqual(boolHashes);

    // Call with default / options object { firstParentOnly: false }
    const mergeAwareCommits = await gitReader.getCommitHistory(repo, cMerge, 50, { firstParentOnly: false });
    const mergeAwareHashes = mergeAwareCommits.map(c => c.hash);
    expect(mergeAwareHashes).toContain(cBranch);
  });
});
