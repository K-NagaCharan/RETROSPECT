const { execFileSync } = require('child_process');
const path = require('path');

function runGit(repo, args) {
  try {
    return execFileSync('git', args, { cwd: path.resolve('data/external_repos', repo), encoding: 'utf8' });
  } catch (e) {
    return `ERROR: ${e.message}\n${e.stderr || ''}`;
  }
}

console.log('=== ts_zod_01 (18e71c71) ===');
console.log(runGit('zod', ['show', '--stat', '18e71c71']));

console.log('=== ts_zod_03 (55f00e95) ===');
console.log(runGit('zod', ['show', '--stat', '55f00e95']));

console.log('=== ts_zod_06 (ce1e11b7) ===');
console.log(runGit('zod', ['show', '--stat', 'ce1e11b7']));

console.log('=== ts_zod_07 (bb51b54c) ===');
console.log(runGit('zod', ['show', '--stat', 'bb51b54c']));

console.log('=== ts_zod_08 (c37c4495) ===');
console.log(runGit('zod', ['show', '--stat', 'c37c4495']));

console.log('=== java_gsn_01 (8fe07781) ===');
console.log(runGit('gson', ['show', '--stat', '8fe07781']));

console.log('=== java_gsn_07 (dfc1ce00) ===');
console.log(runGit('gson', ['show', '--stat', 'dfc1ce00']));

console.log('=== java_gsn_09 (164ac9df) ===');
console.log(runGit('gson', ['show', '--stat', '164ac9df']));

console.log('=== java_gsn_10 (286843d4) ===');
console.log(runGit('gson', ['show', '--stat', '286843d4']));
