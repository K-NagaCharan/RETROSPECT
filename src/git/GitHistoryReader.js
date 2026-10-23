const { execFile } = require('child_process');
const path = require('path');
const { buildHistoryWindowLogArgs } = require('./historyWindow');

class GitHistoryReader {
  constructor(options = {}) {
    this.timeout = options.timeout || 60000;
    this.maxBuffer = options.maxBuffer || 20 * 1024 * 1024; // 20 MB
  }

  /**
   * Execute git command safely using execFile
   */
  async _execGit(repoPath, args) {
    return new Promise((resolve, reject) => {
      execFile('git', ['-c', 'core.longpaths=true', ...args], {
        cwd: repoPath,
        timeout: this.timeout,
        maxBuffer: this.maxBuffer,
        windowsHide: true
      }, (error, stdout, stderr) => {
        if (error) {
          const errMsg = `Git command failed: git ${args.join(' ')}\nError: ${error.message}\nStderr: ${stderr}`;
          const err = new Error(errMsg);
          err.code = error.code;
          err.stderr = stderr;
          return reject(err);
        }
        resolve(stdout);
      });
    });
  }

  /**
   * Resolve commit hash (e.g. 'HEAD' or short hash to full 40-char hash)
   */
  async resolveCommit(repoPath, revision = 'HEAD') {
    try {
      const out = await this._execGit(repoPath, ['rev-parse', revision]);
      return out.trim();
    } catch (err) {
      throw new Error(`Failed to resolve revision '${revision}' in '${repoPath}': ${err.message}`);
    }
  }

  /**
   * Get commit metadata: hash, parents, author, timestamp, subject, body
   */
  async getCommit(repoPath, commitHash) {
    // Format: Hash%x1fParents%x1fAuthorName%x1fAuthorEmail%x1fAuthorDate%x1fSubject%x1fBody
    const format = '%H%x1f%P%x1f%an%x1f%ae%x1f%aI%x1f%s%x1f%b';
    try {
      const out = await this._execGit(repoPath, ['show', '-s', `--format=${format}`, commitHash]);
      const parts = out.split('\x1f');
      if (parts.length < 7) {
        throw new Error(`Unexpected commit format output for ${commitHash}`);
      }
      const [hash, parentsRaw, authorName, authorEmail, authorDate, subject, body] = parts;
      const parents = parentsRaw.trim() ? parentsRaw.trim().split(/\s+/) : [];
      return {
        hash: hash.trim(),
        parents,
        isRoot: parents.length === 0,
        isMerge: parents.length > 1,
        author: {
          name: authorName.trim(),
          email: authorEmail.trim(),
          date: authorDate.trim()
        },
        subject: subject.trim(),
        body: body.trim(),
        message: `${subject.trim()}\n\n${body.trim()}`.trim()
      };
    } catch (err) {
      throw new Error(`Failed to get commit ${commitHash}: ${err.message}`);
    }
  }

  /**
   * Get linear, first-parent, or merge-aware commit history starting from a given commit.
   *
   * By default (options.firstParentOnly = false), uses merge-aware, topologically ordered
   * traversal (`--topo-order`) discovering commits across merged pull-request branches.
   *
   * History Horizon:
   * - In merge-aware mode (default): `maxCount` bounds the total number of ancestor commits
   *   traversed across all branches in topological order.
   * - In first-parent mode: `maxCount` bounds the number of first-parent steps along the primary spine.
   *
   * All retrieved commits are guaranteed to be ancestors of `startCommit` (the evaluation pin).
   * Commits are deduplicated in order of topological appearance to prevent duplicate entries.
   *
   * @param {string} repoPath Path to git repository
   * @param {string} [startCommit='HEAD'] Starting commit hash or ref (pin)
   * @param {number} [maxCount=50] Maximum number of commits to retrieve (counts total traversed commits)
   * @param {boolean|object} [options=false] Options object or boolean for firstParentOnly.
   *        If boolean: true = firstParentOnly, false = merge-aware.
   *        If object: { firstParentOnly: boolean, topoOrder: boolean }
   * @returns {Promise<Array<object>>} List of commit objects in topological order
   */
  async getCommitHistory(repoPath, startCommit = 'HEAD', maxCount = 50, options = false) {
    const isBool = typeof options === 'boolean';
    const firstParentOnly = isBool ? options : (options && options.firstParentOnly === true);
    const topoOrder = !isBool && options && options.topoOrder !== undefined ? options.topoOrder : true;

    const resolvedStart = await this.resolveCommit(repoPath, startCommit);
    // Shared with reachability labelling (historyWindow.js) so both read the same window.
    const args = buildHistoryWindowLogArgs(resolvedStart, maxCount, { firstParentOnly: firstParentOnly === true, topoOrder });

    const out = await this._execGit(repoPath, args);
    const rawHashes = out.split(/\r?\n/).map(h => h.trim()).filter(Boolean);

    // Deduplicate while preserving deterministic topological ordering
    const seen = new Set();
    const hashes = [];
    for (const h of rawHashes) {
      if (!seen.has(h)) {
        seen.add(h);
        hashes.push(h);
      }
    }

    const commits = [];
    for (const hash of hashes) {
      const commit = await this.getCommit(repoPath, hash);
      commits.push(commit);
    }
    return commits;
  }

  /**
   * Read historical file content at a specific commit
   * Returns string content or null if file did not exist
   */
  async getFileContent(repoPath, commitHash, filePath) {
    // Normalise path to forward slashes for git
    const gitPath = filePath.replace(/\\/g, '/');
    try {
      const out = await this._execGit(repoPath, ['show', `${commitHash}:${gitPath}`]);
      return out;
    } catch (err) {
      return null;
    }
  }

  /**
   * Get changed files between two commits or for a single commit vs its primary parent
   * Tracks added (A), modified (M), deleted (D), renamed (R) with old and new paths
   */
  async getChangedFiles(repoPath, commitHash, parentHash = null) {
    let args = [];
    if (parentHash) {
      args = ['diff-tree', '-r', '--name-status', '-M', '--no-commit-id', parentHash, commitHash];
    } else {
      // If root commit
      args = ['diff-tree', '-r', '--name-status', '-M', '--no-commit-id', '--root', commitHash];
    }

    const out = await this._execGit(repoPath, args);
    const lines = out.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    const changes = [];
    for (const line of lines) {
      const tokens = line.split(/\t+/);
      if (tokens.length < 2) continue;

      const statusRaw = tokens[0];
      const statusCode = statusRaw[0]; // 'A', 'M', 'D', 'R', etc.

      if (statusCode === 'R' && tokens.length >= 3) {
        changes.push({
          status: 'renamed',
          oldPath: tokens[1].replace(/\\/g, '/'),
          newPath: tokens[2].replace(/\\/g, '/'),
          similarityScore: parseInt(statusRaw.substring(1), 10) || 100
        });
      } else if (statusCode === 'A') {
        changes.push({
          status: 'added',
          oldPath: null,
          newPath: tokens[1].replace(/\\/g, '/')
        });
      } else if (statusCode === 'D') {
        changes.push({
          status: 'deleted',
          oldPath: tokens[1].replace(/\\/g, '/'),
          newPath: null
        });
      } else if (statusCode === 'M') {
        changes.push({
          status: 'modified',
          oldPath: tokens[1].replace(/\\/g, '/'),
          newPath: tokens[1].replace(/\\/g, '/')
        });
      } else {
        changes.push({
          status: 'other',
          rawStatus: statusRaw,
          oldPath: tokens[1].replace(/\\/g, '/'),
          newPath: tokens[tokens.length - 1].replace(/\\/g, '/')
        });
      }
    }

    return changes;
  }

  /**
   * Get unified diff for a specific file between parent and commit
   */
  async getFileDiff(repoPath, commitHash, parentHash, filePath) {
    const gitPath = filePath.replace(/\\/g, '/');
    let args = [];
    if (parentHash) {
      args = ['diff', parentHash, commitHash, '--', gitPath];
    } else {
      // root commit diff
      args = ['diff-tree', '-p', '--root', commitHash, '--', gitPath];
    }

    try {
      const diffText = await this._execGit(repoPath, args);
      return diffText;
    } catch (err) {
      return '';
    }
  }

  /**
   * Check if a path in commitHash was renamed from an older path in parentHash
   */
  async findPredecessorPath(repoPath, commitHash, parentHash, currentPath) {
    if (!parentHash) return null;
    const changes = await this.getChangedFiles(repoPath, commitHash, parentHash);
    const normalized = currentPath.replace(/\\/g, '/');

    for (const change of changes) {
      if (change.newPath === normalized) {
        if (change.status === 'renamed') {
          return change.oldPath;
        }
        if (change.status === 'added') {
          // File was newly added in commitHash, had no predecessor file in parentHash
          return null;
        }
        return normalized;
      }
    }
    // If not in changed files, file was untouched between parent and commit
    return normalized;
  }
}

module.exports = GitHistoryReader;
