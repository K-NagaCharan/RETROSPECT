const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const dataset = JSON.parse(fs.readFileSync('data/benchmark_lineage.json', 'utf8'));

function runGit(repo, args) {
  try {
    return execFileSync('git', args, { cwd: path.resolve('data/external_repos', repo), encoding: 'utf8' });
  } catch (e) {
    return null;
  }
}

const detailedAudit = [];

for (const item of dataset) {
  const repo = item.repository;
  const cur = item.current_symbol;
  const pred = item.predecessor_symbol;

  const result = {
    case_id: item.case_id,
    language: item.language,
    repo: item.repository,
    claimed_type: item.evolution_type,
    cur_symbol: cur.name,
    cur_file: cur.filePath,
    cur_commit: cur.commitHash,
    pred_symbol: pred.name,
    pred_file: pred.filePath,
    pred_commit: pred.commitHash,
    is_valid_pred: item.is_valid_predecessor,
    issues: [],
    details: {}
  };

  // 1. Check current commit exists
  const curCommitExists = runGit(repo, ['cat-file', '-t', cur.commitHash]);
  if (!curCommitExists) {
    result.issues.push(`Current commit ${cur.commitHash} does not exist locally`);
  }

  // 2. Check current file exists at current commit
  let curFileContent = null;
  if (curCommitExists) {
    curFileContent = runGit(repo, ['show', `${cur.commitHash}:${cur.filePath}`]);
    if (curFileContent === null) {
      result.issues.push(`Current file ${cur.filePath} does not exist at ${cur.commitHash.slice(0, 8)}`);
    } else {
      // Check symbol exists in file
      if (!curFileContent.includes(cur.name)) {
        result.issues.push(`Current symbol '${cur.name}' not found in ${cur.filePath} at ${cur.commitHash.slice(0, 8)}`);
      }
    }
  }

  // 3. Predecessor commit check
  if (pred.commitHash) {
    const predCommitExists = runGit(repo, ['cat-file', '-t', pred.commitHash]);
    if (!predCommitExists) {
      result.issues.push(`Predecessor commit ${pred.commitHash} does not exist locally`);
    } else {
      let predFileContent = null;
      if (pred.filePath) {
        predFileContent = runGit(repo, ['show', `${pred.commitHash}:${pred.filePath}`]);
        if (predFileContent === null) {
          result.issues.push(`Predecessor file ${pred.filePath} does not exist at ${pred.commitHash.slice(0, 8)}`);
        } else if (pred.name) {
          if (!predFileContent.includes(pred.name)) {
            result.issues.push(`Predecessor symbol '${pred.name}' not found in ${pred.filePath} at ${pred.commitHash.slice(0, 8)}`);
          }
        }
      }
    }
  }

  // 4. Check parent relationship
  if (curCommitExists && pred.commitHash) {
    const parentList = runGit(repo, ['rev-list', '--parents', '-n', '1', cur.commitHash]);
    if (parentList) {
      const parts = parentList.trim().split(/\s+/);
      const parents = parts.slice(1);
      result.details.parents = parents;
      if (!parents.includes(pred.commitHash)) {
        // Is pred an ancestor?
        const isAncestor = runGit(repo, ['merge-base', '--is-ancestor', pred.commitHash, cur.commitHash]);
        if (isAncestor === null) {
          result.issues.push(`Predecessor commit ${pred.commitHash.slice(0, 8)} is neither direct parent nor ancestor of current commit ${cur.commitHash.slice(0, 8)}`);
        } else {
          result.details.is_indirect_ancestor = true;
        }
      } else {
        result.details.is_direct_parent = true;
      }
    }
  }

  // 5. Diff inspection
  if (curCommitExists && pred.commitHash && cur.filePath) {
    const diff = runGit(repo, ['diff', pred.commitHash, cur.commitHash, '--', cur.filePath]);
    if (diff) {
      const lines = diff.split('\n').filter(l => (l.startsWith('+') || l.startsWith('-')) && !l.startsWith('+++') && !l.startsWith('---'));
      result.details.diff_lines_count = lines.length;
      result.details.diff_lines = lines.slice(0, 10);
    } else {
      result.details.diff_lines_count = 0;
    }
  }

  detailedAudit.push(result);
}

fs.writeFileSync('data/detailed_audit_output.json', JSON.stringify(detailedAudit, null, 2));

console.log('=== SUMMARY OF AUDIT ISSUES ===');
for (const a of detailedAudit) {
  if (a.issues.length > 0) {
    console.log(`[${a.case_id}] ${a.repo} | ${a.claimed_type} | ${a.cur_symbol} -> ${a.pred_symbol || 'NONE'}`);
    for (const iss of a.issues) {
      console.log(`    ERROR: ${iss}`);
    }
  } else {
    const diffCount = a.details.diff_lines_count !== undefined ? a.details.diff_lines_count : 'N/A';
    console.log(`[${a.case_id}] OK | ${a.repo} | ${a.claimed_type} | diff=${diffCount} lines | ${a.cur_symbol} (${a.cur_commit?.slice(0,8)}) -> ${a.pred_symbol || 'NONE'} (${a.pred_commit?.slice(0,8)})`);
  }
}
