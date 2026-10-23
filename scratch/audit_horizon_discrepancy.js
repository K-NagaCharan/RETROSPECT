const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const resultsJsonPath = 'D:/base papers considered/Test creation/experiments/final_multirepo_evaluation_merge_aware_2026-10-20/results.json';
const res = JSON.parse(fs.readFileSync(resultsJsonPath, 'utf8'));

const repoCloneMap = {
  'checkstyle/checkstyle': 'D:/clones/checkstyle',
  'graphhopper/graphhopper': 'D:/clones/graphhopper',
  'undertow-io/undertow': 'D:/clones/undertow',
  'datastax/java-driver': 'D:/clones/datastax-java-driver',
  'google/guava': 'D:/clones/guava',
  'psf/requests': 'D:/clones/requests',
  'colinhacks/zod': 'D:/clones/zod',
  'encode/httpx': 'D:/clones/httpx',
  'pytest-dev/pytest': 'D:/clones/pytest',
  'marshmallow-code/marshmallow': 'D:/clones/marshmallow',
  'moment/moment': 'D:/clones/moment',
  'mochajs/mocha': 'D:/clones/mocha',
  'vuejs/core': 'D:/clones/vue',
  'ReactiveX/rxjs': 'D:/clones/rxjs'
};

const audit = [];

for (const c of res.per_case_results) {
  const repoPath = repoCloneMap[c.repository_id];
  if (!repoPath) continue;

  let inTop50 = false;
  let topoRank = null;
  let revCount = null;
  let firstParentDist = null;

  if (c.origin_commit) {
    try {
      const top50 = execFileSync('git', ['log', '--format=%H', '--topo-order', '-n', '50', c.pin_sha], { cwd: repoPath, stdio: 'pipe' })
        .toString().trim().split(/\r?\n/).map(h => h.trim());
      const idx = top50.indexOf(c.origin_commit);
      if (idx !== -1) {
        inTop50 = true;
        topoRank = idx + 1;
      }
    } catch (e) {}

    try {
      const countOut = execFileSync('git', ['rev-list', '--count', `${c.origin_commit}..${c.pin_sha}`], { cwd: repoPath, stdio: 'pipe' }).toString().trim();
      revCount = parseInt(countOut, 10);
    } catch (e) {}

    try {
      const fpOut = execFileSync('git', ['rev-list', '--first-parent', '--count', `${c.origin_commit}..${c.pin_sha}`], { cwd: repoPath, stdio: 'pipe' }).toString().trim();
      firstParentDist = parseInt(fpOut, 10);
    } catch (e) {}
  }

  audit.push({
    case_id: c.case_id,
    cohort: c.cohort,
    repo: c.repository_id,
    origin: c.origin_commit ? c.origin_commit.substring(0, 10) : null,
    inTop50,
    topoRank,
    revCount,
    firstParentDist,
    b2_score: c.b2_score,
    prev_stage_a: c.stage_a_status,
    prev_stage_b: c.stage_b_match_type
  });
}

fs.writeFileSync('scratch/horizon_audit_results.json', JSON.stringify(audit, null, 2), 'utf8');

// Summary table
console.log('Case ID                | Cohort                        | inTop50 (Rank) | revCount | b2_score | Prev Stage A           | Prev Stage B');
console.log('-----------------------+-------------------------------+----------------+----------+----------+------------------------+-------------');
for (const r of audit) {
  const rankStr = r.inTop50 ? `YES (${r.topoRank})`.padEnd(14) : 'NO'.padEnd(14);
  const revStr = r.revCount != null ? String(r.revCount).padStart(8) : '    null';
  const scoreStr = String(r.b2_score).padStart(8);
  console.log(`${r.case_id.padEnd(22)} | ${r.cohort.padEnd(29)} | ${rankStr} | ${revStr} | ${scoreStr} | ${r.prev_stage_a.padEnd(22)} | ${r.prev_stage_b}`);
}
