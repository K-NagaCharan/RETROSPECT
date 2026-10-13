const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function runGit(repo, args) {
  try {
    return execFileSync('git', args, { cwd: path.resolve('data/external_repos', repo), encoding: 'utf8' });
  } catch (e) {
    return `ERROR: ${e.message}\n${e.stderr || ''}`;
  }
}

console.log('=== py_bot_06 (ba4efd12) ===');
console.log(runGit('bottle', ['show', '--stat', 'ba4efd12']));
console.log(runGit('bottle', ['diff', 'ba4efd12^', 'ba4efd12', '--', 'bottle.py']).substring(0, 500));

console.log('=== py_bot_08 (90bd4aa7) ===');
console.log(runGit('bottle', ['show', '--stat', '90bd4aa7']));
console.log(runGit('bottle', ['diff', '90bd4aa7^', '90bd4aa7', '--', 'bottle.py']).substring(0, 500));

console.log('=== js_exp_07 (89f198c6) ===');
console.log(runGit('express', ['show', '--stat', '89f198c6']));
console.log(runGit('express', ['diff', '89f198c6^', '89f198c6', '--', 'lib/request.js']).substring(0, 500));

console.log('=== js_exp_10 (cf6722bf) ===');
console.log(runGit('express', ['show', '--stat', 'cf6722bf']));

