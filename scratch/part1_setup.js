const fs = require('fs');
const path = require('path');
const { execFileSync, execSync } = require('child_process');

const retrospectDir = 'D:/base papers considered/Retrospect';
const testCreationDir = 'D:/base papers considered/Test creation';
const clonesDir = 'D:/clones';

const expDirName = 'final_multirepo_evaluation_merge_aware_2026-10-20';
const outputDir = path.join(testCreationDir, 'experiments', expDirName);
fs.mkdirSync(outputDir, { recursive: true });

// Retrospect Modules
const { indexRepository } = require(path.join(retrospectDir, 'src/structural/index'));
const { StructuralRetriever } = require(path.join(retrospectDir, 'src/structural/retrieval/StructuralRetriever'));
const QueryProcessor = require(path.join(retrospectDir, 'src/structural/query/QueryProcessor'));
const HistoricalRetrievalAdapter = require(path.join(retrospectDir, 'src/retrieval/HistoricalRetrievalAdapter'));
const { fuseRRFv2 } = require(path.join(retrospectDir, 'src/retrieval/RRFv2'));
const RetrospectEvaluator = require(path.join(retrospectDir, 'src/evaluation/RetrospectEvaluator'));
const ClusterBootstrap = require(path.join(retrospectDir, 'src/evaluation/ClusterBootstrap'));

const repoCloneMap = {
  'checkstyle/checkstyle': path.join(clonesDir, 'checkstyle'),
  'graphhopper/graphhopper': path.join(clonesDir, 'graphhopper'),
  'undertow-io/undertow': path.join(clonesDir, 'undertow'),
  'datastax/java-driver': path.join(clonesDir, 'datastax-java-driver'),
  'google/guava': path.join(clonesDir, 'guava'),
  'psf/requests': path.join(clonesDir, 'requests'),
  'colinhacks/zod': path.join(clonesDir, 'zod'),
  'encode/httpx': path.join(clonesDir, 'httpx'),
  'pytest-dev/pytest': path.join(clonesDir, 'pytest'),
  'marshmallow-code/marshmallow': path.join(clonesDir, 'marshmallow'),
  'moment/moment': path.join(clonesDir, 'moment'),
  'mochajs/mocha': path.join(clonesDir, 'mocha'),
  'vuejs/core': path.join(clonesDir, 'vue'),
  'ReactiveX/rxjs': path.join(clonesDir, 'rxjs'),
  'lodash/lodash': path.join(clonesDir, 'lodash')
};

// -------------------------------------------------------------
// 1. DATASET INVENTORY DEFINITION
// -------------------------------------------------------------
const datasetInventory = [
  {
    dataset_id: 'category-b-repaired',
    dataset_family: 'historical-symbol-retrieval',
    language: 'Java',
    target_repositories: 'checkstyle, graphhopper, undertow, datastax-java-driver',
    total_cases: 29,
    eligible_cases: 29,
    excluded_cases: 0,
    verified_pins_rate: '100% (29/29)',
    schema_conformance: '100% PASS',
    provenance_type: 'RefactoringMiner Oracle + AST Hard Negatives',
    evaluation_role: 'Primary Confirmatory / Diagnostic',
    audit_notes: 'Schema repaired on 2026-10-19; 5 in-horizon cases, 20 distance-stratified cases, 4 quarantined negatives'
  },
  {
    dataset_id: 'historical-pilot-v1-2026-10-20',
    dataset_family: 'cross-language-historical-retrieval',
    language: 'Python, JavaScript, TypeScript',
    target_repositories: 'httpx, pytest, marshmallow, moment, mocha, vue, rxjs, lodash',
    total_cases: 12,
    eligible_cases: 11,
    excluded_cases: 1,
    verified_pins_rate: '91.7% (11/12)',
    schema_conformance: '100% PASS',
    provenance_type: 'Git-first Verified Lineage Events + Human-Curated Queries',
    evaluation_role: 'Cross-Language Exploratory Pilot',
    audit_notes: '11 cases with verified Git pins in clones; CASE-HIST-JS-004 (lodash) excluded due to missing pin in clone'
  },
  {
    dataset_id: 'verified-pilot-v1',
    dataset_family: 'verified-pilot-cases',
    language: 'Java, Python, TypeScript',
    target_repositories: 'guava, requests, zod, checkstyle',
    total_cases: 5,
    eligible_cases: 5,
    excluded_cases: 0,
    verified_pins_rate: '100% (5/5)',
    schema_conformance: '100% PASS',
    provenance_type: 'Independently Audited Benchmarks',
    evaluation_role: 'Structural and Historical Pilot Anchors',
    audit_notes: '3 structural pilot cases (CASE-STRUCT-JAVA-001, PY-002, TS-004) and 2 historical pilot cases (CASE-HIST-JAVA-001, JAVA-002)'
  },
  {
    dataset_id: 'legacy-custom-structural',
    dataset_family: 'structural-symbol-retrieval',
    language: 'Java, Python, JavaScript, TypeScript',
    target_repositories: '18 catalog repos',
    total_cases: 17,
    eligible_cases: 3,
    excluded_cases: 14,
    verified_pins_rate: '23.5% (4/17)',
    schema_conformance: 'Partial',
    provenance_type: 'Prototype Synthetic Catalog',
    evaluation_role: 'Legacy Background (Excluded)',
    audit_notes: '13 cases contained synthetic recycled commit SHAs not present in cloned fleet'
  },
  {
    dataset_id: 'legacy-custom-refactoring',
    dataset_family: 'refactoring-lineage-retrieval',
    language: 'Java',
    target_repositories: 'checkstyle, junit5, trpc',
    total_cases: 42,
    eligible_cases: 0,
    excluded_cases: 42,
    verified_pins_rate: '83.3% (35/42)',
    schema_conformance: 'Failed (0 queries)',
    provenance_type: 'Raw RefactoringMiner Commits',
    evaluation_role: 'Legacy Background (Excluded)',
    audit_notes: 'Contains raw AST commits but zero authored retrieval benchmark queries'
  },
  {
    dataset_id: 'legacy-custom-negatives',
    dataset_family: 'historical-confounders-hard-negatives',
    language: 'Java, Python, JavaScript, TypeScript',
    target_repositories: '23 repos',
    total_cases: 100,
    eligible_cases: 0,
    excluded_cases: 100,
    verified_pins_rate: '21.0% (21/100)',
    schema_conformance: 'Failed Referentials',
    provenance_type: 'Synthetic Confounder Mining',
    evaluation_role: 'Legacy Background (Excluded)',
    audit_notes: '100 cases failed referential audit due to synthetic catalog SHAs'
  }
];

// Write dataset_inventory.csv
const invHeaders = [
  'dataset_id', 'dataset_family', 'language', 'target_repositories',
  'total_cases', 'eligible_cases', 'excluded_cases', 'verified_pins_rate',
  'schema_conformance', 'provenance_type', 'evaluation_role', 'audit_notes'
];
const invRows = [invHeaders.join(',')];
for (const inv of datasetInventory) {
  invRows.push([
    inv.dataset_id,
    inv.dataset_family,
    `"${inv.language}"`,
    `"${inv.target_repositories}"`,
    inv.total_cases,
    inv.eligible_cases,
    inv.excluded_cases,
    `"${inv.verified_pins_rate}"`,
    `"${inv.schema_conformance}"`,
    `"${inv.provenance_type}"`,
    `"${inv.evaluation_role}"`,
    `"${inv.audit_notes}"`
  ].join(','));
}
fs.writeFileSync(path.join(outputDir, 'dataset_inventory.csv'), invRows.join('\n'), 'utf8');

console.log('Saved dataset_inventory.csv');

module.exports = { outputDir };
