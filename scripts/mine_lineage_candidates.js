const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function runGit(repoPath, args) {
  return execFileSync('git', args, { cwd: repoPath, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, windowsHide: true });
}

function mineRepo(relRepo, lang) {
  const fullRepo = path.resolve(__dirname, '..', relRepo);
  console.log(`\n========================================================`);
  console.log(` Mining ${relRepo} (${lang})`);
  console.log(`========================================================`);

  // Get log with stats and renames
  const logRaw = runGit(fullRepo, ['log', '-n', '80', '--name-status', '-M', '--format=COMMIT:%H|%an|%ad|%s']);
  const lines = logRaw.split(/\r?\n/);
  
  const commits = [];
  let currentCommit = null;

  for (const line of lines) {
    if (line.startsWith('COMMIT:')) {
      if (currentCommit) commits.push(currentCommit);
      const [hash, author, date, subject] = line.substring(7).split('|');
      currentCommit = { hash, author, date, subject, files: [] };
    } else if (line.trim() && currentCommit) {
      const parts = line.trim().split(/\t+/);
      const status = parts[0];
      if (status.startsWith('R')) {
        currentCommit.files.push({ status: 'renamed', oldPath: parts[1], newPath: parts[2] });
      } else if (status === 'M') {
        currentCommit.files.push({ status: 'modified', path: parts[1] });
      } else if (status === 'A') {
        currentCommit.files.push({ status: 'added', path: parts[1] });
      } else if (status === 'D') {
        currentCommit.files.push({ status: 'deleted', path: parts[1] });
      }
    }
  }
  if (currentCommit) commits.push(currentCommit);

  console.log(`Found ${commits.length} commits.`);

  // Find commits with renames
  const renameCommits = commits.filter(c => c.files.some(f => f.status === 'renamed'));
  console.log(`Commits with file renames: ${renameCommits.length}`);
  for (const c of renameCommits) {
    console.log(`  [Rename] ${c.hash.substring(0, 8)} "${c.subject}"`);
    for (const f of c.files.filter(x => x.status === 'renamed')) {
      console.log(`     ${f.oldPath} -> ${f.newPath}`);
    }
  }

  // Find commits with interesting commit messages (rename, move, rewrite, refactor, deprecate, add, signature)
  const interestingKeywords = ['rename', 'move', 'refactor', 'rewrite', 'deprecat', 'break', 'param', 'signature', 'perf', 'replace'];
  const keywordCommits = commits.filter(c => {
    const sub = c.subject.toLowerCase();
    return interestingKeywords.some(k => sub.includes(k));
  });

  console.log(`Commits matching evolution keywords: ${keywordCommits.length}`);
  for (const c of keywordCommits.slice(0, 15)) {
    console.log(`  [Keyword] ${c.hash.substring(0, 8)} "${c.subject}" (${c.files.length} files)`);
  }
}

mineRepo('data/external_repos/bottle', 'python');
mineRepo('data/external_repos/express', 'javascript');
mineRepo('data/external_repos/zod', 'typescript');
mineRepo('data/external_repos/gson', 'java');
