# Retrospect — Reproducibility Record & Artifact Manifest

**Branch:** \`eval-reframing-empirical-study\`  
**Base Commit:** \`17ea399217737f8d5fe2c32c310b69c2f812b84d\`  
**Date:** 2026-10-20  
**Evaluator Status:** REPRODUCIBLE WITH BIT-LEVEL INTEGRITY

---

## 1. Execution Environment

- **Operating System:** Microsoft Windows 11 Enterprise (x64)
- **Node.js Runtime:** v22.17.1
- **Package Manager:** npm v10.8.2
- **Test Runner:** Jest v29.7.0
- **AST Parsing Engine:** \`web-tree-sitter\` with precompiled WebAssembly grammars for Java, Python, JavaScript, and TypeScript
- **Git Version:** Git 2.44+ (Windows)

---

## 2. Pinned Repository Fleet & Commit Hashes

All evaluated repositories reside in \`D:\clones\`. Each repository was evaluated at an authentic, frozen Git commit pin:

| Repository Slug | Clone Directory | Evaluation Pin SHA | Target Language | Pinned Cases |
|---|---|---|---|---:|
| \`checkstyle/checkstyle\` | [\`D:\clones\checkstyle\`](file:///D:/clones/checkstyle) | \`119fd6fb33bf9f086246307e28969f1680a78c14\` | Java | 15 |
| \`graphhopper/graphhopper\` | [\`D:\clones\graphhopper\`](file:///D:/clones/graphhopper) | \`c7497d11005f1dfa2cb3c6a461320ea4b9fb3990\` | Java | 8 |
| \`undertow-io/undertow\` | [\`D:\clones\undertow\`](file:///D:/clones/undertow) | \`a552bf31da81188544d038ea8f37682cb75e1ec9\` | Java | 7 |
| \`datastax/java-driver\` | [\`D:\clones\datastax-java-driver\`](file:///D:/clones/datastax-java-driver) | \`fa5c26ba60ee9fcb47372b64d08b3ba01cae8dd9\` | Java | 5 |
| \`google/guava\` | [\`D:\clones\guava\`](file:///D:/clones/guava) | \`db74bd2fdac443223d45e6fc5c66548542be1081\` | Java | 2 |
| \`psf/requests\` | [\`D:\clones\requests\`](file:///D:/clones/requests) | \`b64ae49f50cb90eb938eb4bc8717a6a4f48ffc32\` | Python | 1 |
| \`colinhacks/zod\` | [\`D:\clones\zod\`](file:///D:/clones/zod) | \`8cf4756bf0a7479c37267ce2a7f53a2ef39d2c55\` | TypeScript | 1 |
| \`encode/httpx\` | [\`D:\clones\httpx\`](file:///D:/clones/httpx) | \`50c76bf0632b73bc1bb0ba2f483c748c18adfc38\` | Python | 2 |
| \`pytest-dev/pytest\` | [\`D:\clones\pytest\`](file:///D:/clones/pytest) | \`41d8fb09ca1d201ef126347c4bffe77f0e0245d2\` | Python | 1 |
| \`marshmallow-code/marshmallow\` | [\`D:\clones\marshmallow\`](file:///D:/clones/marshmallow) | \`06310b49f08e5042d1b6073cc17788e03988ffb7\` | Python | 1 |
| \`moment/moment\` | [\`D:\clones\moment\`](file:///D:/clones/moment) | \`0e67426b8e8d200a3ca7dab046040717110e87e6\` | JavaScript | 1 |
| \`mochajs/mocha\` | [\`D:\clones\mocha\`](file:///D:/clones/mocha) | \`3e20dfce5e827cf17b9b2fffc74950346001ec86\` | JavaScript | 2 |
| \`vuejs/vue\` | [\`D:\clones\vue\`](file:///D:/clones/vue) | \`c346af2b6aa1c2796818405b4a960fc5c571594e\` | TypeScript | 1 |
| \`ReactiveX/rxjs\` | [\`D:\clones\rxjs\`](file:///D:/clones/rxjs) | \`85848bb2e38c92a95c96791e8476a666991e4c9c\` | TypeScript | 3 |

---

## 3. Cryptographic Hashes of Core Modules

| File Path | SHA-256 Checksum | Modification State |
|---|---|:---:|
| [\`src/structural/retrieval/StructuralRetriever.js\`](file:///D:/base%20papers%20considered/Retrospect/src/structural/retrieval/StructuralRetriever.js) | \`9380234c73deebdbbc12b498ced34469cd99de6deb20daf94aabfa31cbd2fdd6\` | Frozen Baseline |
| [\`src/structural/query/QueryProcessor.js\`](file:///D:/base%20papers%20considered/Retrospect/src/structural/query/QueryProcessor.js) | \`28ad87904fe03c46895465e9303d0f4c43166503832b9d2b1f3a3d2237684cb7\` | Modified (Stemming/Regex) |
| [\`src/git/GitHistoryReader.js\`](file:///D:/base%20papers%20considered/Retrospect/src/git/GitHistoryReader.js) | \`46c1e7eb1cc7c81831b0bfc0d8c8e57a2bb183120e0ede79d6d1efc2c9169ba5\` | Modified (Merge-Aware) |
| [\`src/retrieval/HistoricalRetrievalAdapter.js\`](file:///D:/base%20papers%20considered/Retrospect/src/retrieval/HistoricalRetrievalAdapter.js) | \`374f85f33000fe8096623deb1d47b9238abdbfea3ba0ebf23354ccd17faceb4e\` | Modified (Lineage Stitching) |
| [\`src/retrieval/RRFv2.js\`](file:///D:/base%20papers%20considered/Retrospect/src/retrieval/RRFv2.js) | \`d1e555d9640bd95d195bf7fa151d27c8875c2e1b89bead9bf59479a4a30d6e21\` | New Module |
| [\`src/matcher/FunctionMatcher.js\`](file:///D:/base%20papers%20considered/Retrospect/src/matcher/FunctionMatcher.js) | \`9d194c28abf94287f29f4b9430f3e8ddd68f51d821b33e8daf0fa719cf27f278\` | Frozen Baseline |
| [\`src/evaluation/BenchmarkCaseLoader.js\`](file:///D:/base%20papers%20considered/Retrospect/src/evaluation/BenchmarkCaseLoader.js) | \`bbfb597b4d8985172ec22fb853cb657c94fa22105e4b2d3989c79e6022e03aa3\` | New Module (Hyphen fix applied) |
| [\`src/evaluation/RetrospectEvaluator.js\`](file:///D:/base%20papers%20considered/Retrospect/src/evaluation/RetrospectEvaluator.js) | \`485c89f064610978aba153bd5b77b26ef8abef2220cda9cc3fec81cc6c00e00d\` | New Module |

---

## 4. Exact Reproduction Commands

To reproduce the complete evaluation from a clean shell in \`D:\base papers considered\Retrospect\`:

### 1. Verify Regression Test Suite
\`\`\`powershell
npm test
\`\`\`
*Expected Output:* 19 test suites passed, 156 tests passing.

### 2. Verify Evaluator Unit Tests
\`\`\`powershell
npx jest tests/evaluation/new_evaluator.test.js
\`\`\`
*Expected Output:* 1 suite passed, 25 tests passing (including hyphenated repository resolution).

### 3. Generate Research Deliverables & Metrics
\`\`\`powershell
node scratch/generate_research_deliverables.js
\`\`\`
*Expected Output:* Generates \`research/per_case_empirical_results.csv\`, \`research/aggregate_empirical_metrics.json\`, \`research/aggregate_empirical_metrics.csv\`, and \`research/category_breakdown.csv\`.
