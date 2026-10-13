const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Validates the structural consistency of a lineage benchmark dataset.
 * Note: Automated checks verify structural prerequisites (commits, files, symbols, ancestors),
 * but do NOT claim to prove semantic lineage, which requires human/manual code diff auditing.
 */
function validateBenchmark(datasetPath) {
  console.log(`================================================================`);
  console.log(`Validating Lineage Benchmark: ${path.basename(datasetPath)}`);
  console.log(`================================================================\n`);

  if (!fs.existsSync(datasetPath)) {
    console.error(`Dataset not found at ${datasetPath}`);
    process.exit(1);
  }

  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
  console.log(`Total records: ${dataset.length}\n`);

  function runGit(repoPath, args) {
    try {
      return execFileSync('git', args, { cwd: repoPath, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, windowsHide: true });
    } catch (e) {
      return null;
    }
  }

  let passCount = 0;
  let issueCount = 0;
  const issuesByCase = [];
  const typeCounts = {};
  const langCounts = {};

  for (let i = 0; i < dataset.length; i++) {
    const item = dataset[i];
    const caseId = item.case_id;
    const repoRel = item.repo_path || `data/external_repos/${item.repository}`;
    const repoAbs = path.resolve(__dirname, '..', repoRel);
    const caseIssues = [];
    const suspiciousWarnings = [];

    // Track statistics
    langCounts[item.language] = (langCounts[item.language] || 0) + 1;
    typeCounts[item.evolution_type] = (typeCounts[item.evolution_type] || 0) + 1;

    // Check repository exists
    if (!fs.existsSync(repoAbs)) {
      caseIssues.push(`Repository path does not exist: ${repoAbs}`);
    } else {
      const cur = item.current_symbol;
      const pred = item.predecessor_symbol;

      // 1. Current Commit check
      if (!cur.commitHash) {
        caseIssues.push('Missing current_symbol.commitHash');
      } else {
        const curType = runGit(repoAbs, ['cat-file', '-t', cur.commitHash]);
        if (!curType || curType.trim() !== 'commit') {
          caseIssues.push(`Current commit hash '${cur.commitHash}' not found locally in Git object store`);
        }
      }

      // 2. Predecessor Commit check
      if (item.is_valid_predecessor) {
        if (!pred || !pred.commitHash) {
          caseIssues.push('is_valid_predecessor is true but predecessor_symbol.commitHash is missing');
        } else {
          const predType = runGit(repoAbs, ['cat-file', '-t', pred.commitHash]);
          if (!predType || predType.trim() !== 'commit') {
            caseIssues.push(`Predecessor commit hash '${pred.commitHash}' not found locally in Git object store`);
          }
        }
      }

      // 3. Ancestor / Parent check
      if (cur.commitHash && pred && pred.commitHash) {
        // Is predecessor a valid ancestor of current commit?
        const isAncestor = runGit(repoAbs, ['merge-base', '--is-ancestor', pred.commitHash, cur.commitHash]);
        if (isAncestor === null) {
          caseIssues.push(`Predecessor commit ${pred.commitHash.slice(0, 8)} is NOT an ancestor of current commit ${cur.commitHash.slice(0, 8)}`);
        }
      }

      // 4. Current File & Symbol presence
      if (cur.commitHash && cur.filePath) {
        const curContent = runGit(repoAbs, ['show', `${cur.commitHash}:${cur.filePath}`]);
        if (curContent === null) {
          caseIssues.push(`Current file '${cur.filePath}' does not exist at commit ${cur.commitHash.slice(0, 8)}`);
        } else if (cur.name) {
          if (!curContent.includes(cur.name)) {
            caseIssues.push(`Current symbol '${cur.name}' not found in '${cur.filePath}' at commit ${cur.commitHash.slice(0, 8)}`);
          }
        }
      }

      // 5. Predecessor File & Symbol presence
      if (item.is_valid_predecessor && pred && pred.commitHash && pred.filePath) {
        const predContent = runGit(repoAbs, ['show', `${pred.commitHash}:${pred.filePath}`]);
        if (predContent === null) {
          caseIssues.push(`Predecessor file '${pred.filePath}' does not exist at commit ${pred.commitHash.slice(0, 8)}`);
        } else if (pred.name) {
          if (!predContent.includes(pred.name)) {
            caseIssues.push(`Predecessor symbol '${pred.name}' not found in '${pred.filePath}' at commit ${pred.commitHash.slice(0, 8)}`);
          }
        }
      }

      // 6. Suspicious heuristics
      if (cur.commitHash && pred && pred.commitHash && cur.filePath) {
        const diff = runGit(repoAbs, ['diff', pred.commitHash, cur.commitHash, '--', cur.filePath]);
        if (diff !== null) {
          const diffLines = diff.split('\n').filter(l => (l.startsWith('+') || l.startsWith('-')) && !l.startsWith('+++') && !l.startsWith('---'));
          if (item.evolution_type === 'rewrite' && diffLines.length <= 4) {
            suspiciousWarnings.push(`Evolution labeled 'rewrite' but only ${diffLines.length} diff lines in file (possible routine edit)`);
          }
          if (diffLines.length === 0 && item.evolution_type !== 'hard_negative' && item.evolution_type !== 'move') {
            suspiciousWarnings.push(`0 diff lines found between revisions for file '${cur.filePath}'`);
          }
        }
      }

      // 7. Flag test-only symbols
      if (cur.filePath && /(^|[/\\])(test|tests|spec|specs|__tests__)[/\\]/i.test(cur.filePath)) {
        suspiciousWarnings.push(`Symbol is located in test directory ('${cur.filePath}')`);
      }
    }

    if (caseIssues.length > 0) {
      issueCount++;
      issuesByCase.push({ caseId, status: 'FAILED', errors: caseIssues, warnings: suspiciousWarnings });
      console.log(`[FAIL] ${caseId} (${item.repository}):`);
      caseIssues.forEach(err => console.log(`   ERROR: ${err}`));
      suspiciousWarnings.forEach(w => console.log(`   WARN:  ${w}`));
    } else if (suspiciousWarnings.length > 0) {
      passCount++;
      console.log(`[WARN] ${caseId} (${item.repository}):`);
      suspiciousWarnings.forEach(w => console.log(`   WARN:  ${w}`));
    } else {
      passCount++;
      console.log(`[PASS] ${caseId} (${item.repository}) - Structural prerequisites verified.`);
    }
  }

  console.log(`\n================================================================`);
  console.log(`Validation Summary:`);
  console.log(`- Structurally Valid: ${passCount} / ${dataset.length}`);
  console.log(`- Structurally Failed: ${issueCount} / ${dataset.length}`);
  console.log(`- Language Breakdown:`, langCounts);
  console.log(`- Evolution Type Breakdown:`, typeCounts);
  console.log(`================================================================\n`);

  return { passCount, issueCount, issuesByCase };
}

// Allow CLI execution with path argument
const targetPath = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '../data/benchmark_lineage.json');
validateBenchmark(targetPath);
