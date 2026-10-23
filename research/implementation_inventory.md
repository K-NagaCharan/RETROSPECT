# Retrospect — Implementation Inventory

**Branch:** \`eval-reframing-empirical-study\`  
**Base Commit:** \`17ea399217737f8d5fe2c32c310b69c2f812b84d\`  
**Date:** 2026-10-20  
**Test Suite Status:** 19/19 Test Suites Passing (156/156 Tests)  
**Evaluator Status:** FROZEN IMPLEMENTATION UNDER EVALUATION

---

## 1. Executive Summary & Purpose

This inventory establishes the technical baseline of the **Retrospect** codebase. In strict adherence to research directives, the existing retrieval implementation is frozen. The goal is to conduct a credible, reproducible empirical evaluation of the current system to address the reframed research question:

> **"Under what conditions does historical code retrieval recover relevant code that current-repository structural retrieval misses, and what factors limit its effectiveness?"**

---

## 2. Component Inventory: Committed vs. Uncommitted Work

The codebase builds on commit \`17ea399217737f8d5fe2c32c310b69c2f812b84d\` on \`main\`. The working tree contains essential uncommitted modules and modifications that complete the merge-aware evaluation pipeline.

### Table 1: Core Implementation Files

| Component | Path | Status | SHA-256 Digest | Role & Description |
|---|---|:---:|---|---|
| **Structural Retriever** | [\`src/structural/retrieval/StructuralRetriever.js\`](file:///D:/base%20papers%20considered/Retrospect/src/structural/retrieval/StructuralRetriever.js) | Committed | \`9380234c73deebdbbc12b498ced34469cd99de6deb20daf94aabfa31cbd2fdd6\` | AST symbol indexer and lexical token matcher over contemporary codebase ($HEAD$). Produces baseline B1. |
| **Query Processor** | [\`src/structural/query/QueryProcessor.js\`](file:///D:/base%20papers%20considered/Retrospect/src/structural/query/QueryProcessor.js) | Modified | \`28ad87904fe03c46895465e9303d0f4c43166503832b9d2b1f3a3d2237684cb7\` | Subtoken decomposition, morphological stemming, identifier extraction, and stopword filtering across Java, Python, JS, TS. |
| **Git History Reader** | [\`src/git/GitHistoryReader.js\`](file:///D:/base%20papers%20considered/Retrospect/src/git/GitHistoryReader.js) | Modified | \`46c1e7eb1cc7c81831b0bfc0d8c8e57a2bb183120e0ede79d6d1efc2c9169ba5\` | Merge-aware topological commit traversal (\`--topo-order\`, default $H=50$), commit metadata extraction, diff parser, and composite merge isolation. |
| **Historical Adapter** | [\`src/retrieval/HistoricalRetrievalAdapter.js\`](file:///D:/base%20papers%20considered/Retrospect/src/retrieval/HistoricalRetrievalAdapter.js) | Modified | \`374f85f33000fe8096623deb1d47b9238abdbfea3ba0ebf23354ccd17faceb4e\` | Transitive lineage stitcher ($A \to B \to C$), diff/message token scoring, linear fusion, and historical ranking adapter. Produces baseline B2 and B3. |
| **Historical Retriever** | [\`src/retrieval/HistoricalRetriever.js\`](file:///D:/base%20papers%20considered/Retrospect/src/retrieval/HistoricalRetriever.js) | Committed | \`2499cd9bd20a2c1fb01eddb890d84483aabc8de40502f3f3af1eff135328ca90\` | Core commit history scanner and symbol change accumulator. |
| **Function Matcher** | [\`src/matcher/FunctionMatcher.js\`](file:///D:/base%20papers%20considered/Retrospect/src/matcher/FunctionMatcher.js) | Committed | \`9d194c28abf94287f29f4b9430f3e8ddd68f51d821b33e8daf0fa719cf27f278\` | Two-tier function tracking: Tier 1 exact hash/signature, Tier 2 token-Jaccard body similarity ($\ge 0.70$), with conservative ambiguity guards. |
| **RRF-v2 Fusion Engine** | [\`src/retrieval/RRFv2.js\`](file:///D:/base%20papers%20considered/Retrospect/src/retrieval/RRFv2.js) | Untracked | \`d1e555d9640bd95d195bf7fa151d27c8875c2e1b89bead9bf59479a4a30d6e21\` | Channel-balanced Cormack Reciprocal Rank Fusion ($k=60, w_S=0.50, w_H=0.50$). Zero-signal gating, fractional tie-breaking, strict weak ordering. Produces B4 / S1. |
| **Legacy Unified Search** | [\`src/retrieval/UnifiedSearch.js\`](file:///D:/base%20papers%20considered/Retrospect/src/retrieval/UnifiedSearch.js) | Committed | \`156e4149ba57bf17b4e0b92ed2968f57510e987595cf4ebeaac791ff695b844e\` | Legacy RRF-v1 implementation featuring fallback ranks and alphabetical tie leakage. Preserved as historical comparison baseline. |
| **Benchmark Case Loader** | [\`src/evaluation/BenchmarkCaseLoader.js\`](file:///D:/base%20papers%20considered/Retrospect/src/evaluation/BenchmarkCaseLoader.js) | Untracked | \`bbfb597b4d8985172ec22fb853cb657c94fa22105e4b2d3989c79e6022e03aa3\` | Schema-agnostic case loader, repository clone existence validator, Git commit existence checker (\`git cat-file -e\`), and decoy auditor. |
| **3-Stage Evaluator** | [\`src/evaluation/RetrospectEvaluator.js\`](file:///D:/base%20papers%20considered/Retrospect/src/evaluation/RetrospectEvaluator.js) | Untracked | \`485c89f064610978aba153bd5b77b26ef8abef2220cda9cc3fec81cc6c00e00d\` | Core evaluation harness measuring Stage A (Reachability), Stage B (Detection), and Stage C (Ranking) across B1, B2, B3, and B4. |
| **Cluster Bootstrap** | [\`src/evaluation/ClusterBootstrap.js\`](file:///D:/base%20papers%20considered/Retrospect/src/evaluation/ClusterBootstrap.js) | Untracked | \`c429ec4756860410a38f950d0a5234f9caa9ae80facb5c85cc01c226dc20b079\` | Origin-commit cluster bootstrap engine ($B \ge 1000$ resamples) with linear percentile interpolation and small-sample warnings ($M < 15$). |
| **Split Guard** | [\`src/evaluation/SplitGuard.js\`](file:///D:/base%20papers%20considered/Retrospect/src/evaluation/SplitGuard.js) | Untracked | \`9734df2239d560c07d35ca923e3cb62ba4a7a8d56b2fdb8158d69e46a788cb9b\` | Safety guard blocking test-set leakage into diagnostic tuning runs. |

---

## 3. Supported Languages & Tree-Sitter Parsers

Retrospect indexes codebases using WebAssembly Tree-sitter parsers (`web-tree-sitter`):
1. **Java:** [\`src/languages/JavaAdapter.js\`](file:///D:/base%20papers%20considered/Retrospect/src/languages/JavaAdapter.js) (`tree-sitter-java.wasm`) — Extracts classes, interfaces, methods, constructors, docstrings, annotations, call expressions.
2. **Python:** [\`src/languages/PythonAdapter.js\`](file:///D:/base%20papers%20considered/Retrospect/src/languages/PythonAdapter.js) (`tree-sitter-python.wasm`) — Extracts classes, functions, async functions, docstrings, decorators, calls.
3. **JavaScript:** [\`src/languages/JavaScriptAdapter.js\`](file:///D:/base%20papers%20considered/Retrospect/src/languages/JavaScriptAdapter.js) (`tree-sitter-javascript.wasm`) — Extracts functions, methods, arrow functions, classes, exports, JSDoc.
4. **TypeScript:** [\`src/languages/TypeScriptAdapter.js\`](file:///D:/base%20papers%20considered/Retrospect/src/languages/TypeScriptAdapter.js) (`tree-sitter-typescript.wasm`) — Extracts typed functions, interfaces, methods, exported declarations.

All 4 language adapters are implemented, integrated into `CodebaseScanner`, and verified by automated unit tests (`tests/unit/adapters.test.js`).

---

## 4. Automated Test Suite Census

Executing `npm test` runs **19 test suites** containing **156 tests**, with **100% passing (0 failures)**:
- `tests/unit/matcher.test.js` (6 tests) — FunctionMatcher Tier 1, Tier 2, and ambiguity policies.
- `tests/unit/rrf_v2.test.js` (17 tests) — RRF-v2 zero-signal gating, tie-breaking, strict weak ordering, channel balancing.
- `tests/unit/historical_retrieval_adapter.test.js` (21 tests) — Lineage stitching, active-channel normalization, ablation isolation.
- `tests/unit/git_history_reader.test.js` (11 tests) — Commit parsing, diff extraction, merge-aware topological ordering.
- `tests/unit/structural_retriever.test.js` (6 tests) — Structural ranking, call-graph boosts, token limits.
- `tests/unit/structural_query.test.js` (12 tests) — Subtoken splitting, stemming, identifier extraction across 4 languages.
- `tests/unit/structural_fixes.test.js` (8 tests) — Regression tests for query-understanding bug fixes.
- `tests/unit/structural_discovery.test.js` (5 tests) — Directory traversal, exclusion patterns, gitignore handling.
- `tests/unit/adapters.test.js` (12 tests) — Multi-language AST parsing (Java, Python, JS, TS).
- `tests/unit/evaluation_integrity.test.js` (8 tests) — Anti-leakage checks, deterministic ranking, full candidate pools.
- `tests/evaluation/evaluator.test.js` (2 tests) — Dataset summary and rejection tests.
- `tests/evaluation/new_evaluator.test.js` (24 tests) — 3-stage metrics, cluster bootstrap, split guarding.
- `tests/integration/history_tracking.test.js` (2 tests) — Multi-hop transitive tracking across Git renames and merges.
- Remaining suites: AST extraction and tokenization utility tests.

---

## 5. Evaluation Harness Entry Points

The repository provides three evaluation interfaces:
1. **Interactive / Modular CLI Runner:** [\`scripts/run_benchmark_evaluator.js\`](file:///D:/base%20papers%20considered/Retrospect/scripts/run_benchmark_evaluator.js)  
   CLI interface supporting split filtering, clone path redirection, and output formatting.
2. **Snapshot-Amortized Multi-Repo Worker:** [\`scratch/evaluate_snapshot_worker.js\`](file:///D:/base%20papers%20considered/Retrospect/scratch/evaluate_snapshot_worker.js)  
   Amortizes expensive AST parsing across multiple cases evaluated at the same Git pin snapshot, preserving full candidate pools and scoring B1, B2, B3, B4 deterministically.
3. **Master Evaluation Coordinator:** [\`scratch/run_full_multirepo_evaluation.js\`](file:///D:/base%20papers%20considered/Retrospect/scratch/run_full_multirepo_evaluation.js)  
   Coordinates multi-repository evaluation runs, handles worker subprocesses, and aggregates results.

---

## 6. Known Implementation Boundaries & Invariants

1. **Frozen Retrieval Algorithms:** Ranking algorithms, fusion formulas, and scoring thresholds are strictly frozen. No tuning will be performed to inflate metrics.
2. **History Horizon Limit:** Default topological search depth is bounded at $H = 50$ commits (`--topo-order -n 50`). Refactoring events occurring earlier are out of scope for this version.
3. **Candidate Universe:** Primary retrieval targets are strictly contemporary callable symbols in the evaluated checkout snapshot ($HEAD$). Historical code is not returned as a primary result.
