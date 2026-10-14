const fs = require('fs');
const path = require('path');
const { generateAuthorPack } = require('./generate_author_pack');

const scratchDir = path.resolve('C:/Users/ASUS/.gemini/antigravity-ide/brain/739cb121-0ee8-4c36-a7ca-d249d8a7bb85/scratch/author_pack_test');
const mockCardsDir = path.join(scratchDir, 'mock_cards');
const mockOutDir = path.join(scratchDir, 'exported_pack');
const schemaFile = path.resolve('data/phase_c/schemas/authored_query_schema.json');
const provenanceRegisterFile = path.resolve('data/phase_c/discovery/express_restricted_provenance_register.json');

function setupCleanFixtures() {
  if (fs.existsSync(scratchDir)) {
    fs.rmSync(scratchDir, { recursive: true, force: true });
  }
  fs.mkdirSync(mockCardsDir, { recursive: true });

  const cleanCard1 = {
    card_id: "CARD-EXP-DEV-01",
    benchmark_id: "EXP-DEV-01",
    partition: "DEVELOPMENT",
    provenance_tier: "TIER_3_BEHAVIORAL_SYNTHESIS",
    developer_context: {
      problem_scenario: "A developer is configuring server error handlers during startup.",
      observable_behavior: "When a socket error fires during listen, the callback fires multiple times.",
      expected_outcome: "The error callback should be invoked exactly once.",
      environmental_context: "Node.js HTTP server lifecycle"
    },
    sanitization_metadata: {
      sanitizer_role_id: "MOCK-SANITIZER",
      sanitization_timestamp: "2026-10-14T08:00:00Z",
      redacted_terms_count: 2,
      sanitization_attestation: "VERIFIED_ZERO_TARGET_IDENTIFIERS"
    }
  };
  fs.writeFileSync(path.join(mockCardsDir, 'clean_card_1.json'), JSON.stringify(cleanCard1, null, 2), 'utf8');

  const cleanCard2 = {
    card_id: "CARD-EXP-DEV-02",
    benchmark_id: "EXP-DEV-02",
    partition: "DEVELOPMENT",
    provenance_tier: "TIER_1_VERIFIED_USER_ISSUE",
    developer_context: {
      problem_scenario: "A developer is evaluating templates with empty configuration objects.",
      observable_behavior: "Passing null or undefined options crashes the view presentation engine.",
      expected_outcome: "The presentation engine should accept null or undefined options without error.",
      environmental_context: "Template engine options handling"
    },
    sanitization_metadata: {
      sanitizer_role_id: "MOCK-SANITIZER",
      sanitization_timestamp: "2026-10-14T08:00:00Z",
      redacted_terms_count: 1,
      sanitization_attestation: "VERIFIED_ZERO_TARGET_IDENTIFIERS"
    }
  };
  fs.writeFileSync(path.join(mockCardsDir, 'clean_card_2.json'), JSON.stringify(cleanCard2, null, 2), 'utf8');
}

function runTests() {
  console.log('=== RUNNING AUTHOR PACK GENERATOR SECURITY TESTS ===\n');
  const results = { passed: 0, failed: 0, logs: [] };

  function assert(cond, msg) {
    if (cond) {
      results.passed++;
      console.log(`  [PASS] ${msg}`);
      results.logs.push(`PASS: ${msg}`);
    } else {
      results.failed++;
      console.error(`  [FAIL] ${msg}`);
      results.logs.push(`FAIL: ${msg}`);
    }
  }

  // ==========================================
  // TEST 1: Generation on Clean Synthetic Fixtures
  // ==========================================
  setupCleanFixtures();
  try {
    generateAuthorPack({
      cardsDir: mockCardsDir,
      schemaFile: schemaFile,
      provenanceRegisterFile: provenanceRegisterFile,
      outDir: mockOutDir,
      createZip: true
    });
    assert(true, 'Test 1a: Generator executes cleanly on valid mock fixtures');
  } catch (e) {
    assert(false, `Test 1a: Generator failed on valid mock fixtures: ${e.message}`);
  }

  // Check exported files and manifest
  const manifestPath = path.join(mockOutDir, 'author_pack_manifest.json');
  assert(fs.existsSync(manifestPath), 'Test 1b: author_pack_manifest.json was created');
  const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert(manifestData.files.length === 4, 'Test 1c: Manifest records exactly 4 files (2 cards, 1 schema, 1 readme)');
  assert(manifestData.files.every(f => f.sha256 && f.sha256.length === 64), 'Test 1d: Every file has a valid SHA-256 digest');
  assert(fs.existsSync(`${mockOutDir}.zip`), 'Test 1e: Exported zip archive was created');

  // Verify complete absence of prohibited repository material in export
  function walkDir(dir) {
    let files = [];
    fs.readdirSync(dir, { withFileTypes: true }).forEach(d => {
      const p = path.join(dir, d.name);
      if (d.isDirectory()) files.push(...walkDir(p));
      else files.push(p);
    });
    return files;
  }
  const exportedFiles = walkDir(mockOutDir);
  const relativeFiles = exportedFiles.map(f => path.relative(mockOutDir, f).replace(/\\/g, '/'));
  
  assert(!relativeFiles.some(f => f.includes('.git')), 'Test 1f: Zero .git directories in export bundle');
  assert(!relativeFiles.some(f => f.includes('answer_key')), 'Test 1g: Zero answer keys in export bundle');
  assert(!relativeFiles.some(f => f.includes('candidate_manifest') || f.includes('lineage_manifest')), 'Test 1h: Zero candidate manifests in export bundle');
  assert(!relativeFiles.some(f => f.includes('diff') || f.includes('commit')), 'Test 1j: Zero diffs or commit logs in export bundle');
  assert(!relativeFiles.some(f => f.includes('src/') || f.includes('scripts/')), 'Test 1k: Zero codebase source files in export bundle');

  // ==========================================
  // TEST 2: Rejection of Prohibited Filename
  // ==========================================
  const prohibitedCardPath = path.join(mockCardsDir, 'restricted_answer_key.json');
  fs.writeFileSync(prohibitedCardPath, JSON.stringify({ fake: "data" }));
  try {
    generateAuthorPack({
      cardsDir: mockCardsDir,
      schemaFile: schemaFile,
      outDir: path.join(scratchDir, 'out_fail_file'),
      createZip: false
    });
    assert(false, 'Test 2: Failed to reject prohibited filename');
  } catch (e) {
    assert(e.message.includes('prohibited pattern'), `Test 2: Successfully rejected prohibited filename: ${e.message}`);
  }
  fs.unlinkSync(prohibitedCardPath);

  // ==========================================
  // TEST 3: Rejection of Nested Restricted Key (target_symbol)
  // ==========================================
  const leakyCardPath = path.join(mockCardsDir, 'leaky_card.json');
  const leakyCard = {
    card_id: "CARD-EXP-DEV-01",
    benchmark_id: "EXP-DEV-01",
    partition: "DEVELOPMENT",
    provenance_tier: "TIER_3_BEHAVIORAL_SYNTHESIS",
    developer_context: {
      problem_scenario: "Testing nested leakage injection",
      observable_behavior: "Contains illegal property target_symbol",
      expected_outcome: "Should be rejected",
      environmental_context: "Test context",
      target_symbol: "app.listen" // INJECTED LEAK
    },
    sanitization_metadata: {
      sanitizer_role_id: "SANITIZER",
      sanitization_timestamp: "2026-10-14T08:00:00Z",
      redacted_terms_count: 0,
      sanitization_attestation: "VERIFIED_ZERO_TARGET_IDENTIFIERS"
    }
  };
  fs.writeFileSync(leakyCardPath, JSON.stringify(leakyCard, null, 2), 'utf8');
  try {
    generateAuthorPack({
      cardsDir: mockCardsDir,
      schemaFile: schemaFile,
      outDir: path.join(scratchDir, 'out_fail_key'),
      createZip: false
    });
    assert(false, 'Test 3: Failed to reject nested restricted key target_symbol');
  } catch (e) {
    assert(e.message.includes('prohibited restricted key'), `Test 3: Successfully rejected nested restricted key: ${e.message}`);
  }
  fs.unlinkSync(leakyCardPath);

  // ==========================================
  // TEST 4: Rejection of Provenance Tier Mismatch
  // ==========================================
  const mismatchedCardPath = path.join(mockCardsDir, 'mismatched_card.json');
  const mismatchedCard = {
    card_id: "CARD-EXP-DEV-01",
    benchmark_id: "EXP-DEV-01", // Register specifies TIER_3
    partition: "DEVELOPMENT",
    provenance_tier: "TIER_1_VERIFIED_USER_ISSUE", // MISMATCH!
    developer_context: {
      problem_scenario: "Testing provenance mismatch detection",
      observable_behavior: "Falsely claiming Tier 1 when register specifies Tier 3",
      expected_outcome: "Rejection by generator",
      environmental_context: "Test context"
    },
    sanitization_metadata: {
      sanitizer_role_id: "SANITIZER",
      sanitization_timestamp: "2026-10-14T08:00:00Z",
      redacted_terms_count: 0,
      sanitization_attestation: "VERIFIED_ZERO_TARGET_IDENTIFIERS"
    }
  };
  fs.writeFileSync(mismatchedCardPath, JSON.stringify(mismatchedCard, null, 2), 'utf8');
  try {
    generateAuthorPack({
      cardsDir: mockCardsDir,
      schemaFile: schemaFile,
      provenanceRegisterFile: provenanceRegisterFile,
      outDir: path.join(scratchDir, 'out_fail_tier'),
      createZip: false
    });
    assert(false, 'Test 4: Failed to reject provenance tier mismatch');
  } catch (e) {
    assert(e.message.includes('Provenance tier mismatch'), `Test 4: Successfully rejected provenance tier mismatch: ${e.message}`);
  }
  fs.unlinkSync(mismatchedCardPath);

  console.log('\n=== TEST RESULTS SUMMARY ===');
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);

  fs.writeFileSync(path.join(scratchDir, 'test_results.json'), JSON.stringify(results, null, 2), 'utf8');
  if (results.failed > 0) process.exit(1);
}

runTests();
