const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const dataset = JSON.parse(fs.readFileSync('data/benchmark_lineage.json', 'utf8'));

for (const item of dataset.filter(x => x.language === 'typescript')) {
  const repo = 'zod';
  const cur = item.current_symbol;
  const pred = item.predecessor_symbol;
  console.log(`=== ${item.case_id} ===`);
  console.log(`cur commit: ${cur.commitHash} | file: ${cur.filePath} | symbol: ${cur.name}`);
  console.log(`pred commit: ${pred.commitHash} | file: ${pred.filePath} | symbol: ${pred.name}`);
  
  if (cur.commitHash) {
    const showCur = execFileSync('git', ['show', '--stat', cur.commitHash], { cwd: path.resolve('data/external_repos/zod'), encoding: 'utf8' });
    console.log(`Commit stats:`);
    console.log(showCur.split('\n').slice(0, 10).join('\n'));
    if (showCur.includes(cur.filePath)) {
      console.log(`FILE FOUND in commit stats!`);
    } else {
      console.log(`FILE NOT in commit stats!`);
    }
  }
}
