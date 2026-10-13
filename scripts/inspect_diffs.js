const { execFileSync } = require('child_process');
const path = require('path');

function runGit(repoPath, args) {
  return execFileSync('git', args, { cwd: repoPath, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, windowsHide: true });
}

function inspectCommit(relRepo, commitHash) {
  const fullRepo = path.resolve(__dirname, '..', relRepo);
  console.log(`\n======================================================`);
  console.log(` Commit ${commitHash} in ${relRepo}`);
  console.log(`======================================================`);
  const show = runGit(fullRepo, ['show', '--stat', commitHash]);
  console.log(show.split('\n').slice(0, 20).join('\n'));
  const diff = runGit(fullRepo, ['diff', `${commitHash}~1`, commitHash]);
  console.log('\n--- DIFF SAMPLE (first 100 lines) ---');
  console.log(diff.split('\n').slice(0, 100).join('\n'));
}

// Sample across languages
const toInspect = [
  { repo: 'data/external_repos/bottle', hash: '8ec5fe29' },
  { repo: 'data/external_repos/bottle', hash: '750fcbeb' },
  { repo: 'data/external_repos/bottle', hash: 'b5631d1d' },
  { repo: 'data/external_repos/bottle', hash: '4a183493' },
  { repo: 'data/external_repos/zod', hash: '18e71c71' },
  { repo: 'data/external_repos/zod', hash: '51caf010' },
  { repo: 'data/external_repos/zod', hash: 'f7fd5548' },
  { repo: 'data/external_repos/gson', hash: '115bcc7e' },
  { repo: 'data/external_repos/gson', hash: 'ff521d70' }
];

for (const item of toInspect) {
  inspectCommit(item.repo, item.hash);
}
