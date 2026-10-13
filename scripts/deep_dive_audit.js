const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const originalBenchmark = JSON.parse(fs.readFileSync('data/benchmark_lineage.json', 'utf8'));

function runGit(repo, args) {
  try {
    return execFileSync('git', args, { cwd: path.resolve('data/external_repos', repo), encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  } catch (e) {
    return null;
  }
}

const audit = [];

for (const item of originalBenchmark) {
  const repo = item.repository;
  const cur = item.current_symbol;
  const pred = item.predecessor_symbol;
  
  const entry = {
    case_id: item.case_id,
    language: item.language,
    repository: item.repository,
    claimed_evolution_type: item.evolution_type,
    cur_name: cur.name,
    cur_file: cur.filePath,
    cur_commit: cur.commitHash,
    pred_name: pred.name,
    pred_file: pred.filePath,
    pred_commit: pred.commitHash,
    claimed_is_valid: item.is_valid_predecessor,
    claimed_rationale: item.evidence?.rationale || '',
    cur_commit_exists: false,
    pred_commit_exists: false,
    cur_file_exists: false,
    pred_file_exists: false,
    cur_symbol_found: false,
    pred_symbol_found: false,
    is_direct_parent: false,
    diff_lines_count: 0,
    diff_summary: '',
    verdict: 'VERIFIED', // VERIFIED, CORRECTED, UNCERTAIN, REJECTED
    corrections: {},
    audit_findings: []
  };

  // 1. Commit check
  if (cur.commitHash && runGit(repo, ['cat-file', '-t', cur.commitHash])) {
    entry.cur_commit_exists = true;
  } else {
    entry.audit_findings.push(`Current commit ${cur.commitHash} does not exist`);
  }

  if (pred.commitHash) {
    if (runGit(repo, ['cat-file', '-t', pred.commitHash])) {
      entry.pred_commit_exists = true;
    } else {
      entry.audit_findings.push(`Predecessor commit ${pred.commitHash} does not exist`);
    }
  }

  // 2. Parent check
  if (entry.cur_commit_exists && entry.pred_commit_exists) {
    const parentList = runGit(repo, ['rev-parse', `${cur.commitHash}^`]);
    if (parentList && parentList.trim() === pred.commitHash) {
      entry.is_direct_parent = true;
    } else {
      const isAncestor = runGit(repo, ['merge-base', '--is-ancestor', pred.commitHash, cur.commitHash]);
      if (isAncestor === null) {
        entry.audit_findings.push(`Pred commit is not ancestor of cur commit`);
      } else {
        entry.audit_findings.push(`Pred commit is ancestor but not direct parent`);
      }
    }
  }

  // 3. File & symbol check
  if (entry.cur_commit_exists) {
    const curContent = runGit(repo, ['show', `${cur.commitHash}:${cur.filePath}`]);
    if (curContent !== null) {
      entry.cur_file_exists = true;
      if (curContent.includes(cur.name)) {
        entry.cur_symbol_found = true;
      } else {
        entry.audit_findings.push(`Current symbol '${cur.name}' not found in ${cur.filePath}`);
      }
    } else {
      entry.audit_findings.push(`Current file ${cur.filePath} not found at ${cur.commitHash.slice(0, 8)}`);
    }
  }

  if (entry.pred_commit_exists && pred.filePath) {
    const predContent = runGit(repo, ['show', `${pred.commitHash}:${pred.filePath}`]);
    if (predContent !== null) {
      entry.pred_file_exists = true;
      if (pred.name && predContent.includes(pred.name)) {
        entry.pred_symbol_found = true;
      } else if (pred.name) {
        entry.audit_findings.push(`Predecessor symbol '${pred.name}' not found in ${pred.filePath}`);
      }
    } else {
      entry.audit_findings.push(`Predecessor file ${pred.filePath} not found at ${pred.commitHash.slice(0, 8)}`);
    }
  }

  // 4. Git diff
  if (entry.cur_commit_exists && entry.pred_commit_exists && entry.cur_file_exists) {
    const diff = runGit(repo, ['diff', pred.commitHash, cur.commitHash, '--', cur.filePath]);
    if (diff) {
      const changed = diff.split('\n').filter(l => (l.startsWith('+') || l.startsWith('-')) && !l.startsWith('+++') && !l.startsWith('---'));
      entry.diff_lines_count = changed.length;
      entry.diff_summary = changed.slice(0, 6).join(' | ');
    }
  }

  audit.push(entry);
}

fs.writeFileSync('data/initial_audit_pass.json', JSON.stringify(audit, null, 2));
console.log(`Audited ${audit.length} cases.`);
const problems = audit.filter(a => a.audit_findings.length > 0);
console.log(`Cases with findings: ${problems.length}`);
for (const p of problems) {
  console.log(`[${p.case_id}] (${p.claimed_evolution_type}) ${p.cur_name} vs ${p.pred_name}: ${p.audit_findings.join('; ')}`);
}
