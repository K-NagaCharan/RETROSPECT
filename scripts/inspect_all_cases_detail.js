const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const originalBenchmark = JSON.parse(fs.readFileSync('data/benchmark_lineage.json', 'utf8'));

function runGit(repo, args) {
  try {
    return execFileSync('git', args, { cwd: path.resolve('data/external_repos', repo), encoding: 'utf8' });
  } catch (e) {
    return null;
  }
}

for (const item of originalBenchmark) {
  console.log(`\n======================================================`);
  console.log(`[${item.case_id}] ${item.repository} (${item.language})`);
  console.log(`Claimed Evolution: ${item.evolution_type} | Valid Pred: ${item.is_valid_predecessor}`);
  console.log(`Current: ${item.current_symbol.name} in ${item.current_symbol.filePath} @ ${item.current_symbol.commitHash?.slice(0,8)}`);
  console.log(`Pred:    ${item.predecessor_symbol.name} in ${item.predecessor_symbol.filePath} @ ${item.predecessor_symbol.commitHash?.slice(0,8)}`);
  console.log(`Rationale: ${item.evidence?.rationale}`);
  
  const repo = item.repository;
  const curHash = item.current_symbol.commitHash;
  const predHash = item.predecessor_symbol.commitHash;
  
  if (curHash) {
    const log = runGit(repo, ['log', '-1', '--oneline', curHash]);
    console.log(`Commit log: ${log ? log.trim() : 'NOT FOUND'}`);
  }
  
  if (curHash && predHash) {
    // Show what files actually changed between predHash and curHash
    const diffStat = runGit(repo, ['diff', '--stat', predHash, curHash]);
    console.log(`Diff stat between commits:\n${diffStat ? diffStat.trim() : 'NO DIFF'}`);
  }
}
