const { execFileSync } = require('child_process');
const path = require('path');

const log = execFileSync('git', ['log', '-n', '100', '--oneline', '--', 'lib/'], { cwd: path.resolve('data/external_repos/express'), encoding: 'utf8' });
console.log(log);
