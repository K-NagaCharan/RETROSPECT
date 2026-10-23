const { execFileSync } = require('child_process');

/**
 * Shared definition of the historical search window.
 *
 * The historical retrieval path (HistoricalRetrievalAdapter.indexRepositoryHistory ->
 * GitHistoryReader.getCommitHistory) reads exactly the commits listed by
 *   git log --format=%H [--topo-order] [--first-parent] -n <maxCount> <resolved start>
 * Reachability labels must be computed against this same list, not against
 * `git rev-list --count origin..pin`, which counts every commit on every merged
 * branch and can exceed the window size while the origin is still inside it.
 */

/**
 * Build the `git log` arguments that define the window. Used by GitHistoryReader.getCommitHistory
 * so retrieval and reachability labelling cannot drift apart.
 */
function buildHistoryWindowLogArgs(startCommit, maxCount, options = {}) {
  const topoOrder = options.topoOrder !== undefined ? options.topoOrder : true;
  const args = ['log', '--format=%H'];
  if (topoOrder) {
    args.push('--topo-order');
  }
  if (options.firstParentOnly === true) {
    args.push('--first-parent');
  }
  args.push('-n', String(maxCount));
  args.push(startCommit);
  return args;
}

function gitSync(repoPath, args) {
  return execFileSync('git', ['-c', 'core.longpaths=true', ...args], {
    cwd: repoPath,
    stdio: 'pipe',
    windowsHide: true
  }).toString();
}

function tryGitSync(repoPath, args) {
  try {
    return { ok: true, out: gitSync(repoPath, args).trim() };
  } catch (e) {
    return { ok: false, out: '' };
  }
}

/**
 * Synchronously list the commit hashes historical retrieval reads, in retrieval order.
 * @returns {{resolvedStart: string, hashes: string[]}}
 */
function getHistoryWindowSync(repoPath, startCommit, maxCount, options = {}) {
  const resolvedStart = gitSync(repoPath, ['rev-parse', startCommit]).trim();
  const out = gitSync(repoPath, buildHistoryWindowLogArgs(resolvedStart, maxCount, options));
  const seen = new Set();
  const hashes = [];
  for (const h of out.split(/\r?\n/).map(s => s.trim()).filter(Boolean)) {
    if (!seen.has(h)) {
      seen.add(h);
      hashes.push(h);
    }
  }
  return { resolvedStart, hashes };
}

/**
 * Classify an origin commit against the retrieval window of a pin.
 *
 * status:
 *  - NO_ORIGIN            no origin commit supplied
 *  - PIN_UNRESOLVABLE     pin cannot be resolved in the repository
 *  - ORIGIN_NOT_FOUND     origin commit object does not exist in the repository
 *  - ORIGIN_NOT_ANCESTOR  origin exists but is not an ancestor of (or equal to) the pin
 *  - IN_WINDOW            origin is among the commits retrieval reads
 *  - OUTSIDE_WINDOW       origin is an ancestor of the pin but not among those commits
 *
 * origin_diff_analyzed reflects HistoricalRetrievalAdapter.indexRepositoryHistory, which
 * diffs window commits against their first parent except: the last commit in the list,
 * root commits, and (in merge-aware mode) merge commits.
 */
function classifyOriginInWindow(repoPath, originCommit, pinSha, maxCount, options = {}) {
  const result = {
    status: null,
    origin_exists: null,
    origin_is_ancestor: null,
    origin_is_merge: null,
    window_position: null,
    window_size: null,
    in_window: false,
    origin_diff_analyzed: false,
    rev_list_distance: null,
    window_command: null
  };

  if (!originCommit) {
    result.status = 'NO_ORIGIN';
    return result;
  }

  const pin = tryGitSync(repoPath, ['rev-parse', '--verify', '--quiet', `${pinSha}^{commit}`]);
  if (!pin.ok || !pin.out) {
    result.status = 'PIN_UNRESOLVABLE';
    return result;
  }

  const origin = tryGitSync(repoPath, ['rev-parse', '--verify', '--quiet', `${originCommit}^{commit}`]);
  result.origin_exists = origin.ok && !!origin.out;
  if (!result.origin_exists) {
    result.status = 'ORIGIN_NOT_FOUND';
    return result;
  }
  const originFull = origin.out;

  result.origin_is_ancestor = tryGitSync(repoPath, ['merge-base', '--is-ancestor', originFull, pin.out]).ok;
  if (!result.origin_is_ancestor) {
    result.status = 'ORIGIN_NOT_ANCESTOR';
    return result;
  }

  const dist = tryGitSync(repoPath, ['rev-list', '--count', `${originFull}..${pin.out}`]);
  result.rev_list_distance = dist.ok ? parseInt(dist.out, 10) : null;

  const parents = tryGitSync(repoPath, ['rev-list', '--parents', '-n', '1', originFull]);
  const parentCount = parents.ok ? parents.out.split(/\s+/).length - 1 : null;
  result.origin_is_merge = parentCount === null ? null : parentCount > 1;

  const { hashes } = getHistoryWindowSync(repoPath, pin.out, maxCount, options);
  result.window_size = hashes.length;
  result.window_command = `git ${buildHistoryWindowLogArgs(pin.out, maxCount, options).join(' ')}`;
  const idx = hashes.indexOf(originFull);
  if (idx === -1) {
    result.status = 'OUTSIDE_WINDOW';
    return result;
  }
  result.status = 'IN_WINDOW';
  result.in_window = true;
  result.window_position = idx + 1;
  const isLastListed = idx === hashes.length - 1;
  const skippedMerge = options.firstParentOnly !== true && result.origin_is_merge === true;
  const isRoot = parentCount === 0;
  result.origin_diff_analyzed = !isLastListed && !skippedMerge && !isRoot;
  return result;
}

/**
 * Map a window classification to the Stage A reachability status used in evaluation outputs.
 * Status names that existed before are kept; OUTSIDE_SEARCH_HORIZON now means
 * "origin is an ancestor of the pin but not among the commits retrieval reads".
 */
function stageAStatusFromWindow(classification, evidenceDiscovered, maxCount) {
  const c = classification;
  switch (c.status) {
    case 'NO_ORIGIN':
      return { status: 'NO_ORIGIN_SPECIFIED', reason: 'No origin_commit specified in case metadata.' };
    case 'PIN_UNRESOLVABLE':
      return { status: 'REACHABILITY_UNVERIFIABLE', reason: 'Pin commit cannot be resolved in the repository; the retrieval window cannot be computed.' };
    case 'ORIGIN_NOT_FOUND':
      return { status: 'NOT_IN_DAG', reason: 'Origin commit does not exist in the repository Git object database.' };
    case 'ORIGIN_NOT_ANCESTOR':
      return { status: 'NOT_ANCESTOR_OF_PIN', reason: 'Origin commit exists but is not an ancestor of the pin, so retrieval from the pin can never read it.' };
    case 'OUTSIDE_WINDOW':
      return { status: 'OUTSIDE_SEARCH_HORIZON', reason: `Origin commit is an ancestor of the pin but not among the ${c.window_size} commits read by ${c.window_command}.` };
    case 'IN_WINDOW':
      if (!c.origin_diff_analyzed) {
        return { status: 'IN_WINDOW_DIFF_NOT_ANALYZED', reason: `Origin commit is at window position ${c.window_position}/${maxCount}, but historical retrieval does not diff it (last listed commit, root commit, or merge commit in merge-aware mode).` };
      }
      if (!evidenceDiscovered) {
        return { status: 'NO_HISTORICAL_EVIDENCE', reason: `Origin commit is at window position ${c.window_position}/${maxCount}, but no relevant commit message or diff evidence was extracted for the target.` };
      }
      return { status: 'REACHABLE', reason: `Origin commit is at window position ${c.window_position}/${maxCount} and historical evidence was extracted.` };
    default:
      return { status: 'REACHABILITY_UNVERIFIABLE', reason: `Unknown window classification: ${c.status}` };
  }
}

module.exports = {
  buildHistoryWindowLogArgs,
  getHistoryWindowSync,
  classifyOriginInWindow,
  stageAStatusFromWindow
};
