const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const histCasesPath = 'D:/base papers considered/Test creation/datasets/custom/historical-symbol-retrieval/data/historical-cases.json';
const clonesRoot = 'D:/clones';

const cases = JSON.parse(fs.readFileSync(histCasesPath, 'utf8')).filter(c => c.repository_id !== 'robovm/robovm');

const repoFolderMap = {
  'checkstyle/checkstyle': 'checkstyle',
  'datastax/java-driver': 'datastax-java-driver',
  'graphhopper/graphhopper': 'graphhopper',
  'undertow-io/undertow': 'undertow'
};

const results = [];

cases.forEach(c => {
  const folder = repoFolderMap[c.repository_id];
  const repoDir = path.join(clonesRoot, folder);
  const pin = c.source_revision_sha;
  const he = c.historical_evidence || {};
  const originSha = he.origin_commit_sha || c.origin_commit_cluster;
  const t = (c.target_symbols && c.target_symbols[0]) || {};

  let pinExists = false;
  let originExists = false;
  let originLog = '';
  let distance = -1;

  if (fs.existsSync(repoDir)) {
    try {
      execSync(`git rev-parse --verify --quiet ${pin}`, { cwd: repoDir, stdio: 'pipe' });
      pinExists = true;
    } catch (e) {}

    if (originSha) {
      try {
        execSync(`git rev-parse --verify --quiet ${originSha}`, { cwd: repoDir, stdio: 'pipe' });
        originExists = true;
        originLog = execSync(`git log -1 --oneline ${originSha}`, { cwd: repoDir, stdio: 'pipe' }).toString().trim();
        if (pinExists) {
          try {
            const countStr = execSync(`git rev-list --count ${originSha}..${pin}`, { cwd: repoDir, stdio: 'pipe' }).toString().trim();
            distance = parseInt(countStr, 10);
          } catch (e) {}
        }
      } catch (e) {}
    }
  }

  results.push({
    case_id: c.case_id,
    repo: c.repository_id,
    pin,
    pinExists,
    originSha,
    originExists,
    originLog,
    distance,
    oldSymbol: he.old_symbol_name,
    newSymbol: he.new_symbol_name || t.symbol_name,
    changeType: he.change_type,
    file: t.file_path,
    signature: t.declaration_signature
  });
});

console.log(`Audited ${results.length} Category B cases across clones in D:/clones.`);
const pinFailures = results.filter(r => !r.pinExists);
const originFailures = results.filter(r => !r.originExists);

console.log(`Pin commit exists in Git: ${results.length - pinFailures.length} / ${results.length}`);
console.log(`Origin commit exists in Git: ${results.length - originFailures.length} / ${results.length}`);

if (pinFailures.length > 0) {
  console.log('Pin failures:', pinFailures.map(r => r.case_id));
}
if (originFailures.length > 0) {
  console.log('Origin failures:', originFailures.map(r => r.case_id));
}

console.log('\nDistance summary from origin to pin:');
results.forEach(r => {
  console.log(`${r.case_id} [${r.repo.split('/')[1]}]: dist=${r.distance} | Origin: ${r.originSha ? r.originSha.substring(0, 10) : 'none'} (${r.originLog.substring(0, 40)})`);
});

fs.writeFileSync('C:/Users/ASUS/.gemini/antigravity-ide/brain/739cb121-0ee8-4c36-a7ca-d249d8a7bb85/scratch/category_b_git_audit.json', JSON.stringify(results, null, 2), 'utf8');
