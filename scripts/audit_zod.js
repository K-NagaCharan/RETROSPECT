const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const dataset = JSON.parse(fs.readFileSync('data/benchmark_lineage.json', 'utf8'));

function runGit(args) {
  try {
    return execFileSync('git', args, { cwd: path.resolve('data/external_repos/zod'), encoding: 'utf8' });
  } catch (e) {
    return e.message;
  }
}

for (let i = 20; i < 30; i++) {
  const item = dataset[i];
  console.log(`\n=================== ${item.case_id} ===================`);
  console.log(`Claimed: ${item.current_symbol.name} in ${item.current_symbol.filePath} (${item.evolution_type})`);
  console.log(`Cur commit: ${item.current_symbol.commitHash?.slice(0, 8)} | Pred: ${item.predecessor_symbol.commitHash?.slice(0, 8)}`);
  const curHash = item.current_symbol.commitHash;
  const predHash = item.predecessor_symbol.commitHash;
  if (curHash && predHash) {
    const diff = runGit(['diff', '--stat', predHash, curHash]);
    console.log(`Diff stat between commits:\n${diff ? diff.trim() : 'NO DIFF'}`);
  } else if (curHash) {
    const show = runGit(['show', '--stat', curHash]);
    console.log(`Show:\n${show ? show.trim() : 'NO SHOW'}`);
  }
}
