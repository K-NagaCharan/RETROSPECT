const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function runGit(repoPath, args) {
  try {
    return execFileSync('git', args, { cwd: repoPath, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, windowsHide: true });
  } catch (err) {
    return null;
  }
}

async function auditBenchmark() {
  const benchmarkPath = path.resolve(__dirname, '../data/benchmark_lineage.json');
  const dataset = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8'));

  console.log(`Auditing ${dataset.length} cases from benchmark_lineage.json...\n`);

  const auditResults = [];

  for (const item of dataset) {
    const fullRepo = path.resolve(__dirname, '..', item.repo_path);
    const curHash = item.current_symbol.commitHash;
    const predHash = item.predecessor_symbol.commitHash;

    const res = {
      case_id: item.case_id,
      language: item.language,
      repo: item.repository,
      claimed_type: item.evolution_type,
      current_name: item.current_symbol.name,
      current_file: item.current_symbol.filePath,
      pred_name: item.predecessor_symbol.name,
      pred_file: item.predecessor_symbol.filePath,
      cur_hash: curHash ? curHash.substring(0, 8) : null,
      pred_hash: predHash ? predHash.substring(0, 8) : null,
      cur_file_exists: false,
      pred_file_exists: false,
      cur_symbol_found: false,
      pred_symbol_found: false,
      git_diff_lines: 0,
      diff_snippet: '',
      actual_evolution_type: item.evolution_type,
      status: 'VERIFIED',
      audit_notes: []
    };

    // 1. Check current commit and file
    const curFileContent = runGit(fullRepo, ['show', `${curHash}:${item.current_symbol.filePath}`]);
    if (curFileContent !== null) {
      res.cur_file_exists = true;
      if (curFileContent.includes(item.current_symbol.name)) {
        res.cur_symbol_found = true;
      } else {
        res.audit_notes.push(`Current symbol '${item.current_symbol.name}' not found in ${item.current_symbol.filePath} at ${curHash.substring(0, 8)}`);
      }
    } else {
      res.audit_notes.push(`Current file ${item.current_symbol.filePath} not found at ${curHash.substring(0, 8)}`);
    }

    // 2. Check predecessor commit and file
    if (predHash && item.predecessor_symbol.filePath) {
      const predFileContent = runGit(fullRepo, ['show', `${predHash}:${item.predecessor_symbol.filePath}`]);
      if (predFileContent !== null) {
        res.pred_file_exists = true;
        if (item.predecessor_symbol.name && predFileContent.includes(item.predecessor_symbol.name)) {
          res.pred_symbol_found = true;
        } else if (item.predecessor_symbol.name) {
          res.audit_notes.push(`Predecessor symbol '${item.predecessor_symbol.name}' not found in ${item.predecessor_symbol.filePath} at ${predHash.substring(0, 8)}`);
        }
      } else {
        res.audit_notes.push(`Predecessor file ${item.predecessor_symbol.filePath} not found at ${predHash.substring(0, 8)}`);
      }
    }

    // 3. Get exact diff between pred and cur
    if (predHash && curHash) {
      const diffRaw = runGit(fullRepo, ['diff', predHash, curHash, '--', item.current_symbol.filePath]) || '';
      const lines = diffRaw.split('\n');
      const diffLines = lines.filter(l => (l.startsWith('+') || l.startsWith('-')) && !l.startsWith('+++') && !l.startsWith('---'));
      res.git_diff_lines = diffLines.length;
      res.diff_snippet = diffLines.slice(0, 15).join('\n');
    }

    // 4. Audit evolution category granularity
    // Check if claimed 'rewrite' is actually only a minor 1-2 line routine modification
    if (item.evolution_type === 'rewrite') {
      if (res.git_diff_lines <= 4) {
        res.actual_evolution_type = 'routine_modification';
        res.audit_notes.push(`Claimed 'rewrite' has only ${res.git_diff_lines} changed lines; reclassified as routine_modification`);
      }
    }

    // Check if test-only file
    const isTest = /(^|[/\\])(test|tests|spec|specs)[/\\]/i.test(item.current_symbol.filePath);
    res.is_test_symbol = isTest;
    if (isTest) {
      res.audit_notes.push('Symbol is located in test directory');
    }

    auditResults.push(res);
  }

  // Print audit report
  console.log('--- CASE BY CASE AUDIT SUMMARY ---');
  for (const r of auditResults) {
    const noteStr = r.audit_notes.length > 0 ? ` [NOTE: ${r.audit_notes.join('; ')}]` : '';
    console.log(`[${r.case_id}] ${r.repo} | ${r.claimed_type} -> ${r.actual_evolution_type} | ${r.current_name} (${r.cur_hash}) vs ${r.pred_name || 'NONE'} (${r.pred_hash || 'NONE'}) | diffLines=${r.git_diff_lines}${noteStr}`);
  }

  fs.writeFileSync(path.resolve(__dirname, '../data/audit_lineage_report.json'), JSON.stringify(auditResults, null, 2), 'utf8');
  console.log('\nAudit report saved to data/audit_lineage_report.json');
}

auditBenchmark().catch(console.error);
