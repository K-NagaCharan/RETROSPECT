const { execFileSync } = require('child_process');
const path = require('path');

for (const repo of ['bottle', 'express', 'zod', 'gson']) {
  const repoPath = path.resolve('data/external_repos', repo);
  const count = execFileSync('git', ['rev-list', '--count', 'HEAD'], { cwd: repoPath, encoding: 'utf8' }).trim();
  const log = execFileSync('git', ['log', '-n', '5', '--oneline'], { cwd: repoPath, encoding: 'utf8' }).trim();
  console.log(`=== ${repo} (total commits: ${count}) ===`);
  console.log(log);
}
