const { execFileSync } = require('child_process');
const path = require('path');

function runGit(args) {
  return execFileSync('git', args, { cwd: path.resolve('data/external_repos/zod'), encoding: 'utf8' });
}

console.log('=== SEARCHING FOR uuidv7 in Zod ===');
try {
  console.log(runGit(['log', '-n', '5', '--oneline', '-S', 'uuidv7']));
} catch(e) { console.log(e.message); }

console.log('=== SEARCHING FOR refactor / move in Zod ===');
try {
  console.log(runGit(['log', '-n', '10', '--oneline', '--grep', 'move']));
} catch(e) { console.log(e.message); }

console.log('=== SEARCHING FOR feat in Zod ===');
try {
  console.log(runGit(['log', '-n', '10', '--oneline', '--grep', 'feat']));
} catch(e) { console.log(e.message); }
