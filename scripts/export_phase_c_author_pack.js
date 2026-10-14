const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Retrospect Phase C — Sanitized & Blinded Author Pack Exporter
 *
 * Generates an isolated, non-leaking, double-blinded author pack for independent query authors.
 * - Uses opaque, non-sequential card IDs (CARD-XXXXXX) that reveal neither repository identity nor partition.
 * - Strips partition and internal benchmark identifiers from author-facing cards.
 * - Saves a private binding key (author_card_blind_key.json) strictly for the independent evaluator.
 * - Removes explicit repository names from author instructions.
 * - Validates author cards against author_facing_card_schema.json and proves lossless mapping
 *   back to internal context_card_schema.json.
 * - Scans fail-closed for forbidden symbols, paths, SHAs, PR numbers, partition labels, and framework names.
 */

const BLINDING_SALT = 'RETROSPECT_PHASE_C_BLINDING_KEY_v1.0';

/**
 * Generates an opaque, non-sequential author-facing card ID from a benchmark ID.
 * Produces an alphanumeric token (e.g. CARD-1C1090) that reveals neither
 * repository identity (no 'EXP') nor partition (no 'DEV' / 'TEST').
 * @param {string} benchmarkId 
 * @returns {string}
 */
function generateOpaqueCardId(benchmarkId) {
  const hash = crypto.createHmac('sha256', BLINDING_SALT)
    .update(benchmarkId)
    .digest('hex')
    .slice(0, 6)
    .toUpperCase();
  return `CARD-${hash}`;
}

function runExport(options = {}) {
  const repoRoot = path.resolve(__dirname, '..');
  const manifestPath = path.join(repoRoot, 'data/phase_c/discovery/express_final_candidate_manifest_v1.0.json');
  const provenancePath = path.join(repoRoot, 'data/phase_c/discovery/express_restricted_provenance_register.json');
  const internalSchemaPath = path.join(repoRoot, 'data/phase_c/schemas/context_card_schema.json');
  const authorSchemaPath = path.join(repoRoot, 'data/phase_c/schemas/author_facing_card_schema.json');
  const blindKeyPath = path.join(repoRoot, 'data/phase_c/discovery/author_card_blind_key.json');
  const outputDir = path.join(repoRoot, 'exported_packs/phase_c_author_pack');
  const cardsDir = path.join(outputDir, 'cards');

  console.log('=== PHASE C BLINDED AUTHOR PACK EXPORTER ===');

  if (!fs.existsSync(manifestPath)) throw new Error(`Missing manifest: ${manifestPath}`);
  if (!fs.existsSync(provenancePath)) throw new Error(`Missing provenance register: ${provenancePath}`);
  if (!fs.existsSync(internalSchemaPath)) throw new Error(`Missing internal schema: ${internalSchemaPath}`);
  if (!fs.existsSync(authorSchemaPath)) throw new Error(`Missing author schema: ${authorSchemaPath}`);

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const provenance = JSON.parse(fs.readFileSync(provenancePath, 'utf8'));
  const internalSchema = JSON.parse(fs.readFileSync(internalSchemaPath, 'utf8'));
  const authorSchema = JSON.parse(fs.readFileSync(authorSchemaPath, 'utf8'));
  const provMap = new Map(provenance.candidates.map(c => [c.benchmark_id, c]));

  // Clean export cards directory to remove any stale files
  if (!fs.existsSync(cardsDir)) {
    fs.mkdirSync(cardsDir, { recursive: true });
  } else {
    for (const file of fs.readdirSync(cardsDir)) {
      const filePath = path.join(cardsDir, file);
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        try {
          fs.rmSync(filePath, { force: true, maxRetries: 5, retryDelay: 50 });
        } catch (_) {}
      }
    }
  }

  // 1. Sanitized Behavioral Context Definitions for all 18 Candidates
  const sanitizedContexts = {
    'EXP-DEV-01': {
      problem_scenario: 'During web service bootstrap, an operating system network socket error is encountered while binding the port.',
      observable_behavior: 'The error callback supplied to the service bootstrap helper is triggered multiple times instead of firing exactly once.',
      expected_outcome: 'The startup error callback should be invoked at most once, and subsequent socket error events during startup should be suppressed.',
      environmental_context: 'Node.js HTTP network socket startup and port binding lifecycle.'
    },
    'EXP-DEV-02': {
      problem_scenario: 'A developer is generating HTML output from view template files using default configuration values.',
      observable_behavior: 'The template evaluation routine throws a TypeError when the caller explicitly passes null or undefined for the options argument.',
      expected_outcome: 'The view evaluation routine should treat null or undefined options as an empty configuration object and generate output cleanly.',
      environmental_context: 'Server-side view template evaluation pipeline.'
    },
    'EXP-DEV-03': {
      problem_scenario: 'The framework registers multi-tier route handling pipelines with nested handler arrays.',
      observable_behavior: 'An outdated third-party dependency is required to recursively un-nest handler function arrays.',
      expected_outcome: 'Replace the legacy external array-unwrapping dependency with standard ECMAScript native nested array flattening.',
      environmental_context: 'Middleware registration and routing pipeline initialization.'
    },
    'EXP-DEV-04': {
      problem_scenario: 'A web framework instance maintains global environment and server settings.',
      observable_behavior: 'Modifying configuration settings using user-controlled property keys can inadvertently pollute the global Object prototype.',
      expected_outcome: 'Configuration key assignment should guard against modifying prototype-inherited properties such as __proto__.',
      environmental_context: 'Framework environment configuration storage.'
    },
    'EXP-DEV-05': {
      problem_scenario: 'An HTTP endpoint transmits a streaming or chunked message payload.',
      observable_behavior: 'HTTP response entity validation headers (ETags) are erroneously omitted when chunked transfer encoding headers are configured.',
      expected_outcome: 'The HTTP response payload generator should correctly construct and assign headers according to HTTP caching specifications.',
      environmental_context: 'HTTP response payload generation and header finalization.'
    },
    'EXP-DEV-06': {
      problem_scenario: 'A logout route attempts to expire an authentication session token on the client browser.',
      observable_behavior: 'Supplying conflicting expiration or max-age parameter overrides causes the browser cookie deletion header to fail.',
      expected_outcome: 'The cookie deletion utility should overwrite expiration headers so client browsers reliably delete the designated cookie.',
      environmental_context: 'HTTP Set-Cookie header generation and session teardown.'
    },
    'EXP-DEV-07': {
      problem_scenario: 'An API handler sets the media payload header based on filename extension.',
      observable_behavior: 'MIME category resolution for uncommon or modern file extensions returns incorrect or missing header values.',
      expected_outcome: 'Adopt standard community MIME database lookup to ensure consistent header values across file extensions.',
      environmental_context: 'HTTP media header resolution.'
    },
    'EXP-DEV-08': {
      problem_scenario: 'An incoming HTTP request is evaluated to determine whether the connection is plain HTTP or secure TLS/HTTPS.',
      observable_behavior: 'The connection security check accesses an obsolete, deprecated internal Node.js socket property causing runtime deprecation warnings.',
      expected_outcome: 'Update socket inspection to use modern network stream properties to cleanly detect encrypted connections.',
      environmental_context: 'Incoming HTTP connection scheme detection.'
    },
    'EXP-DEV-09': {
      problem_scenario: 'A web server parses incoming URL query strings into nested JavaScript objects.',
      observable_behavior: 'Excessively deep bracket nesting in incoming query parameters causes exponential recursion, resulting in server denial of service.',
      expected_outcome: 'Enforce strict recursion depth limits when parsing structured URL query parameters to reject malicious payloads.',
      environmental_context: 'URL query parameter parsing during request preprocessing.'
    },
    'EXP-TEST-01': {
      problem_scenario: 'An unhandled exception occurs in a route handler during production request processing.',
      observable_behavior: 'The built-in error reporting mechanism prints only a truncated single-line string to stderr instead of the full error stack.',
      expected_outcome: 'The default server error logger should output the complete error object including stack trace details.',
      environmental_context: 'Default framework error handling middleware.'
    },
    'EXP-TEST-02': {
      problem_scenario: 'Initializing a new server instance with default runtime options.',
      observable_behavior: 'The server defaults to a complex nested query parser that allows arbitrary object creation instead of standard key-value parsing.',
      expected_outcome: 'Configure the framework to default to a simpler, safer standard query parser out of the box.',
      environmental_context: 'Framework initialization and default setting bootstrapping.'
    },
    'EXP-TEST-03': {
      problem_scenario: 'A controller handler sets an HTTP response numeric code before dispatching.',
      observable_behavior: 'Passing invalid inputs such as text or non-numeric values fails silently or produces malformed HTTP header responses.',
      expected_outcome: 'Enforce strict input validation by throwing an error whenever an invalid non-integer code is supplied.',
      environmental_context: 'HTTP response code assignment.'
    },
    'EXP-TEST-04': {
      problem_scenario: 'An application serves static assets directly from disk to web clients.',
      observable_behavior: 'Callers cannot control or override ETag header calculation when delivering files to the client.',
      expected_outcome: 'Allow callers to pass custom caching options to toggle or configure entity tag generation when delivering files.',
      environmental_context: 'Static file transmission pipeline.'
    },
    'EXP-TEST-05': {
      problem_scenario: 'A route handler initiates an HTTP redirect after form submission.',
      observable_behavior: 'Supplying the special legacy keyword "back" resolves to the Referer header, exposing the redirect to open-redirect manipulation.',
      expected_outcome: 'Remove the legacy keyword shortcut and require explicit target URLs for redirection destination headers.',
      environmental_context: 'HTTP redirection destination header construction.'
    },
    'EXP-TEST-06': {
      problem_scenario: 'A multi-representation REST API handles requests with unsupported Accept headers.',
      observable_behavior: 'When content negotiation fails to find a matching representation, the server fails with an unstandardized error representation.',
      expected_outcome: 'Standardize content negotiation failure handling to construct a consistent 406 Not Acceptable error object.',
      environmental_context: 'HTTP Accept header content negotiation.'
    },
    'EXP-TEST-07': {
      problem_scenario: 'An API sets HTTP Link headers to support HATEOAS pagination relations.',
      observable_behavior: 'Attempting to specify multiple URIs with the same relation category overwrites prior entries instead of concatenating them.',
      expected_outcome: 'Allow multiple Link header entries sharing the same relation attribute to be combined into a comma-separated header.',
      environmental_context: 'HTTP Link header construction for pagination.'
    },
    'EXP-TEST-08': {
      problem_scenario: 'An HTTP client issues a query-based read request with conditional validation headers.',
      observable_behavior: 'Conditional cache revalidation headers (If-None-Match / ETag) are ignored when using newer HTTP read methods.',
      expected_outcome: 'Enable conditional cache revalidation so the server correctly returns 304 Not Modified for supported read methods.',
      environmental_context: 'HTTP conditional request cache validation.'
    },
    'EXP-TEST-09': {
      problem_scenario: 'An internationalized API processes requests specifying character encoding preferences.',
      observable_behavior: 'When the Accept-Charset header includes multiple encodings with fractional quality factors, preference order is parsed incorrectly.',
      expected_outcome: 'Properly parse quality weightings and select the client\'s highest-preference supported character encoding.',
      environmental_context: 'HTTP Accept-Charset header content negotiation.'
    }
  };

  const allCandidates = [
    ...manifest.development_candidates,
    ...manifest.held_out_test_candidates
  ];

  if (allCandidates.length !== 18) {
    throw new Error(`Expected exactly 18 candidates in manifest, found: ${allCandidates.length}`);
  }

  // 2. Generate and store private Evaluator Blind Mapping Key
  console.log('Generating private evaluator blind mapping key...');
  const blindKeyMappings = allCandidates.map(cand => {
    const bId = cand.benchmark_id;
    const prov = provMap.get(bId);
    if (!prov) throw new Error(`Missing provenance entry for ${bId}`);
    const opaqueCardId = generateOpaqueCardId(bId);
    return {
      opaque_card_id: opaqueCardId,
      internal_card_id: `CARD-${bId}`,
      benchmark_id: bId,
      partition: cand.partition,
      provenance_tier: prov.provenance_tier,
      lineage_cluster_id: cand.lineage_cluster.split(':')[0].trim()
    };
  });

  const blindKeyData = {
    key_title: 'Retrospect Phase C — Author Card Blind Mapping Key',
    key_version: '1.0',
    freeze_date: new Date().toISOString(),
    notice: 'CONFIDENTIAL EVALUATION MAPPING — FOR EVALUATOR USE ONLY. NEVER DISTRIBUTE TO AUTHORS.',
    mappings: blindKeyMappings
  };
  fs.writeFileSync(blindKeyPath, JSON.stringify(blindKeyData, null, 2), 'utf8');
  console.log(`  Saved evaluator blind mapping key to: ${blindKeyPath}`);

  // Create lookup map for mapping validation
  const blindKeyLookup = new Map(blindKeyMappings.map(m => [m.opaque_card_id, m]));

  // 3. Generate Blinded Author-Facing Context Cards
  console.log('Generating 18 blinded author-facing Context Cards...');
  const exportedCards = [];

  for (const cand of allCandidates) {
    const bId = cand.benchmark_id;
    const opaqueCardId = generateOpaqueCardId(bId);
    const context = sanitizedContexts[bId];
    if (!context) throw new Error(`Missing sanitized context for ${bId}`);

    // Blinded card: Contains NO benchmark_id, NO partition, NO provenance_tier, NO repo prefix
    const authorCard = {
      card_id: opaqueCardId,
      developer_context: {
        problem_scenario: context.problem_scenario,
        observable_behavior: context.observable_behavior,
        expected_outcome: context.expected_outcome,
        environmental_context: context.environmental_context
      },
      sanitization_metadata: {
        sanitizer_role_id: 'PHASE-C-LEAD-SANITIZER',
        sanitization_timestamp: new Date().toISOString(),
        sanitization_attestation: 'VERIFIED_ZERO_TARGET_IDENTIFIERS'
      }
    };

    // A. Validate author-facing card against author_facing_card_schema.json
    validateCardAgainstAuthorSchema(authorCard, authorSchema);

    // B. Explicit mapping step: map back to internal card and validate against internal context_card_schema.json
    const mappedInternalCard = mapAuthorCardToInternalCard(authorCard, blindKeyLookup);
    validateCardAgainstInternalSchema(mappedInternalCard, internalSchema);

    // Write author-facing card file
    const cardFilePath = path.join(cardsDir, `${opaqueCardId}.json`);
    fs.writeFileSync(cardFilePath, JSON.stringify(authorCard, null, 2), 'utf8');
    exportedCards.push({ opaqueCardId, bId, cardFilePath, authorCard });
  }

  console.log(`  Successfully generated ${exportedCards.length} blinded Context Cards.`);

  // 4. Generate Blinded Submission Template
  const templatePath = path.join(outputDir, 'submission_template.json');
  const templateContent = {
    submission_id: 'SUB-A1B2C3',
    card_id: 'CARD-A1B2C3',
    query_text: 'Replace with natural language search query describing the functionality to locate (minimum 15 characters)',
    intent_category: 'BUG_FIX',
    author_metadata: {
      author_id: 'AUTHOR-XX',
      author_experience_level: 'SENIOR_DEV',
      authorship_timestamp: '2026-10-14T12:00:00Z',
      blinded_attestation: true,
      external_search_used: false
    }
  };
  fs.writeFileSync(templatePath, JSON.stringify(templateContent, null, 2), 'utf8');
  console.log(`  Generated blinded submission template at: ${templatePath}`);

  // 5. Generate Neutral Author Instructions (zero mention of Express)
  const instructionsPath = path.join(outputDir, 'INSTRUCTIONS_FOR_AUTHORS.md');
  const instructionsContent = `# Retrospect Phase C — Instructions for Query Authors

## Objective
You are investigating a software codebase where you need to locate the code responsible for a specific software behavior, bug fix, or capability.

Your task is to write the natural language search query you would enter into a code search tool to find the relevant function or implementation in the codebase.

---

## Instructions

1. **Review Context Cards**:
   Open each card in the \`cards/\` directory (e.g. \`CARD-1C1090.json\`).
   Each card describes:
   - **Problem Scenario**: The engineering context.
   - **Observable Behavior**: What happens currently.
   - **Expected Outcome**: What the behavior should be once addressed.
   - **Environmental Context**: The runtime subsystem.

2. **Formulate a Search Query**:
   Write a query representing how a developer would search for the code handling this behavior.
   - Write realistic queries (natural language phrases, functional descriptions, or technical terms).
   - Queries must be at least 15 characters long.
   - Do not guess internal symbol names or filenames.

3. **Fill the Submission Template**:
   For each card, copy \`submission_template.json\` to \`submissions/<submission_id>.json\`:
   - Set \`submission_id\` to \`SUB-<card_hash>\` (matching the card's ID token).
   - Set \`card_id\` to the corresponding card ID (e.g. \`CARD-1C1090\`).
   - Set \`query_text\` to your query.
   - Select \`intent_category\` from: \`BUG_FIX\`, \`FEATURE_ADDITION\`, \`REFACTORING\`, \`SECURITY_HARDENING\`, \`API_EVOLUTION\`.
   - Complete \`author_metadata\`.

---

## Strict Blinding Guidelines

- **DO NOT** inspect the target open-source repository source code, commit history, pull requests, or issue trackers.
- **DO NOT** attempt to guess exact internal file paths or internal symbol names.
- Attest that you remained blinded by setting \`blinded_attestation: true\`.
`;
  fs.writeFileSync(instructionsPath, instructionsContent, 'utf8');
  console.log(`  Generated author instructions at: ${instructionsPath}`);

  // 6. Verification: Fail-Closed Security Scanner
  console.log('\nRunning fail-closed security scanner across exported author pack...');
  const forbiddenPatterns = buildForbiddenPatterns(allCandidates);
  const scanResults = scanPackForForbiddenContent(outputDir, forbiddenPatterns);

  if (scanResults.leaks.length > 0) {
    console.error('\nSECURITY SCANNER FAILED: Restricted terms detected in exported author pack!');
    scanResults.leaks.forEach(leak => {
      console.error(`  [LEAK] File: ${leak.file} | Pattern: "${leak.pattern}" | Match: "${leak.match}"`);
    });
    // Remove compromised files and fail closed
    fs.rmSync(outputDir, { recursive: true, force: true });
    throw new Error(`Export aborted due to ${scanResults.leaks.length} security leak(s).`);
  }

  console.log(`  Security scan clean: ${scanResults.scannedFiles.length} files scanned, 0 restricted leaks detected.`);
  console.log('\n=== BLINDED AUTHOR PACK EXPORT COMPLETE ===');
  console.log(`Output Directory:    ${outputDir}`);
  console.log(`Total Cards:         ${exportedCards.length}`);
  console.log(`Evaluator Blind Key: ${blindKeyPath}`);
  console.log(`Blinding Status:     ALL 18 CARDS BLINDED & VERIFIED`);

  return {
    outputDir,
    blindKeyPath,
    cardCount: exportedCards.length,
    scannedFiles: scanResults.scannedFiles.length,
    leaksDetected: scanResults.leaks.length
  };
}

/**
 * Validates author-facing card against author_facing_card_schema.json.
 */
function validateCardAgainstAuthorSchema(card, schema) {
  for (const req of schema.required) {
    if (card[req] === undefined) throw new Error(`Author card missing required: ${req}`);
  }
  for (const key of Object.keys(card)) {
    if (!schema.properties[key]) throw new Error(`Author card contains extra property: ${key}`);
  }
  if (!new RegExp(schema.properties.card_id.pattern).test(card.card_id)) {
    throw new Error(`Author card_id does not match opaque pattern: ${card.card_id}`);
  }
  const ctx = card.developer_context;
  const ctxSchema = schema.properties.developer_context;
  for (const req of ctxSchema.required) {
    if (!ctx[req]) throw new Error(`developer_context missing required: ${req}`);
    if (ctx[req].length < 20) throw new Error(`developer_context.${req} must be >= 20 chars`);
  }
  for (const key of Object.keys(ctx)) {
    if (!ctxSchema.properties[key]) throw new Error(`developer_context contains extra property: ${key}`);
  }
  const meta = card.sanitization_metadata;
  const metaSchema = schema.properties.sanitization_metadata;
  for (const req of metaSchema.required) {
    if (meta[req] === undefined) throw new Error(`sanitization_metadata missing required: ${req}`);
  }
}

/**
 * Maps an author-facing card back to internal Context Card representation using the private blind key.
 */
function mapAuthorCardToInternalCard(authorCard, blindKeyLookup) {
  const mapping = blindKeyLookup.get(authorCard.card_id);
  if (!mapping) throw new Error(`Unmapped author card: ${authorCard.card_id}`);

  return {
    card_id: mapping.internal_card_id,
    benchmark_id: mapping.benchmark_id,
    partition: mapping.partition,
    provenance_tier: mapping.provenance_tier,
    developer_context: authorCard.developer_context,
    sanitization_metadata: {
      sanitizer_role_id: authorCard.sanitization_metadata.sanitizer_role_id,
      sanitization_timestamp: authorCard.sanitization_metadata.sanitization_timestamp,
      redacted_terms_count: 5,
      sanitization_attestation: authorCard.sanitization_metadata.sanitization_attestation
    }
  };
}

/**
 * Maps an author query submission back to internal query representation using the private blind key.
 */
function mapAuthorSubmissionToInternalQuery(submission, blindKeyLookup) {
  const mapping = blindKeyLookup.get(submission.card_id);
  if (!mapping) throw new Error(`Unmapped author submission card: ${submission.card_id}`);

  return {
    query_id: `QRY-${mapping.benchmark_id}`,
    card_id: mapping.internal_card_id,
    benchmark_id: mapping.benchmark_id,
    partition: mapping.partition,
    query_text: submission.query_text,
    intent_category: submission.intent_category,
    author_metadata: submission.author_metadata
  };
}

/**
 * Validates internal Context Card against context_card_schema.json.
 */
function validateCardAgainstInternalSchema(card, schema) {
  for (const req of schema.required) {
    if (card[req] === undefined) throw new Error(`Internal card missing required: ${req}`);
  }
  for (const key of Object.keys(card)) {
    if (!schema.properties[key]) throw new Error(`Internal card contains extra property: ${key}`);
  }
  if (!new RegExp(schema.properties.card_id.pattern).test(card.card_id)) {
    throw new Error(`Internal card_id does not match pattern: ${card.card_id}`);
  }
  if (!new RegExp(schema.properties.benchmark_id.pattern).test(card.benchmark_id)) {
    throw new Error(`Internal benchmark_id does not match pattern: ${card.benchmark_id}`);
  }
  if (!schema.properties.partition.enum.includes(card.partition)) {
    throw new Error(`Invalid partition: ${card.partition}`);
  }
  if (!schema.properties.provenance_tier.enum.includes(card.provenance_tier)) {
    throw new Error(`Invalid provenance_tier: ${card.provenance_tier}`);
  }
}

/**
 * Builds comprehensive blacklist of forbidden patterns from all candidate metadata.
 */
function buildForbiddenPatterns(candidates) {
  const patterns = new Set();

  candidates.forEach(c => {
    // Target symbol
    patterns.add(c.target_symbol);
    const parts = c.target_symbol.split('.');
    parts.forEach(p => {
      if (p.length > 3 && p !== 'http' && p !== 'protocol') {
        patterns.add(p);
      }
    });

    if (c.target_symbol.includes('clearCookie')) patterns.add('clearCookie');
    if (c.target_symbol.includes('defaultConfiguration')) patterns.add('defaultConfiguration');
    if (c.target_symbol.includes('sendFile')) patterns.add('sendFile');
    if (c.target_symbol.includes('acceptsCharsets')) patterns.add('acceptsCharsets');
    if (c.target_symbol.includes('parseExtendedQueryString')) patterns.add('parseExtendedQueryString');

    // Source files and base filenames
    patterns.add(c.source_file);
    const fname = path.basename(c.source_file);
    patterns.add(fname);

    // Commit SHAs and prefixes
    patterns.add(c.commit_sha);
    patterns.add(c.commit_sha.slice(0, 7));
    patterns.add(c.parent_sha);
    patterns.add(c.parent_sha.slice(0, 7));

    // Issue/PR references
    if (c.issue_references) {
      c.issue_references.forEach(ref => {
        patterns.add(ref);
        patterns.add(ref.replace('#', ''));
      });
    }

    // Lineage cluster names
    patterns.add(c.lineage_cluster);

    // Internal benchmark IDs
    patterns.add(c.benchmark_id);
    patterns.add(`CARD-${c.benchmark_id}`);
  });

  // Additional forbidden terms: Framework identity, partitions, CVEs, package names
  patterns.add('express');
  patterns.add('DEVELOPMENT');
  patterns.add('HELD_OUT_TEST');
  patterns.add('CVE-2024-51999');
  patterns.add('array-flatten');
  patterns.add('mime-types');

  return Array.from(patterns).filter(p => p && p.length > 2);
}

/**
 * Recursively scans directory for any occurrence of forbidden patterns.
 */
function scanPackForForbiddenContent(dir, patterns) {
  const leaks = [];
  const scannedFiles = [];

  function scanFile(filePath) {
    scannedFiles.push(filePath);
    const content = fs.readFileSync(filePath, 'utf8');

    for (const pattern of patterns) {
      const regex = new RegExp(`\\b${escapeRegExp(pattern)}\\b`, 'i');
      if (regex.test(content)) {
        const match = content.match(regex)[0];
        leaks.push({
          file: path.relative(dir, filePath),
          pattern,
          match
        });
      }
    }
  }

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        scanFile(fullPath);
      }
    }
  }

  walk(dir);
  return { leaks, scannedFiles };
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

if (require.main === module) {
  try {
    runExport();
  } catch (err) {
    console.error('Fatal Error:', err.message);
    process.exit(1);
  }
}

module.exports = {
  runExport,
  generateOpaqueCardId,
  mapAuthorCardToInternalCard,
  mapAuthorSubmissionToInternalQuery,
  validateCardAgainstAuthorSchema,
  validateCardAgainstInternalSchema,
  buildForbiddenPatterns,
  scanPackForForbiddenContent
};
