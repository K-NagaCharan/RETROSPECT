const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');

// Prohibited path/filename regexes (Security Blacklist)
const PROHIBITED_PATH_PATTERNS = [
  /\.git($|\/|\\)/i,
  /node_modules($|\/|\\)/i,
  /[\\\/]src($|[\\\/])/i,
  /[\\\/]scripts($|[\\\/])/i,
  /\.jsonl$/i,
  /answer[_-]?key/i,
  /(candidate|lineage|express|benchmark)[_-]?manifest/i,
  /provenance[_-]?register/i,
  /diff/i,
  /discovery/i,
  /commit/i,
  /callable/i,
  /package(-lock)?\.json$/i,
  /audit[_-]?report/i,
  /\.test\.js$/i
];

// Prohibited object keys inside any exported JSON artifact
const PROHIBITED_KEYS = new Set([
  'target_symbol',
  'source_file',
  'commit_sha',
  'parent_sha',
  'diff_text',
  'internal_diff',
  'code_snippet',
  'raw_git_log',
  'answer_key',
  'ground_truth',
  'qualified_name',
  'target_file',
  'target_lineage_cluster'
]);

function computeSha256(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

function scanForProhibitedKeys(obj, currentPath = 'root') {
  const violations = [];
  if (obj === null || typeof obj !== 'object') {
    return violations;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, idx) => {
      violations.push(...scanForProhibitedKeys(item, `${currentPath}[${idx}]`));
    });
    return violations;
  }

  Object.keys(obj).forEach(key => {
    if (PROHIBITED_KEYS.has(key.toLowerCase())) {
      violations.push(`${currentPath}: contains prohibited restricted key '${key}'`);
    }
    violations.push(...scanForProhibitedKeys(obj[key], `${currentPath}.${key}`));
  });

  return violations;
}

function validateContextCard(card, schema) {
  const errors = [];
  if (!card || typeof card !== 'object') {
    return ['Card payload is not an object'];
  }

  // Check required root properties
  const required = schema.required || [];
  required.forEach(r => {
    if (!(r in card)) {
      errors.push(`Missing required field '${r}'`);
    }
  });

  // Verify additionalProperties: false
  const allowedRoot = new Set(Object.keys(schema.properties || {}));
  Object.keys(card).forEach(k => {
    if (!allowedRoot.has(k)) {
      errors.push(`Unexpected root property '${k}' forbidden by schema`);
    }
  });

  // Check provenance_tier enum
  const validTiers = ['TIER_1_VERIFIED_USER_ISSUE', 'TIER_2_CHANGELOG_AND_CVE', 'TIER_3_BEHAVIORAL_SYNTHESIS'];
  if (!validTiers.includes(card.provenance_tier)) {
    errors.push(`Invalid or missing provenance_tier: '${card.provenance_tier}'`);
  }

  // Deep scan for restricted keys
  const keyViolations = scanForProhibitedKeys(card);
  errors.push(...keyViolations);

  return errors;
}

function generateAuthorPack(options) {
  const {
    cardsDir,
    schemaFile,
    provenanceRegisterFile,
    outDir,
    createZip = false
  } = options;

  console.log('=== AUTHOR PACK GENERATOR ===');
  console.log(`Input cards dir: ${cardsDir}`);
  console.log(`Output target:   ${outDir}`);

  if (!fs.existsSync(cardsDir)) {
    throw new Error(`Cards directory not found: ${cardsDir}`);
  }
  if (!fs.existsSync(schemaFile)) {
    throw new Error(`Author submission schema not found: ${schemaFile}`);
  }

  // 1. Pre-export path validation
  for (const pattern of PROHIBITED_PATH_PATTERNS) {
    if (pattern.test(cardsDir)) {
      throw new Error(`Prohibited path pattern detected in cardsDir: ${pattern}`);
    }
  }

  // Load schemas
  const repoRoot = path.resolve(__dirname, '..');
  const cardSchemaPath = path.join(repoRoot, 'data/phase_c/schemas/context_card_schema.json');
  const cardSchema = JSON.parse(fs.readFileSync(cardSchemaPath, 'utf8'));

  // Load provenance register if available for tier validation
  let provenanceRegister = null;
  if (provenanceRegisterFile && fs.existsSync(provenanceRegisterFile)) {
    provenanceRegister = JSON.parse(fs.readFileSync(provenanceRegisterFile, 'utf8'));
  }

  // Read card files
  const cardFiles = fs.readdirSync(cardsDir).filter(f => f.endsWith('.json'));
  if (cardFiles.length === 0) {
    console.warn('WARNING: No JSON card files found in cards directory.');
  }

  const approvedCards = [];
  const manifestFiles = [];

  for (const file of cardFiles) {
    const filePath = path.join(cardsDir, file);

    // Check filename against prohibited patterns
    for (const pattern of PROHIBITED_PATH_PATTERNS) {
      if (pattern.test(file)) {
        throw new Error(`Security rejection: Card filename matches prohibited pattern '${pattern}': ${file}`);
      }
    }

    const cardContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const validationErrors = validateContextCard(cardContent, cardSchema);

    if (validationErrors.length > 0) {
      throw new Error(`Validation failed for card ${file}:\n  - ${validationErrors.join('\n  - ')}`);
    }

    // Check provenance register match if available
    if (provenanceRegister && provenanceRegister.candidates) {
      const match = provenanceRegister.candidates.find(c => c.benchmark_id === cardContent.benchmark_id);
      if (match && match.provenance_tier !== cardContent.provenance_tier) {
        throw new Error(`Provenance tier mismatch for ${cardContent.benchmark_id}: card has '${cardContent.provenance_tier}', register has '${match.provenance_tier}'`);
      }
    }

    approvedCards.push({ filename: file, content: cardContent, sourcePath: filePath });
  }

  // 2. Prepare clean output directory
  if (fs.existsSync(outDir)) {
    // Clean existing
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outDir, { recursive: true });
  const cardsOutDir = path.join(outDir, 'cards');
  const schemasOutDir = path.join(outDir, 'schemas');
  fs.mkdirSync(cardsOutDir, { recursive: true });
  fs.mkdirSync(schemasOutDir, { recursive: true });

  // 3. Export Context Cards
  for (const card of approvedCards) {
    const dest = path.join(cardsOutDir, card.filename);
    fs.writeFileSync(dest, JSON.stringify(card.content, null, 2), 'utf8');
    manifestFiles.push({
      path: `cards/${card.filename}`,
      size: fs.statSync(dest).size,
      sha256: computeSha256(dest)
    });
  }

  // 4. Export Submission Schema
  const schemaDest = path.join(schemasOutDir, 'authored_query_schema.json');
  fs.copyFileSync(schemaFile, schemaDest);
  manifestFiles.push({
    path: 'schemas/authored_query_schema.json',
    size: fs.statSync(schemaDest).size,
    sha256: computeSha256(schemaDest)
  });

  // 5. Export Author Instructions
  const instructionsDest = path.join(outDir, 'INSTRUCTIONS_FOR_AUTHORS.md');
  const instructionsContent = `# Retrospect Phase C — Instructions for Query Authors

## Overview
You are authoring natural language developer queries for a codebase retrieval evaluation benchmark.
You have been provided a set of **Context Cards** in the \`cards/\` directory.

## Your Task
1. Read each Context Card carefully. Each card describes a realistic software task, observed bug, or feature request.
2. For each card, write a natural language query (1 to 3 sentences) that an engineer would type into a code search engine or retrieval assistant to find the code responsible for implementing or fixing the described task.
3. Save your authored queries conforming to the schema in \`schemas/authored_query_schema.json\`.

## Strict Blinding Rules
- **Do not search the target repository codebase, commit log, or pull request history.**
- You may use general web search for language or protocol specifications (e.g., MDN, RFCs).
- Express queries in your own words based purely on the functional behavior described in the card.
`;
  fs.writeFileSync(instructionsDest, instructionsContent, 'utf8');
  manifestFiles.push({
    path: 'INSTRUCTIONS_FOR_AUTHORS.md',
    size: fs.statSync(instructionsDest).size,
    sha256: computeSha256(instructionsDest)
  });

  // 6. Write Author Pack Manifest with SHA-256 Digests
  const packManifest = {
    pack_title: "Retrospect Phase C — Blinded Author Distribution Pack",
    pack_version: "1.0",
    created_at: new Date().toISOString(),
    total_files: manifestFiles.length,
    security_attestation: "Verified zero git history, zero diffs, zero source files, zero restricted keys.",
    files: manifestFiles
  };
  const manifestDest = path.join(outDir, 'author_pack_manifest.json');
  fs.writeFileSync(manifestDest, JSON.stringify(packManifest, null, 2), 'utf8');

  // 7. Post-export security audit of generated bundle
  function verifyNoProhibitedFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      for (const pattern of PROHIBITED_PATH_PATTERNS) {
        if (pattern.test(ent.name)) {
          throw new Error(`Post-export violation: Prohibited file found in bundle: ${full}`);
        }
      }
      if (ent.isDirectory()) {
        verifyNoProhibitedFiles(full);
      } else if (ent.name.endsWith('.json')) {
        const json = JSON.parse(fs.readFileSync(full, 'utf8'));
        const leaks = scanForProhibitedKeys(json);
        if (leaks.length > 0) {
          throw new Error(`Post-export violation: Prohibited keys in ${full}:\n  ${leaks.join('\n  ')}`);
        }
      }
    }
  }
  verifyNoProhibitedFiles(outDir);

  // 8. Optional Zip Archive Creation
  let zipPath = null;
  if (createZip) {
    zipPath = `${outDir}.zip`;
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    // Use powershell Compress-Archive on Windows
    const cmd = `Compress-Archive -Path "${outDir}\\*" -DestinationPath "${zipPath}" -Force`;
    cp.execSync(cmd, { shell: 'powershell.exe' });
    console.log(`Created zip archive: ${zipPath}`);
  }

  console.log(`Author Pack generated successfully with ${manifestFiles.length} files at: ${outDir}`);
  return {
    outDir,
    zipPath,
    totalFiles: manifestFiles.length,
    files: manifestFiles
  };
}

module.exports = {
  generateAuthorPack,
  validateContextCard,
  scanForProhibitedKeys,
  PROHIBITED_PATH_PATTERNS,
  PROHIBITED_KEYS
};

if (require.main === module) {
  // CLI invocation
  const args = process.argv.slice(2);
  const cardsDir = args[0] || 'data/phase_c/fixtures/mock_cards';
  const outDir = args[1] || 'd:/base papers considered/author_pack_export';
  const schemaFile = 'data/phase_c/schemas/authored_query_schema.json';
  const provFile = 'data/phase_c/discovery/express_restricted_provenance_register.json';

  try {
    generateAuthorPack({
      cardsDir,
      schemaFile,
      provenanceRegisterFile: provFile,
      outDir,
      createZip: true
    });
  } catch (err) {
    console.error('ERROR generating author pack:', err.message);
    process.exit(1);
  }
}
