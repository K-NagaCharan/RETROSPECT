const fs = require('fs');
const cp = require('child_process');
const path = require('path');

function runGit(cmd) {
  return cp.execSync('git -C data/external_repos/express ' + cmd, { encoding: 'utf8' }).trim();
}

function runIntegrityAudit() {
  const repoRoot = path.resolve(__dirname, '..');
  const manifestPath = path.join(repoRoot, 'data/phase_c/discovery/express_final_candidate_manifest_v1.0.json');
  const restrictedKeyPath = path.join(repoRoot, 'data/phase_c/discovery/express_restricted_ground_truth_key.json');

  console.log('=== PHASE C MANIFEST & ANSWER KEY INTEGRITY AUDIT ===');
  
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest missing: ${manifestPath}`);
  }
  if (!fs.existsSync(restrictedKeyPath)) {
    throw new Error(`Restricted key missing: ${restrictedKeyPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const restrictedKey = JSON.parse(fs.readFileSync(restrictedKeyPath, 'utf8'));

  const devCandidates = manifest.development_candidates;
  const testCandidates = manifest.held_out_test_candidates;
  const reserveCandidate = manifest.reserve_test_candidate;

  console.log(`Development candidates: ${devCandidates.length}`);
  console.log(`Held-out test candidates: ${testCandidates.length}`);
  console.log(`Reserve candidate: ${reserveCandidate.benchmark_id}`);

  const results = {
    checksPassed: 0,
    checksFailed: 0,
    failures: []
  };

  function assert(condition, message) {
    if (condition) {
      results.checksPassed++;
      console.log(`  [PASS] ${message}`);
    } else {
      results.checksFailed++;
      results.failures.push(message);
      console.error(`  [FAIL] ${message}`);
    }
  }

  // 1. Candidate Counts
  assert(devCandidates.length === 9, 'Development partition contains exactly 9 candidates');
  assert(testCandidates.length === 9, 'Held-out test partition contains exactly 9 candidates');
  assert(reserveCandidate && reserveCandidate.benchmark_id === 'EXP-TEST-RESERVE-01', 'Reserve candidate EXP-TEST-RESERVE-01 is present');

  // 2. Benchmark ID 1:1 Mapping & Uniqueness
  const allIds = [...devCandidates.map(c => c.benchmark_id), ...testCandidates.map(c => c.benchmark_id), reserveCandidate.benchmark_id];
  const uniqueIds = new Set(allIds);
  assert(uniqueIds.size === allIds.length, 'All benchmark IDs are unique (no duplicates)');

  const expectedDevIds = ['EXP-DEV-01', 'EXP-DEV-02', 'EXP-DEV-03', 'EXP-DEV-04', 'EXP-DEV-05', 'EXP-DEV-06', 'EXP-DEV-07', 'EXP-DEV-08', 'EXP-DEV-09'];
  const expectedTestIds = ['EXP-TEST-01', 'EXP-TEST-02', 'EXP-TEST-03', 'EXP-TEST-04', 'EXP-TEST-05', 'EXP-TEST-06', 'EXP-TEST-07', 'EXP-TEST-08', 'EXP-TEST-09'];
  assert(JSON.stringify(devCandidates.map(c => c.benchmark_id)) === JSON.stringify(expectedDevIds), 'Development IDs strictly sequential EXP-DEV-01..09');
  assert(JSON.stringify(testCandidates.map(c => c.benchmark_id)) === JSON.stringify(expectedTestIds), 'Test IDs strictly sequential EXP-TEST-01..09');

  // 3. Cluster ID Disjointness
  const devClusters = new Set(devCandidates.map(c => c.lineage_cluster.split(':')[0].trim()));
  const testClusters = new Set(testCandidates.map(c => c.lineage_cluster.split(':')[0].trim()));
  const clusterOverlap = [...devClusters].filter(cl => testClusters.has(cl));
  assert(clusterOverlap.length === 0, `Zero cluster overlap between Dev and Test (overlap: ${clusterOverlap.join(', ')})`);

  // 4. Commit SHA Disjointness
  const devCommits = new Set(devCandidates.map(c => c.commit_sha));
  const testCommits = new Set(testCandidates.map(c => c.commit_sha));
  const commitOverlap = [...devCommits].filter(sha => testCommits.has(sha));
  assert(commitOverlap.length === 0, `Zero commit SHA overlap between Dev and Test (overlap: ${commitOverlap.join(', ')})`);

  // 5. Excluded Commit Safeguard (Router & Chore commits must not appear)
  const excludedCommits = [
    '631ada0c645dc84c6df8788f5a7eb2b8100acea5', // Router.handle (deleted at HEAD, coupled)
    '7ec5dd2b3c5e7379f68086dae72859f5573c8b9b', // Route.dispatch (deleted at HEAD, coupled)
    '708ac4cdf5cd0a658d62490a9f4d78d3e1ec6612', // Large-stack router root patch
    '490f1a1738449699c217e00ba56db378923fd6b5', // substr lint chore
    '14439731f968c1ec6015227d747ede32d3fbf676', // app.init duplicate null prototype
    '41113599afb01040436dba993f06cacbdb8f8e13', // node: import prefix chore
    '9d8223d92ee81137a50a28eb6ad55a096791091d'  // trimRight chore
  ];
  const allManifestCommits = [...devCommits, ...testCommits, reserveCandidate.commit_sha];
  const forbiddenLeaks = excludedCommits.filter(c => allManifestCommits.includes(c));
  assert(forbiddenLeaks.length === 0, `No excluded/coupled/chore commits present in manifest (leaks: ${forbiddenLeaks.join(', ')})`);

  // 6. Working Tree & Pinned HEAD Verification
  const pinnedHead = manifest.pinned_head_sha;
  assert(pinnedHead === 'a419aa7350389a275ab45fde2e849ed1f02449ef', 'Manifest pinned HEAD matches Express v5.3.0');

  let allFilesExistAtHead = true;
  let allSymbolsExistAtHead = true;
  let allParentsMatchGit = true;

  [...devCandidates, ...testCandidates, reserveCandidate].forEach(c => {
    // Check file at HEAD
    try {
      runGit(`cat-file -e ${pinnedHead}:${c.source_file}`);
      const content = runGit(`show ${pinnedHead}:${c.source_file}`);
      const symBase = c.target_symbol.split('.').pop();
      if (!content.includes(symBase)) {
        allSymbolsExistAtHead = false;
        console.error(`Symbol ${c.target_symbol} missing at HEAD in ${c.source_file}`);
      }
    } catch (e) {
      allFilesExistAtHead = false;
      console.error(`File ${c.source_file} missing at HEAD`);
    }

    // Check parent in Git
    const gitParent = runGit(`log --pretty=%P -n 1 ${c.commit_sha}`);
    if (gitParent !== c.parent_sha) {
      allParentsMatchGit = false;
      console.error(`Parent mismatch for ${c.benchmark_id}: manifest has ${c.parent_sha}, git has ${gitParent}`);
    }
  });

  assert(allFilesExistAtHead, 'All source files exist in working tree at pinned HEAD');
  assert(allSymbolsExistAtHead, 'All target symbols exist in working tree at pinned HEAD');
  assert(allParentsMatchGit, 'All parent SHAs match actual Git commit graph');

  // 7. Restricted Answer Key Consistency
  let devKeyMatches = true;
  devCandidates.forEach(c => {
    const keyEntry = restrictedKey.development_answers[c.provenance_candidate_id];
    if (!keyEntry || keyEntry.ground_truth_commit !== c.commit_sha || keyEntry.target_symbol !== c.target_symbol) {
      devKeyMatches = false;
      console.error(`Restricted key mismatch for dev candidate ${c.benchmark_id} (${c.provenance_candidate_id})`);
    }
  });
  assert(devKeyMatches, 'Restricted answer key matches all 9 development candidates');

  let testKeyMatches = true;
  testCandidates.forEach(c => {
    const keyEntry = restrictedKey.held_out_test_answers[c.provenance_candidate_id];
    if (!keyEntry || keyEntry.ground_truth_commit !== c.commit_sha || keyEntry.target_symbol !== c.target_symbol) {
      testKeyMatches = false;
      console.error(`Restricted key mismatch for test candidate ${c.benchmark_id} (${c.provenance_candidate_id})`);
    }
  });
  const reserveKeyEntry = restrictedKey.held_out_test_answers['CAND-EXP-TEST-11 (RESERVE)'];
  assert(reserveKeyEntry && reserveKeyEntry.ground_truth_commit === reserveCandidate.commit_sha, 'Restricted answer key matches reserve candidate');
  assert(testKeyMatches, 'Restricted answer key matches all 9 test candidates');

  console.log('\n=== INTEGRITY AUDIT SUMMARY ===');
  console.log(`Total Checks Passed: ${results.checksPassed}`);
  console.log(`Total Checks Failed: ${results.checksFailed}`);
  if (results.checksFailed > 0) {
    console.error('FAILURES:', results.failures);
    process.exit(1);
  } else {
    console.log('ALL INTEGRITY CHECKS PASSED PERFECTLY.');
  }
}

runIntegrityAudit();
