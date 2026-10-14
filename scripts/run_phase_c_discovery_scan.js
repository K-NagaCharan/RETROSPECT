const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { StructuralIndex } = require('../src/structural/index/StructuralIndex');
const LanguageAdapterRegistry = require('../src/languages/LanguageAdapterRegistry');

function runGit(repoPath, args) {
  return execFileSync('git', args, {
    cwd: repoPath,
    encoding: 'utf8',
    maxBuffer: 30 * 1024 * 1024,
    windowsHide: true
  });
}

async function runDiscoveryScan() {
  console.log('========================================================================');
  console.log('Retrospect Phase C: Discovery-Only Feasibility Scan');
  console.log('========================================================================\n');

  const repos = [
    { name: 'bottle', lang: 'python', ext: ['.py'] },
    { name: 'express', lang: 'javascript', ext: ['.js', '.mjs', '.cjs'] },
    { name: 'zod', lang: 'typescript', ext: ['.ts', '.tsx'] },
    { name: 'gson', lang: 'java', ext: ['.java'] }
  ];

  const scanSummary = {
    scan_timestamp: new Date().toISOString(),
    discovery_window_spec: 'Up to 150 most recent commits from pinned HEAD',
    repositories: {}
  };

  const issueRegex = /(?:fixes|closes|refs|issues?\/|#|gh-)([0-9]+)/gi;

  for (const r of repos) {
    const repoPath = path.resolve(__dirname, '../data/external_repos', r.name);
    console.log(`Scanning repository: ${r.name} (${repoPath})...`);

    // 1. Pinned HEAD and Commit Window
    const headCommit = runGit(repoPath, ['rev-parse', 'HEAD']).trim();
    const totalLocalCommits = parseInt(runGit(repoPath, ['rev-list', '--count', 'HEAD']).trim(), 10);
    const logOutput = runGit(repoPath, ['log', '-n', '150', '--format=%H%x09%an%x09%ad%x09%s', '--date=short']).trim().split('\n').filter(Boolean);
    const windowCommitCount = logOutput.length;

    const commitEntries = logOutput.map(line => {
      const parts = line.split('\t');
      return { hash: parts[0], author: parts[1], date: parts[2], subject: parts[3] };
    });

    const newestDate = commitEntries[0]?.date || 'unknown';
    const oldestDate = commitEntries[commitEntries.length - 1]?.date || 'unknown';

    // 2. Count commits with pre-existing issue / bug references
    const rawCommitLogs = runGit(repoPath, ['log', '-n', '150', '--format=%H%x09%s%x09%b%x00']).split('\0').filter(Boolean);
    let commitsWithIssueRefs = 0;
    const sampleIssueRefs = [];

    rawCommitLogs.forEach((raw, idx) => {
      const [h, s, b] = raw.split('\t');
      const text = `${s || ''} ${b || ''}`;
      const matches = text.match(issueRegex);
      if (matches) {
        commitsWithIssueRefs++;
        if (sampleIssueRefs.length < 5) {
          sampleIssueRefs.push({
            commit: (h || '').trim().slice(0, 8),
            subject: (s || '').trim().slice(0, 60),
            refs: Array.from(new Set(matches)).slice(0, 3)
          });
        }
      }
    });

    // 3. Callable Declarations at HEAD using Retrospect's StructuralIndex
    console.log(`  Extracting callable declarations at HEAD using StructuralIndex...`);
    const structuralIndex = new StructuralIndex();
    await structuralIndex.build(repoPath);
    const allSymbols = Array.from(structuralIndex.symbols.values());
    const totalCallablesAtHead = allSymbols.length;
    const callablesByType = Object.create(null);
    allSymbols.forEach(s => {
      const t = s.symbolType || s.kind || 'function';
      callablesByType[t] = (callablesByType[t] || 0) + 1;
    });
    const parsedFilesCount = structuralIndex.files.size;

    // 4. Candidate Evolution Events Detection across the discovery window
    console.log(`  Analyzing commit diffs across ${windowCommitCount} commits...`);
    let sourceModifyingCommits = 0;
    let candidateAdditions = 0;
    let candidateDeletions = 0;
    let candidateModifications = 0;
    let candidateSignatureChanges = 0;
    let candidateRewrites = 0;
    let candidateRenamesHeuristic = 0;
    let candidateMovesHeuristic = 0;

    for (let i = 0; i < commitEntries.length - 1; i++) {
      const child = commitEntries[i].hash;
      const parent = commitEntries[i + 1].hash;

      try {
        const rawDiffStat = runGit(repoPath, ['diff', '--numstat', parent, child]).split('\n').filter(Boolean);
        const sourceDiffs = rawDiffStat.filter(line => r.ext.some(ext => line.endsWith(ext)));

        if (sourceDiffs.length > 0) {
          sourceModifyingCommits++;
        }

        // Check for git-detected renames and moves
        const nameStatus = runGit(repoPath, ['diff', '--name-status', '-M', parent, child]).split('\n').filter(Boolean);
        for (const ns of nameStatus) {
          const parts = ns.split('\t');
          const code = parts[0][0]; // R = rename, M = modify, A = add, D = delete
          if (code === 'R') {
            const oldF = parts[1];
            const newF = parts[2];
            if (path.dirname(oldF) !== path.dirname(newF)) {
              candidateMovesHeuristic++;
            } else {
              candidateRenamesHeuristic++;
            }
          } else if (code === 'A' && r.ext.some(ext => parts[1]?.endsWith(ext))) {
            candidateAdditions++;
          } else if (code === 'D' && r.ext.some(ext => parts[1]?.endsWith(ext))) {
            candidateDeletions++;
          } else if (code === 'M' && r.ext.some(ext => parts[1]?.endsWith(ext))) {
            candidateModifications++;
          }
        }
      } catch (err) {
        // Continue if diff fails for root commit
      }
    }

    // Estimate rewrites and signature changes from modifications
    candidateRewrites = Math.round(candidateModifications * 0.35);
    candidateSignatureChanges = Math.round(candidateModifications * 0.20);
    const routineModifications = candidateModifications - candidateRewrites - candidateSignatureChanges;

    // 5. Feasibility Evaluation
    const targetAnswerable = 40;
    const targetNegatives = 10;
    const totalPotentialEvents = candidateAdditions + candidateModifications + candidateRenamesHeuristic + candidateMovesHeuristic;

    const feasibilityNotes = [];
    let isFeasible = true;

    if (totalPotentialEvents < targetAnswerable * 1.5) {
      isFeasible = false;
      feasibilityNotes.push(`Total potential candidate events (${totalPotentialEvents}) is marginal for a target of ${targetAnswerable} high-quality queries.`);
    } else {
      feasibilityNotes.push(`Sufficient candidate event pool (${totalPotentialEvents} detected events) to curate ${targetAnswerable} answerable queries.`);
    }

    if (candidateRenamesHeuristic + candidateMovesHeuristic < 5) {
      feasibilityNotes.push(`Refactoring rarity warning: Only ${candidateRenamesHeuristic} file renames and ${candidateMovesHeuristic} file moves detected by git diff -M. Genuine renames/moves within functions will require detailed AST screening.`);
    }

    if (commitsWithIssueRefs < 30) {
      feasibilityNotes.push(`Issue reference scarcity: Only ${commitsWithIssueRefs} commits contain formal issue IDs (#123). Context Card authoring for remaining commits will require Tier 2/3 sources.`);
    }

    scanSummary.repositories[r.name] = {
      language: r.lang,
      pinned_head_commit: headCommit,
      total_local_commits: totalLocalCommits,
      discovery_window_commits: windowCommitCount,
      date_range: {
        newest_commit_date: newestDate,
        oldest_commit_date: oldestDate
      },
      commits_with_issue_references: {
        count: commitsWithIssueRefs,
        percentage: parseFloat((commitsWithIssueRefs / windowCommitCount * 100).toFixed(1)),
        sample_references: sampleIssueRefs
      },
      head_callable_declarations: {
        total_callables: totalCallablesAtHead,
        by_symbol_type: callablesByType,
        source_files_parsed: parsedFilesCount
      },
      automatically_detected_candidate_events: {
        source_modifying_commits: sourceModifyingCommits,
        candidate_file_additions: candidateAdditions,
        candidate_file_deletions: candidateDeletions,
        candidate_file_modifications: candidateModifications,
        heuristic_breakdown_estimate: {
          routine_modifications: routineModifications,
          substantial_rewrites: candidateRewrites,
          signature_changes: candidateSignatureChanges
        },
        git_detected_file_renames: candidateRenamesHeuristic,
        git_detected_file_moves: candidateMovesHeuristic
      },
      feasibility_assessment: {
        target_answerable_queries: targetAnswerable,
        target_negative_queries: targetNegatives,
        target_feasible: isFeasible,
        notes: feasibilityNotes
      }
    };

    console.log(`  HEAD: ${headCommit.slice(0, 8)} | Callables at HEAD: ${totalCallablesAtHead} | Commits with Issues: ${commitsWithIssueRefs}/${windowCommitCount} (${(commitsWithIssueRefs/windowCommitCount*100).toFixed(1)}%)`);
    console.log(`  Source Modifying Commits: ${sourceModifyingCommits} | Additions: ${candidateAdditions} | Modifs: ${candidateModifications} | File Renames: ${candidateRenamesHeuristic} | File Moves: ${candidateMovesHeuristic}\n`);
  }

  const outPath = path.resolve(__dirname, '../data/phase_c/discovery/feasibility_scan_summary.json');
  fs.writeFileSync(outPath, JSON.stringify(scanSummary, null, 2), 'utf8');
  console.log(`Saved machine-readable discovery summary to: ${outPath}`);
  return scanSummary;
}

runDiscoveryScan().catch(err => {
  console.error(err);
  process.exit(1);
});
