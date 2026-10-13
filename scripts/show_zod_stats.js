const { execFileSync } = require('child_process');
const path = require('path');

const commits = [
  '18e71c71',
  '51caf010',
  'f7fd5548',
  'd6bc1e30',
  '56222cd1',
  'ce1e11b7',
  '764ac59f',
  'e06a510b',
  '3b970084',
  'd821685e'
];

for (const c of commits) {
  console.log(`=== COMMIT ${c} in ZOD ===`);
  const out = execFileSync('git', ['show', '--stat', '--oneline', c], { cwd: path.resolve('data/external_repos/zod'), encoding: 'utf8' });
  console.log(out);
}
