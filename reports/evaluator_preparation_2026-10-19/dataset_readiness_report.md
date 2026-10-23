# Dataset Readiness Report: Rebuilt Git-First Retrospect Benchmark

**Date:** 2026-10-19  
**Audit Target:** Rebuilt Git-First Retrospect Benchmark & Dataset Workspace  
**Frozen Implementation Commit:** `17ea399217737f8d5fe2c32c310b69c2f812b84d`  
**Dataset Workspace:** `D:\base papers considered\Test creation\`  
**Clones Workspace:** `D:\clones\`  
**Case-Level Validation Audit:** 465 cases audited ([case_level_validation.csv](file:///d:/base%20papers%20considered/Retrospect/reports/evaluator_preparation_2026-10-19/case_level_validation.csv))  
**Harness Status:** Loader and Evaluator Ready; B1–B4 Execution Blocked

---

## 1. Executive Summary & Readiness Verdicts

This report provides an exhaustive, evidence-based audit of the Retrospect benchmark dataset workspace. The audit evaluates repository availability, commit pin authenticity, target file presence, parameter specifications, line span validity, decoy distractor plausibility, semantic lineage adjudication, lexical query leakage, split isolation, and schema conformance against the canonical `BenchmarkCaseLoader`.

### Core Verdict

```text
========================================================================================
                               FINAL READINESS VERDICT
========================================================================================

1. FULL MULTI-LANGUAGE BENCHMARK (Java, Python, JavaScript, TypeScript):
   --> VERDICT: C. NOT READY — GROUND-TRUTH OR METHODOLOGICAL DEFECTS REMAIN

   Rationale:
   - 100% of cases in the validation split (val: 107 cases) and held-out confirmatory
     split (test_confirmatory: 75 cases) fail Git DAG verification, target file presence,
     or belong to uncloned legacy catalog manifests.
   - Python, JavaScript, and TypeScript fail to meet minimum candidate floors (Shortfalls:
     Python -4 in B, -2 in D; JS -3 in B, -3 in D; TS -3 in B, -1 in D).
   - 127 authentic events were mined in reports/events_*.json, but they remain raw Git
     change events and have NOT yet been authored into benchmark cards (queries, decoys).

2. BOUNDED EXPLORATORY JAVA DIAGNOSTIC (Category B Repaired Subset):
   --> VERDICT: B. PARTIALLY READY — SPECIFIC FIXES REQUIRED

   Rationale:
   - The 29 repaired Category B Java cases (category_b_repaired.json) pass authentic
     Git commit pin verification (29/29), target file presence (29/29), and hard-negative
     AST validation (58/58).
   - Specific Fixes Required before exploratory runs:
     a) 0 of 29 cases have undergone independent human semantic adjudication.
     b) 20 of 29 cases have origin commit distance > 50 (up to 637 commits), exceeding
        the default lookback horizon. Only 9 cases reside within the 50-commit horizon.
     c) Lexical query leakage must be formally reported via stratified metrics.
========================================================================================
```

### High-Level Case & Event Census

| Metric Category | Count | Percentage | Description |
| :--- | :---: | :---: | :--- |
| **Total Audited Cases in CSV** | **465** | 100.0% | Complete inventory of split cases (436) and repaired Category B cases (29). |
| **Eligible Diagnostic Candidates** | **33** | 7.1% | 29 repaired Category B cases + 4 verified pilot cases in `D:/clones`. |
| **Provisional Cases (Query Leakage)** | **5** | 1.1% | Authentic Git pins and files, but query explicitly names target symbol. |
| **Excluded: Uncloned Repositories** | **192** | 41.3% | Cases referencing catalog manifests never cloned to `D:/clones`. |
| **Excluded: Target File Absent at Pin** | **215** | 46.2% | Target file does not exist in repository Git tree at commit pin. |
| **Excluded: Invalid Commit Pin SHA** | **20** | 4.3% | Pinned SHA does not exist anywhere in authentic repository Git history. |
| **Mined Git-First Candidates** | **127** | N/A | Raw `accepted_candidate` events in `reports/events_*.json` awaiting card authoring. |

---

## 2. Dataset and Repository Collection by Language

### 2.1 Authentic Cloned Fleet (`D:\clones\`)

A fleet of **23 open-source repository tracks** is physically cloned in `D:\clones\` with complete Git commit DAGs and authoritative commit pins recorded in `reports/pins_v2.json`:

```
D:\clones\
├── Java (6 tracks):
│   ├── checkstyle/checkstyle   [pin: 10a3a0777ced10983ebe6266c998957c10dba8f0 (tag: checkstyle-8.42)]
│   ├── datastax-java-driver    [pin: f4240267b3a3b829fa51242441dd219424a91347 (tag: 2.1.7)]
│   ├── graphhopper             [pin: c7497d1100a4f05ddf5cc630692cbe8046b98114 (tag: 0.5.0)]
│   ├── undertow                [pin: cf3abec9145bb4660659add41b97866ff6ef9c31 (tag: 1.3.0.CR1)]
│   ├── guava                   [pin: c1088508ddc78bd60d096d2cc3ceef4a82ec909d (tag: v32.1.3)]
│   └── spring-boot             [pin: 97a71be9b8e2cf4b2fe0625896975865d6a8fdab (tag: v2.0.0.RELEASE)]
├── Python (6 repos):
│   ├── requests                [pin: 147c8511ddbfa5e8f71bbf5c18ede0c4ceb3bba4 (tag: v2.31.0)]
│   ├── httpx                   [pin: 26d48e0634e6ee9cdc0533996db289ce4b430177 (tag: 0.28.1)]
│   ├── fastapi                 [pin: 40e33e492dbf4af6172997f4e3238a32e56cbe26 (tag: 0.115.0)]
│   ├── black                   [pin: 1b2427a2b785cc4aac97c19bb4b9a0de063f9547 (tag: 24.10.0)]
│   ├── pytest                  [pin: d0f136fe64f9374f18a04562305b178fb380d1ec (tag: 8.3.3)]
│   └── marshmallow             [pin: 6b9c970ea45377041ca02a6435ca0a1ba6fb59fa (tag: 3.22.0)]
├── JavaScript (6 repos):
│   ├── koa                     [pin: 769fd75cc6b30d72493b370b5a3ae2332ca03c5b (tag: 2.15.3)]
│   ├── moment                  [pin: 000ac1800e620f770f4eb31b5ae908f6167b0ab2 (tag: 2.29.4)]
│   ├── mocha                   [pin: d5766c887e72b1bb55d5efeac33b1cadd0544b84 (tag: v10.7.3)]
│   ├── axios                   [pin: acae140c88319f39031ef6f3dbda545925a62d7c (tag: v1.7.7)]
│   ├── jest                    [pin: 2c2a0da1b8e4e7e63b65e998eb82f40e0cf44927 (tag: v29.7.0)]
│   └── lodash                  [pin: 2da342327b70f11b5e336e129f9333337942385b (tag: 4.17.21)]
└── TypeScript (5 repos):
    ├── zod                     [pin: ae4c632e8f81395b0583b6f2ef4c540da4d82531 (tag: v3.23.8)]
    ├── vue                     [pin: 011bc9178ad3a620d43321487f5d96a77ffc2aa5 (tag: v3.5.12)]
    ├── svelte                  [pin: 7f2ee0572e09ff7b1ec31dbdb4fc5d381c817ee6 (tag: svelte@4.2.19)]
    ├── rxjs                    [pin: 72bc92191ab959e27a969dc4476e14d95416573f (tag: 7.8.1)]
    └── typeorm                 [pin: 2b9308e04b4d6199a0e68e4bf7e9973e8a75e01b (tag: 0.3.20)]
```

### 2.2 External Reference Datasets

| Dataset | Size on Disk | Acquired Content | Missing / Not Present | Intended Role |
| :--- | :---: | :--- | :--- | :--- |
| **`refactoring-miner-corpus`** | 7.07 MB | 15,756 refactorings across 550 commits (11,675 True Positives, 2,829 False Positives). | 189 source repositories are NOT cloned (only 4 Java target repos are cloned). | Oracle seed for method renames, moves, and extractions. |
| **`bigclonebench`** | 1.82 MB | 96,016 test pairs (13,237 clones, 82,779 non-clones). | Full IJaDataset-2.0 source code (25,000 systems) not cloned. | Calibrating structural retrieval against Type-4 semantic clones. |
| **`codesearchnet`** | 2.5 KB | 99 human-annotated challenge queries with relevance labels. | Full 20+ GB multi-language corpus not acquired. | Natural language behavioral query intent calibration. |
| **`codexglue-code-search`** | 1.6 KB | 2 sample schema records and task definition schemas. | Full CodeXGLUE evaluation code search corpus not acquired. | Reference task schema for neural retrieval comparisons. |

### 2.3 Legacy Catalog Manifests (`repository-catalog/`)
The repository catalog contains **146 JSON metadata manifests**. An audit reveals that these 146 manifests contain only **39 unique commit SHAs** because early catalog generation recycled synthetic SHA strings across unrelated repositories. None of these 146 manifests were cloned locally, leading directly to the 192 `EXCLUDED_UNCLONED_REPO` exclusions in the legacy splits.

---

## 3. Case Accounting: Created, Accepted, Rejected, and Pending

### 3.1 Git-First Candidate Mining Funnel

```mermaid
flowchart TD
    A["Raw Candidates Mined (235)"] --> B["Git-First Pipeline Filter (AST Proof & Git Grep)"]
    B -->|Passed (127 events)| C["Accepted Candidate Events (reports/events_*.json)"]
    B -->|Failed (108)| D["Rejected Candidates (Changelog drops, missing diffs)"]
    C --> E["Post-Capping Pool (47 events)<br/>Max 3/commit, Max 8/repo"]
    C --> F["Capped Out (76 events)"]
    E --> G["Pending Card Authoring (47 events)<br/>Query authoring, decoy pairing, split assignment"]
```

- **Mined Candidates Examined:** 235 candidates
- **Accepted Candidate Events:** 127 events (`accepted_candidate` in `reports/events_*.json`)
- **Post-Capping Pool:** 47 events across 23 repositories
- **Capped Out (Ceiling Exceeded):** 76 events
- **Pending:** All 47 post-capping events are currently raw change records and have **not yet been compiled into benchmark cases**.

### 3.2 Legacy Case Census across Splits (`benchmarks/splits/`)

| Partition | Total Cases | Verified at Pin | Target File Present | Template Spans `[100, 120]` | Leaky Queries | Eligible Diagnostic Cases |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **`dev`** | 254 | 224 | 9 | 128 | 123 | **4** |
| **`val`** | 107 | 0 | 0 | 41 | 36 | **0** |
| **`test_confirmatory`** | 75 | 0 | 0 | 25 | 61 | **0** |
| **Total Legacy Splits** | **436** | **224 (51.4%)** | **9 (2.1%)** | **194 (44.5%)** | **220 (50.5%)** | **4 (0.9%)** |

### 3.3 Repaired Category B Benchmark (`category_b_repaired.json`)
- **Total Cases:** 29 cases (Java exclusive)
- **Authentic Git Commit Pins:** 29 (100%)
- **Target Files Present at Pin:** 29 (100%)
- **Verified Hard Negative Decoys:** 29 (100%, 58 total decoys)
- **Authentic AST Line Spans:** 29 (100%, 0 template spans)
- **Queries Leaking Current Identifier:** 0 (0%)
- **Human Semantic Adjudication:** 0 (0%)

---

## 4. Distinct Origin Commits & Category Floors

Refactorings sharing an origin commit are not statistically independent. The table below presents the empirical cluster count of distinct origin commits across languages and categories:

| Language | Category / Track | Target Floor | Actual Distinct Commits | Empirical Status |
| :--- | :--- | :---: | :---: | :--- |
| **Java** | Track B (Rename) | 5 | **16** | **Meets Target (+11)** |
| **Java** | Track D (Removal / Negative) | 4 | **2** | **Shortfall (-2)** |
| **Java** | Track C (Move Method) | 5 | **3** | **Shortfall (-2)** |
| **Java** | Track A (Structural Pilot) | 3 | **1** | **Shortfall (-2)** |
| **Python** | Track B (Rename) | 5 | **1** | **Shortfall (-4)** |
| **Python** | Track D (Removal / Negative) | 4 | **2** | **Shortfall (-2)** |
| **Python** | Track A (Structural Pilot) | 3 | **1** | **Shortfall (-2)** |
| **JavaScript** | Track B (Rename) | 5 | **2** | **Shortfall (-3)** |
| **JavaScript** | Track D (Removal / Negative) | 4 | **1** | **Shortfall (-3)** |
| **JavaScript** | Track A (Structural Pilot) | 3 | **1** | **Shortfall (-2)** |
| **TypeScript** | Track B (Rename) | 5 | **2** | **Shortfall (-3)** |
| **TypeScript** | Track D (Removal / Negative) | 4 | **3** | **Shortfall (-1)** |
| **TypeScript** | Track A (Structural Pilot) | 3 | **1** | **Shortfall (-2)** |

### Distinct Origin Commits in Repaired Category B (18 Clusters across 4 Repositories):
- `graphhopper/graphhopper`: 5 origin commits (`88806c24...`, `665d95e8...`, `fc1a4e64...`, `b188c14d...`, `fa819d4b...`)
- `checkstyle/checkstyle`: 6 origin commits (`7514329e...`, `c4bc16b8...`, `71b26ea8...`, `9c9b1393...`, `5051458d...`, `9708915b...`)
- `datastax/java-driver`: 3 origin commits (`948a3130...`, `0b9c02ff...`, `59600d3d...`)
- `undertow-io/undertow`: 4 origin commits (`b612130e...`, `763c323f...`, `08b530cb...`, `941bb5d2...`)

---

## 5. Target Completeness & Integrity Audit

Each case must provide a valid repository, pinned snapshot, origin commit, target file, target symbol, parameter types, and authentic line span:

| Field | Category B Repaired (29) | Legacy Splits (436) | Assessment |
| :--- | :---: | :---: | :--- |
| **`repo`** | 29 / 29 (100%) | 436 / 436 (100%) | Fully specified in both. |
| **`pin_sha` (Git Verified)** | 29 / 29 (100%) | 224 / 436 (51.4%) | 212 legacy cases fail Git verification. |
| **`origin_commit` (Git Verified)**| 29 / 29 (100%) | 67 / 436 (15.4%) | Most legacy cases lack authentic origin commits. |
| **`target.file_path` (Verified at Pin)**| 29 / 29 (100%) | 9 / 436 (2.1%) | 427 legacy cases reference non-existent files at pin. |
| **`target.symbol_name`** | 29 / 29 (100%) | 195 / 436 (44.7%) | 241 legacy cases omit target symbols (unanswerable/broken). |
| **`target.parameter_types`** | 0 / 29 (0%) | 0 / 436 (0%) | **Defect:** Neither legacy nor repaired cases define parameter types. |
| **`target.line_span` (Authentic)** | 29 / 29 (100%) | 67 / 436 (15.4%) | 194 legacy cases contain template `[100, 120]`. |

---

## 6. Predecessor/Successor Evidence & Semantic Adjudication

> [!CAUTION]
> **Git-DAG existence is NOT semantic ground truth.**  
> A commit diff showing a line deletion and addition proves that text changed in Git; it does not prove that an LLM query targeting the predecessor's historical functionality should semantically retrieve the successor method.

### Lineage Adjudication Census

| Dataset Track | Evaluated Cases | Git Diffs & Commits Verified | Independent Human Adjudication | Status |
| :--- | :---: | :---: | :---: | :--- |
| **Category B Repaired** | 29 | 29 (100%) | **0 (0%)** | `PARTIALLY_VERIFIED` (Human sign-off pending) |
| **Dataset A (Structural Pilot)**| 4 | 4 (100%) | **4 (100%)** | `VERIFIED` |
| **Legacy Custom Splits** | 436 | 9 (2.1%) | **0 (0%)** | `FAILED_REFERENTIAL` / `PROVISIONAL` |
| **Mined Events (`events_*.json`)**| 127 | 127 (100%) | **0 (0%)** | `ACCEPTED_CANDIDATE` (Raw events only) |

### Review Roadmap for Category B (29 Cases):
1. **Tier 1 (Immediate Diagnostic Candidates — 9 Cases within 50 commits):**
   - `CASE-HIST-JAVA-0105` (`PrepareRoutingSubnetworks.markNodesRemovedIfUnreachable`, Graphhopper, dist=40)
   - `CASE-HIST-JAVA-0020` (`Violation.getCustomViolation`, Checkstyle, dist=36)
   - `CASE-HIST-JAVA-0047` (`WebSocket07FrameSinkChannel.sendInternal`, Undertow, dist=40)
   - `CASE-HIST-JAVA-0005` (`WhitespaceAroundCheck.isEmptyCtorBlockCheckedFromRcurly`, Checkstyle, dist=47)
   - `CASE-HIST-JAVA-0019` (`Violation.getViolation`, Checkstyle, dist=36)
   - `CASE-HIST-JAVA-0013` (`AbstractCheck.getViolations`, Checkstyle, dist=36)
   - `CASE-HIST-JAVA-0048` (`LimitedBufferSlicePool.PooledByteBuffer.getBuffer`, Undertow, dist=23)
   - `CASE-HIST-JAVA-0050` (`ReferenceCountedPooled.createView.new.close`, Undertow, dist=23)
   - `CASE-HIST-JAVA-0049` (`ReferenceCountedPooled.getBuffer`, Undertow, dist=23)
2. **Tier 2 (Horizon Exceeded — 20 Cases > 50 commits):**
   - Require historical deep-lookback ($k \ge 700$ commits) in addition to human semantic review.

---

## 7. Query Leakage Analysis

When an evaluation query contains the target's current or predecessor identifier, retrieval models achieve trivial lexical matches, creating severe evaluation confounds:

| Dataset Partition | Total Cases | Query Contains Current Symbol | Query Contains Historical Symbol | Purely Behavioral Queries | Leakage Rate |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Category B Repaired** | 29 | **0** | **0** | **29** | **0.0% (Clean)** |
| **Structural (Dataset A)** | 17 | **10** | **0** | **7** | **58.8%** |
| **`dev` Split** | 254 | **123** | **0** | **131** | **48.4%** |
| **`val` Split** | 107 | **36** | **0** | **71** | **33.6%** |
| **`test_confirmatory` Split** | 75 | **61** | **0** | **14** | **81.3%** |

In `test_confirmatory`, **81.3% of queries leak the exact symbol name** (e.g. querying `"Find function executeAction in MyClass"`). This explains why earlier structural retrieval baselines appeared artificially competitive and proves that legacy splits cannot serve as confirmatory test evidence.

---

## 8. Decoy / Hard Negative Distractor Integrity

- **Category B Repaired (58 Decoys):**
  - **100% (58/58)** verified as callable methods via AST parsing in checked-out working trees.
  - **100%** confirmed distinct from target symbols.
  - **48 same-file adjacent** distractors sharing class tokens; **10 structural sibling** distractors in related pipeline classes.
  - **Zero hallucinated symbols.**
- **Legacy Files (`historical-cases.json`):**
  - 100% of cases in original Dataset B had **0 decoys**, making distractor discrimination impossible to measure.
- **Legacy Splits (`benchmarks/splits/`):**
  - Decoys were mechanically templated with 1 distractor per case, but 215 cases point to non-existent files.

---

## 9. Repository Pins, Commit Distances, and Split Discipline

1. **Repository Pins:**
   - The 23 repository pins in `reports/pins_v2.json` are dereferenced Git tags verified via `git rev-parse <tag>^{commit}`.
   - The 146 manifests in `repository-catalog/` use 39 recycled synthetic SHAs and fail verification.
2. **Commit Distances:**
   - In `category_b_repaired.json`, commit distances were calculated via `git rev-list --count origin..pin`. 9 cases have distance $\le 50$; 20 cases have distance $> 50$ (up to 637).
3. **Cross-Split Isolation:**
   - **Repository Overlaps:** 0 between `dev`, `val`, and `test_confirmatory`.
   - **Lineage Event Overlaps:** 0 cross-split overlaps.
   - **SHA Collision:** **1 cross-split collision** detected: `psf/requests` (`dev` via `CASE-STRUCT-PY-002`) and `moment/moment` (`test_confirmatory` via `CASE-STRUCT-JA-0012`) both share synthetic SHA `147c8511ddbfa5e8f71bbf5c18ede0c4ceb3bba4`.

---

## 10. Conformance to Evaluator Schema & Loader Audit

Testing the benchmark datasets directly with `BenchmarkCaseLoader` without silent coercion produced the following results:

```
========================================================================================
                     BENCHMARK CASE LOADER VALIDATION AUDIT
========================================================================================
Dataset Source                      Examined   Valid   Excluded  Primary Exclusion Cause
----------------------------------------------------------------------------------------
Category B Repaired                       29      24          5  datastax slug mapping*
Historical Cases (Dataset B orig)         32       0         32  Empty decoys array (0/32)
Structural Cases (Dataset A)              17       3         14  Uncloned repos (express, etc)
Dev Split Cases                          254       7        247  Uncloned repos & missing files
Val Split Cases                          107       0        107  Invalid pin SHAs in Git DAG
Confirmatory Split Cases (dry run)        75       0         75  Invalid pin SHAs in Git DAG
========================================================================================
* Fixed in resolver via alias 'datastax/java-driver' -> 'datastax-java-driver' (29/29 valid).
```

Zero malformed cases were silently repaired. The loader enforced strict validation, recording all rejections in structured exclusion logs.

---

## 11. Unresolved Defects and Exclusions

| Defect ID | Severity | Scope | Description | Required Remediation |
| :--- | :---: | :--- | :--- | :--- |
| **DEF-01** | **BLOCKER** | Confirmatory Split | 75/75 cases in `test_confirmatory` fail Git DAG verification or referential file checks. | Confirmatory benchmarking strictly prohibited until rebuilt dataset is finalized. |
| **DEF-02** | **BLOCKER** | Multi-Language Floors | Python, JS, and TS have real candidate shortfalls across Tracks B and D. | Complete candidate card authoring for mined events in `reports/events_*.json`. |
| **DEF-03** | **CRITICAL** | Semantic Ground Truth | 0 of 29 Category B cases have completed independent human semantic review. | Execute blinded human adjudication across the 29 cases (prioritizing the 9 Tier-1 cases). |
| **DEF-04** | **CRITICAL** | Query Leakage | 220 of 436 legacy split cases contain the exact current symbol identifier in the query text. | Re-author queries using purely behavioral/functional descriptions without identifier tokens. |
| **DEF-05** | **HIGH** | Parameter Types | 0 cases define `parameter_types`, preventing overload resolution testing in Java/TypeScript. | Extract Tree-Sitter parameter type signatures into canonical `target.parameter_types`. |
| **DEF-06** | **HIGH** | Historical Horizon | 20 of 29 Category B cases exceed the 50-commit lookback horizon (distances 52 to 637). | Decouple lookback horizon evaluation or expand default budget with `--follow`. |
| **DEF-07** | **MEDIUM** | Cross-Split SHA Collision | `requests` (`dev`) and `moment` (`test_confirmatory`) share recycled SHA `147c8511...`. | Dereference authentic tag pin for `moment/moment` (`000ac180...`). |

---

## 12. Deliverable Artifacts Summary

All generated validation artifacts have been saved in the Retrospect repository and mirrored to the Test creation results workspace:

1. **Readiness Report:** [dataset_readiness_report.md](file:///d:/base%20papers%20considered/Retrospect/reports/evaluator_preparation_2026-10-19/dataset_readiness_report.md)  
   *(Mirrored: `D:/base papers considered/Test creation/results/evaluator_preparation_2026-10-19/dataset_readiness_report.md`)*
2. **Case-Level Validation CSV (465 rows):** [case_level_validation.csv](file:///d:/base%20papers%20considered/Retrospect/reports/evaluator_preparation_2026-10-19/case_level_validation.csv)  
   *(Mirrored: `D:/base papers considered/Test creation/results/evaluator_preparation_2026-10-19/case_level_validation.csv`)*
3. **Loader Validation Report:** [loader_validation_report.md](file:///d:/base%20papers%20considered/Retrospect/reports/evaluator_preparation_2026-10-19/loader_validation_report.md)
4. **Benchmark Schema Spec v2.0:** [benchmark_schema_specification.md](file:///d:/base%20papers%20considered/Retrospect/docs/benchmark_schema_specification.md)
5. **Standardized Latency Boundary:** [latency_measurement_boundary.md](file:///d:/base%20papers%20considered/Retrospect/docs/latency_measurement_boundary.md)
6. **Per-Case Result Schema:** [per_case_result_schema.md](file:///d:/base%20papers%20considered/Retrospect/docs/per_case_result_schema.md) & [evaluation-result.schema.json](file:///d:/base%20papers%20considered/Retrospect/schemas/evaluation-result.schema.json)
7. **Legacy Results Notice:** [LEGACY_RESULTS_NOTICE.md](file:///d:/base%20papers%20considered/Retrospect/reports/LEGACY_RESULTS_NOTICE.md)

---

## 13. Operational Next Steps

1. **Do not run confirmatory evaluation:** Confirmatory evaluation on `test_confirmatory` must remain blocked until the rebuilt dataset is delivered, human-adjudicated, and sealed.
2. **Permissible Development Diagnostic:** If exploratory diagnostic profiling is desired during evaluator debugging, it must be strictly confined to:
   - The **9 Tier-1 Category B cases** within the 50-commit lookback horizon.
   - The **4 verified pilot cases** in Guava, Requests, and Zod.
   - With explicit reporting that numbers are exploratory diagnostic indicators, not performance claims.
