import os

report_content = """# Retrospect Historical-Rescue: Reconnaissance Report (Stage 1)
**Date:** 2026-10-20  
**Evaluator System:** Retrospect v1.0.0 (branch `eval-reframing-empirical-study`, commit `17ea399`)  
**Workspace:** `D:\\base papers considered\\Retrospect`  
**Dataset Workspace:** `D:\\base papers considered\\Test creation\\datasets\\retrospect_historical_rescue_v1`  

---

## 1. Executive Summary & Objective

This reconnaissance audit evaluates the operational readiness of the Retrospect codebase, existing test suites, repository fleet in `D:\\clones`, and prior mined refactoring records for conducting a rigorous, multi-repository, case-level empirical evaluation of evolution-aware code retrieval.

The primary research question is:
> *Under what conditions does evolution-aware retrieval recover relevant code that current-code structural retrieval misses, and what factors limit its effectiveness?*

---

## 2. Retrospect Retrieval & Fusion Architecture

Retrospect provides four standardized retrieval configurations:
1. **B1: Structural Retrieval Only (`StructuralRetriever`)**:
   - Parses ASTs using Tree-Sitter adapters across Java, Python, JavaScript, and TypeScript.
   - Extracts symbol identifiers, signatures, line spans, docstrings, and call-graph relationships.
   - Ranks candidates using BM25-style lexical matching, identifier decomposition, and scope boosting.
2. **B2: Historical Retrieval Only (`HistoricalRetrievalAdapter`)**:
   - Reads Git commit history using `GitHistoryReader` (merge-aware, topo-ordered DAG traversal up to `searchHorizon=50` commits).
   - Tracks symbol lineage across commits (rename, extraction, movement, modification) via `FunctionMatcher` and multi-tier heuristics.
   - Computes historical relevance based on matched predecessor names, commit messages, and diff tokens with candidate-pool parity.
3. **B3: Linear Fusion (0.60 Structural / 0.40 Historical)**:
   - Evaluates weighted linear combination with active-channel normalization.
4. **B4: Reciprocal Rank Fusion v2 (`RRF-v2`)**:
   - Uses zero-signal gating and channel-balanced Cormack RRF ($k=60$, balanced weights $0.50/0.50$).

---

## 3. Evaluation Harness & Test Suite Status

- **Unit & Regression Suites:** 19 test suites, 157 passing tests (`npm test`).
- **Evaluator Harness:** `RetrospectEvaluator` implements a standardized 3-stage evaluation:
  - **Stage A (Reachability):** Validates origin commit in DAG, distance $\\le$ search horizon (50 commits), and historical evidence presence.
  - **Stage B (Detection):** Assesses predecessor detection, classification (`RENAMED_SYMBOL`, `EXTRACTED_METHOD`, `EXACT_PREDECESSOR`), and ambiguity flags.
  - **Stage C (Ranking):** Measures Success@1, Success@5, Success@10, MRR, and Abstention across B1, B2, B3, and B4.
  - **Cluster Bootstrap:** Origin-commit cluster-level resampling (1,000 resamples, 95% CIs) to account for cluster correlation.

---

## 4. Authentic Repository Fleet in `D:\\clones`

A fleet of 27 cloned open-source repositories is physically available on disk with genuine commit histories:
- **Java (9 repos):** `checkstyle`, `datastax-java-driver`, `graphhopper`, `guava`, `jfinal`, `robovm`, `sonarqube`, `spring-boot`, `undertow`.
- **Python (6 repos):** `black`, `fastapi`, `httpx`, `marshmallow`, `pytest`, `requests`.
- **JavaScript (6 repos):** `axios`, `jest`, `koa`, `lodash`, `mocha`, `moment`.
- **TypeScript (6 repos):** `quasar`, `rxjs`, `svelte`, `typeorm`, `vue`, `zod`.

---

## 5. Available Empirical Evidence for Dataset Construction

1. **Mined Java Refactorings (`D:\\base papers considered\\Test creation\\mined_refactorings`):**
   - `checkstyle.json`: 335 commits, 697 refactorings (Move Class, Rename Method, Extract Variable, etc.).
   - `datastax.json`: 243 commits, 964 refactorings (Pull Up Method, Change Parameter Type, etc.).
   - `graphhopper.json`: 227 commits, 1,255 refactorings (Rename Method, Extract Method, Move Class, etc.).
   - `undertow.json`: 66 commits, 628 refactorings (Change Parameter Type, Method modifications, etc.).
2. **Release Event Inventories (`D:\\base papers considered\\Test creation\\reports\\events_*.json`):**
   - High-confidence changelog and release note transformations with exact quoted lines and commit diffs for Python (`httpx`, `pytest`, `requests`, `fastapi`, `black`), JavaScript (`mocha`, `moment`, `lodash`), TypeScript (`vue`, `zod`, `svelte`, `typeorm`, `jest`), and Java (`checkstyle`, `datastax`, `graphhopper`, `guava`, `undertow`).
3. **Prior Verified Benchmarks:**
   - 45 authentic verified cases across 15 snapshots established in `final_multirepo_evaluation_merge_aware_2026-10-20`.

---

## 6. What Can Be Reused vs. What Must Be Added

### Reusable Assets:
- Core retrieval pipelines (`StructuralRetriever`, `HistoricalRetrievalAdapter`, `RRFv2`).
- Evaluator engine (`RetrospectEvaluator`, `ClusterBootstrap`).
- Ground-truth target verification routines.
- Pre-cloned repositories in `D:\\clones` and release event catalogs.

### What Must Be Added:
1. **Unified Ground-Truth Schema & Manifest:** Supporting all fields specified in Section 7 of the research protocol (target_set, historical_targets, transformation, lineage_cluster_id, history_distance_commits, distractor_symbols, verification_status).
2. **Category-Partitioned Directory Structure:** Clean separation of categories A through I with independent READMEs and `cases.jsonl`.
3. **Automated Validation Script:** `validation/validate_dataset.js` checking unique IDs, commit DAG existence, file existence at pin, distractor presence, line ranges, and lineage cluster consistency.
4. **Comprehensive Evaluation Harness:** Integration with Retrospect evaluator outputting raw rankings, aggregate metrics, historical rescue rates, fusion regression rates, and failure classifications.
5. **Stage-by-Stage Execution:** Pilot construction (12-15 cases) $\\to$ Pilot evaluation $\\to$ Scaled dataset construction ($\\ge 100$ target) $\\to$ Full evaluation and paper-ready reporting.

---

## 7. Strict Preservation Commitments
- Zero changes to retrieval algorithms, ranking formulas, fusion weights, or FunctionMatcher thresholds.
- Zero modification to existing experiment artifacts or prior evaluation outputs.
- Purely forward-compatible dataset authoring and evaluation.
"""

target_path = r"D:\base papers considered\Test creation\datasets\retrospect_historical_rescue_v1\reconnaissance_report.md"
with open(target_path, "w", encoding="utf-8") as f:
    f.write(report_content)
print(f"Written: {target_path}")
