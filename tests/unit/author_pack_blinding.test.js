const fs = require('fs');
const path = require('path');
const {
  runExport,
  generateOpaqueCardId,
  mapAuthorCardToInternalCard,
  mapAuthorSubmissionToInternalQuery,
  validateCardAgainstAuthorSchema,
  validateCardAgainstInternalSchema,
  buildForbiddenPatterns,
  scanPackForForbiddenContent
} = require('../../scripts/export_phase_c_author_pack');

describe('Phase C Author Pack Blinding and Packaging Tests', () => {
  const repoRoot = path.resolve(__dirname, '../..');
  const manifestPath = path.join(repoRoot, 'data/phase_c/discovery/express_final_candidate_manifest_v1.0.json');
  const blindKeyPath = path.join(repoRoot, 'data/phase_c/discovery/author_card_blind_key.json');
  const internalSchemaPath = path.join(repoRoot, 'data/phase_c/schemas/context_card_schema.json');
  const authorSchemaPath = path.join(repoRoot, 'data/phase_c/schemas/author_facing_card_schema.json');
  const querySchemaPath = path.join(repoRoot, 'data/phase_c/schemas/authored_query_schema.json');
  const outputDir = path.join(repoRoot, 'exported_packs/phase_c_author_pack');
  const cardsDir = path.join(outputDir, 'cards');

  let manifest;
  let blindKey;
  let internalSchema;
  let authorSchema;
  let querySchema;
  let cardFiles;

  beforeAll(() => {
    // Ensure export has run cleanly
    runExport();

    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    blindKey = JSON.parse(fs.readFileSync(blindKeyPath, 'utf8'));
    internalSchema = JSON.parse(fs.readFileSync(internalSchemaPath, 'utf8'));
    authorSchema = JSON.parse(fs.readFileSync(authorSchemaPath, 'utf8'));
    querySchema = JSON.parse(fs.readFileSync(querySchemaPath, 'utf8'));
    cardFiles = fs.readdirSync(cardsDir);
  });

  test('1. ID Opacity: Card IDs use opaque hash tokens without repository or partition clues', () => {
    expect(cardFiles.length).toBe(18);

    const cardIds = [];
    cardFiles.forEach(file => {
      const cardId = path.basename(file, '.json');
      cardIds.push(cardId);

      // Must match CARD-[6 hex characters]
      expect(cardId).toMatch(/^CARD-[A-Z0-9]{6}$/);

      // Must never contain repository or partition identifiers
      expect(cardId).not.toContain('EXP');
      expect(cardId).not.toContain('DEV');
      expect(cardId).not.toContain('TEST');
    });

    // All 18 IDs must be unique
    const uniqueIds = new Set(cardIds);
    expect(uniqueIds.size).toBe(18);

    // Card filenames in alphabetical order must interleave Dev and Test partitions
    const blindMap = new Map(blindKey.mappings.map(m => [m.opaque_card_id, m.partition]));
    const partitionsInOrder = cardIds.sort().map(id => blindMap.get(id));
    
    // Ensure Dev and Test are mixed and not trivially partitioned into two blocks
    let partitionSwitches = 0;
    for (let i = 1; i < partitionsInOrder.length; i++) {
      if (partitionsInOrder[i] !== partitionsInOrder[i - 1]) partitionSwitches++;
    }
    expect(partitionSwitches).toBeGreaterThan(4); // Non-trivial interleaving
  });

  test('2. Partition Removal: Author cards and submission template omit partition and benchmark metadata', () => {
    cardFiles.forEach(file => {
      const content = fs.readFileSync(path.join(cardsDir, file), 'utf8');
      const card = JSON.parse(content);

      // Forbidden author-facing fields
      expect(card.partition).toBeUndefined();
      expect(card.benchmark_id).toBeUndefined();
      expect(card.provenance_tier).toBeUndefined();
      expect(card.internal_card_id).toBeUndefined();

      // Raw JSON must not contain partition strings
      expect(content).not.toContain('DEVELOPMENT');
      expect(content).not.toContain('HELD_OUT_TEST');
      expect(content).not.toContain('EXP-DEV');
      expect(content).not.toContain('EXP-TEST');
    });

    const templateContent = fs.readFileSync(path.join(outputDir, 'submission_template.json'), 'utf8');
    const template = JSON.parse(templateContent);
    expect(template.partition).toBeUndefined();
    expect(template.benchmark_id).toBeUndefined();
    expect(templateContent).not.toContain('DEVELOPMENT');
    expect(templateContent).not.toContain('HELD_OUT_TEST');
    expect(templateContent).not.toContain('EXP-DEV');
    expect(templateContent).not.toContain('EXP-TEST');
  });

  test('3. Repository Identity: Author pack files contain zero mentions of Express', () => {
    function checkDir(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          checkDir(fullPath);
        } else if (entry.isFile()) {
          const content = fs.readFileSync(fullPath, 'utf8');
          expect(content).not.toMatch(/\bexpress\b/i);
        }
      }
    }

    checkDir(outputDir);
  });

  test('4. 1:1 Mapping Parity: Every internal candidate maps to exactly one author card', () => {
    const allCandidates = [
      ...manifest.development_candidates,
      ...manifest.held_out_test_candidates
    ];
    expect(allCandidates.length).toBe(18);
    expect(blindKey.mappings.length).toBe(18);

    const bIdSet = new Set(allCandidates.map(c => c.benchmark_id));
    const opaqueCardSet = new Set(blindKey.mappings.map(m => m.opaque_card_id));

    // Every benchmark candidate is present in the blind key
    blindKey.mappings.forEach(m => {
      expect(bIdSet.has(m.benchmark_id)).toBe(true);
      expect(opaqueCardSet.has(m.opaque_card_id)).toBe(true);
      expect(fs.existsSync(path.join(cardsDir, `${m.opaque_card_id}.json`))).toBe(true);
    });

    // Every card file on disk corresponds to an entry in the blind key
    cardFiles.forEach(file => {
      const cardId = path.basename(file, '.json');
      expect(opaqueCardSet.has(cardId)).toBe(true);
    });
  });

  test('5. Schema & Lossless Mapping Integrity: Blinded cards map cleanly to internal schema', () => {
    const blindLookup = new Map(blindKey.mappings.map(m => [m.opaque_card_id, m]));

    cardFiles.forEach(file => {
      const card = JSON.parse(fs.readFileSync(path.join(cardsDir, file), 'utf8'));

      // A. Validates against author-facing schema
      expect(() => validateCardAgainstAuthorSchema(card, authorSchema)).not.toThrow();

      // B. Maps back to internal Context Card representation
      const internalCard = mapAuthorCardToInternalCard(card, blindLookup);

      // C. Validates against internal context_card_schema.json without errors
      expect(() => validateCardAgainstInternalSchema(internalCard, internalSchema)).not.toThrow();
      expect(internalCard.card_id).toMatch(/^CARD-EXP-(DEV|TEST)-[0-9]{2}$/);
      expect(internalCard.benchmark_id).toMatch(/^EXP-(DEV|TEST)-[0-9]{2}$/);
      expect(['DEVELOPMENT', 'HELD_OUT_TEST']).toContain(internalCard.partition);
    });

    // D. Validate submission mapping
    const mockSubmission = {
      submission_id: 'SUB-1C1090',
      card_id: 'CARD-1C1090',
      query_text: 'find error callback invoked multiple times during server startup',
      intent_category: 'BUG_FIX',
      author_metadata: {
        author_id: 'AUTHOR-TEST',
        author_experience_level: 'SENIOR_DEV',
        authorship_timestamp: '2026-10-14T12:00:00Z',
        blinded_attestation: true,
        external_search_used: false
      }
    };

    const internalQuery = mapAuthorSubmissionToInternalQuery(mockSubmission, blindLookup);
    expect(internalQuery.query_id).toBe('QRY-EXP-DEV-01');
    expect(internalQuery.benchmark_id).toBe('EXP-DEV-01');
    expect(internalQuery.partition).toBe('DEVELOPMENT');

    // Validates against internal authored_query_schema.json
    for (const req of querySchema.required) {
      expect(internalQuery[req]).toBeDefined();
    }
  });

  test('6. Forbidden Information Scanner: Confirms zero target symbols, paths, SHAs, or PR numbers', () => {
    const allCandidates = [
      ...manifest.development_candidates,
      ...manifest.held_out_test_candidates
    ];
    const patterns = buildForbiddenPatterns(allCandidates);
    const scanResults = scanPackForForbiddenContent(outputDir, patterns);

    expect(scanResults.leaks).toHaveLength(0);
    expect(scanResults.scannedFiles.length).toBeGreaterThanOrEqual(20);

    // Verify scanner actually catches injected forbidden content
    const testPatterns = ['forbidden_symbol_test'];
    const mockContent = 'This contains forbidden_symbol_test in prose.';
    const regex = new RegExp(`\\bforbidden_symbol_test\\b`, 'i');
    expect(regex.test(mockContent)).toBe(true);
  });
});
