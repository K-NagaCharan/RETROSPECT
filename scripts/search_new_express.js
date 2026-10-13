const { execFileSync } = require('child_process');
const path = require('path');

const diff = execFileSync('git', ['log', '-p', '-n', '150', '--', 'lib/'], { cwd: path.resolve('data/external_repos/express'), encoding: 'utf8' });
const lines = diff.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.startsWith('commit ')) {
    currentCommit = line.slice(7, 15);
  }
  if (/^\+\s*(app\.[a-zA-Z0-9_$]+|res\.[a-zA-Z0-9_$]+|req\.[a-zA-Z0-9_$]+|function\s+[a-zA-Z0-9_$]+)\s*=\s*/.test(line) ||
      /^\+\s*function\s+([a-zA-Z0-9_$]+)\s*\(/.test(line)) {
    console.log(`${currentCommit}: ${line}`);
  }
}
