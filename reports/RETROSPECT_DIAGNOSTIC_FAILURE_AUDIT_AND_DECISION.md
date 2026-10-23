# Retrospect Diagnostic Failure Audit & Next-Experiment Decision Report

**Project:** Retrospect: Evolution-Aware Context Retrieval for Repository-Level LLMs  
**Audit Date:** 2026-10-19  
**Target Codebase Commit:** `17ea399217737f8d5fe2c32c310b69c2f812b84d`  
**Evaluation Workspace:** `D:/base papers considered/Test creation`  
**Cloned Repositories Root:** `D:/clones`  
**Diagnostic Evaluation Reference:** `results/current_version_diagnostic_2026-10-19/`  
**Status:** Mandatory Stop/Go Decision — **OUTCOME B (STOP EXPERIMENTATION & ADDRESS DATA/EVALUATION INTEGRITY)**

---

## 1. Executive Decision

### **DECISION: OUTCOME B — STOP EXPERIMENTAL RUNS; PRIORITIZE EVALUATION INTEGRITY & BENCHMARK ADJUDICATION**

Based on a forensic, evidence-based audit of the raw benchmark outputs, underlying data files, validation script logs, and mathematical fusion properties, **further benchmark experimentation is halted at this time**. 

Running additional retrieval runs under the current state would be scientifically invalid and counter-productive for four decisive reasons:
1. **Benchmark Schema Invalidity:** The current provisional benchmark dataset (`datasets/custom/historical-symbol-retrieval/data/historical-cases.json`, comprising all 29 Category B cases) fails schema validation on **100% of its records** (32/32 items fail against `retrieval-case.schema.json` with 666 schema violations).
2. **Synthetic Data Contamination:** Several prototype benchmark cases in `structural-cases.json` (cases 0005 through 0017) contain synthetic, copy-pasted placeholder commit SHAs that do not exist in authentic Git history (e.g., Requests' commit `147c8511` pasted into Moment; Flask's commit `735a4701` pasted into Fastify).
3. **Denominator Underpowered on Verified Cases ($N=5$):** Only 5 verified pilot cases are currently executable on authentic Git DAGs. At $N=5$, a single case movement changes Recall@10 by $\pm 20.0\%$, and minor tie-breaking shifts alter MRR by $\pm 0.014$, making any comparative claim statistically fragile.
4. **Unsubstantiated Superiority Claims for B4 (RRF-v2):** The narrative claim in the diagnostic report that B4 is "strictly superior overall" is contradicted by the actual data. In Category B ($N=29$), **Configuration B3 (Combined Linear) outperforms B4 on every metric** (B3 MRR $0.1893$ vs B4 $0.1708$; Recall@5 $31.0\%$ vs $27.6\%$; Recall@10 $58.6\%$ vs $55.2\%$). Furthermore, B1 (Structural Only) achieves higher Recall@10 ($58.6\%$) than B4 ($55.2\%$).

**Immediate Research Priority:** Focus on benchmark schema normalization, ground-truth adjudication of Category B cases, and architectural indexing optimization (inverted index postings lists and file-following Git traversal) before any algorithmic tuning or additional benchmark runs are conducted.

---

## 2. Evidence Integrity Audit

### 2.1 Numerical Contradictions Resolved

#### Issue A: Structural-Only (B1) MRR Discrepancy ($0.2529$ vs $0.267$)
* **Reported Contradiction:** Table 3.1 reports B1 MRR as `0.2529`, while Section 7 reports `0.267`.
* **Root Cause Identified:** This is a **stale transcription discrepancy** between the dynamically generated metric table (which computed metrics over the full diagnostic run) and static text carried over from an earlier exploratory test script (`scratch/test_all_verified.js`).
* **Evidence:** In the latest full run across the 5 verified pilot cases:
  * `CASE-STRUCT-JAVA-001` (Guava): Rank 117 $\to \text{RR} = 1/117 \approx 0.008547$
  * `CASE-STRUCT-PY-002` (Requests): Rank 2 $\to \text{RR} = 1/2 = 0.500000$
  * `CASE-STRUCT-TS-004` (Zod): Rank 2 $\to \text{RR} = 1/2 = 0.500000$
  * `CASE-HIST-JAVA-001` (Checkstyle): Rank 168 $\to \text{RR} = 1/168 \approx 0.005952$
  * `CASE-HIST-JAVA-002` (Guava): Rank 4 $\to \text{RR} = 1/4 = 0.250000$
  $$\text{Mean MRR} = \frac{0.008547 + 0.5 + 0.5 + 0.005952 + 0.25}{5} = \frac{1.264499}{5} = \mathbf{0.2528998 \approx 0.2529}$$
  In the earlier exploratory run, `CASE-HIST-JAVA-002` happened to be ranked at **Rank 3** (due to candidate-pool truncation to 50 items):
  $$\text{Exploratory MRR} = \frac{0.008547 + 0.5 + 0.5 + 0.005952 + 0.333333}{5} = \frac{1.334499}{5} = \mathbf{0.2669 \approx 0.267}$$
* **Correct Verified Value:** **`0.2529`** (derived from the complete, un-truncated repository candidate evaluation).

---

#### Issue B: Contradictory Case Ranks on Guava `CollectPreconditions.checkNonnegative`
* **Reported Contradiction:**
  * Setting 1 (Table 3.1 & Case Table 4): B1 = Rank 4, B3 = Rank 45, B4 = Rank 15.
  * Setting 2 (Narrative Section 5.3): B1 = Rank 3, B3 = Rank 24, B4 = Rank 9.
* **Root Cause Identified:** The discrepancy stems directly from **candidate pool evaluation boundaries**:
  * In the earlier script (`scratch/test_all_verified.js`), `UnifiedSearch.search` was called with `limit: 50`. Candidates were truncated before cross-channel fusion, which bounded the pool of competing candidates and placed the target at Rank 3 (B1), Rank 24 (B3), and Rank 9 (B4).
  * In the comprehensive diagnostic harness (`scratch/run_full_diagnostic.js`), fusion was evaluated across **all 66,297 symbols** in the Guava repository without truncation. Furthermore, identical method signatures exist across `android/guava/` and `guava/` with identical scores ($0.19999$). Under alphabetical tie-breaking by symbol ID, the `android/guava` sibling placed at Rank 4, and zero-signal linear dilution ($0.60 \times 0.20 + 0.40 \times 0 = 0.12$) allowed 44 candidates to surpass it across the full 66k symbol set, landing it at Rank 45.
* **Correct Verified Value:** Under exhaustive full-repository evaluation without artificial truncation: **B1 = 4, B3 = 45, B4 = 15**.

---

#### Issue C: Audit of Claims Regarding B4's (RRF-v2) Superiority
* **Reported Claim:** Section 7 ranks Configuration B4 as Rank 1 and claims it is "strictly superior overall," citing "Highest Recall@10 (60.0% on verified cases)."
* **Empirical Reality from Machine-Readable Data (`aggregate_metrics.csv`):**
  1. **Verified Cases ($N=5$):**
     * B1 Recall@10 = **60.0%** (3/5)
     * B4 Recall@10 = **40.0%** (2/5)  $\leftarrow$ *The report's narrative claim of 60.0% for B4 was factually erroneous.*
     * Both B3 and B4 dropped `CASE-HIST-JAVA-002` out of the top 10 (B3 dropped to Rank 45; B4 dropped to Rank 15). Neither achieved 60% Recall@10.
  2. **Provisional Diagnostic Cases ($N=29$):**
     * **B3 (Combined Linear) beats B4 on every single metric:**
       * MRR: B3 **0.1893** vs B4 **0.1708** (+0.0185 for Linear)
       * Recall@5: B3 **31.0%** (9/29) vs B4 **27.6%** (8/29) (+1 case for Linear)
       * Recall@10: B3 **58.6%** (17/29) vs B4 **55.2%** (16/29) (+1 case for Linear)
       * B1 (Structural Only) also beats B4 on Recall@10 (**58.6%** vs **55.2%**).
* **Mathematical Cause:** In RRF-v2, asymmetric weighting ($w_s=0.60, w_h=0.40, k=60$) creates a hard mathematical cap on purely historical matches:
  $$\text{Max Score}_{\text{HistOnly}} = \frac{0.40}{60 + 1} = 0.006557$$
  Any candidate with a structural rank $r_s \le 31$ receives:
  $$\text{Score}_{\text{Struct}} \ge \frac{0.60}{60 + 31} = 0.006593 > 0.006557$$
  Consequently, **the top 31 purely structural candidates will always outrank even a Rank 1 historical target** when that target has zero structural score. In `CASE-HIST-JAVA-0013` (Checkstyle), historical retrieval found the target at **Rank 2**, but structural retrieval had score 0. B3 Linear preserved the target at **Rank 2**, whereas B4 RRF collapsed the target to **Rank 43**!
* **Conclusion:** The claim that B4 is strictly superior is **empirically and theoretically refuted**.

---

#### Issue D: Latency Measurements Reconciliation
* **Reported Contradiction:** Table 3.1 reports B1 mean latency as `4610.4 ms`, whereas Section 7 asserts "sub-20-ms per query once indexed."
* **Evidence:** Per-case inspection of B1 latency in `case_results.csv`:
  * `requests` (677 symbols): **73 ms**
  * `zod` (1,022 symbols): **85 ms**
  * `checkstyle` (34,878 symbols): **811 ms**
  * `guava` (66,297 symbols): **11,318 ms** (`CASE-STRUCT-001`) and **10,765 ms** (`CASE-HIST-002`)
* **Explanation:**
  * Retrospect currently performs an un-indexed, in-memory linear array scan over all symbols in `StructuralRetriever.rankCandidates`. In large repositories like Guava (66k symbols), evaluating AST token overlap and BM25 scoring for every symbol takes ~11 seconds.
  * The "sub-20-ms" claim was observed exclusively during score fusion (B3/B4 combining pre-computed arrays) or in small repositories, but does **not** reflect query-time structural search in real-world codebases.

---

### 2.2 Metric Definitions & Evaluation Implementation Audit

Inspection of `run_full_diagnostic.js` confirms the exact formulas used:

| Metric | Implementation Definition | Handling of Missing / Abstaining Cases |
| :--- | :--- | :--- |
| **Recall@K** | $\frac{1}{N} \sum_{i=1}^N \mathbb{I}(\text{Rank}_i \le K)$ | Unretrieved targets ($\text{Rank} = \text{null}$) contribute $0$. Evaluated against all eligible cases $N$. |
| **MRR** | $\frac{1}{N} \sum_{i=1}^N \frac{1}{\text{Rank}_i}$ | Unretrieved targets contribute $0.0$ to the sum; denominator is full $N$. |
| **Success@10** | Equivalent to $\text{Recall@10}$ | Redundant in this implementation ($\text{Success@10} \equiv \text{Recall@10}$). |
| **Abstention Rate** | $\frac{1}{N} \sum_{i=1}^N \mathbb{I}(\text{Score}_i == 0.0000)$ | Measures proportion of queries where the channel provided zero relevance signal. |
| **Failure Rate** | $\frac{1}{N} \sum_{i=1}^N \mathbb{I}(\text{Rank}_i > 10 \lor \text{Rank}_i == \text{null})$ | Directly measures failure to locate the target within the LLM's top-10 context window. |
| **Timing Boundary** | `Date.now() - t0` around `retriever.rankCandidates` | Measures query-time scoring and ranking across candidates; excludes repository checkout and AST/Git indexing time. |

---

### 2.3 Dataset Validation & Benchmark Split Audit

#### 1. Schema Validation Audit (`validate_schemas.py`, Exit Code 1)
* **Finding:** 175 files examined, resulting in **666 schema validation errors**.
* **Critical Discovery:** The errors do **not** merely affect obsolete prototype files; they directly invalidate the primary Category B input file:
  `datasets/custom/historical-symbol-retrieval/data/historical-cases.json`
  * Missing required field: `hard_negatives` (violates `retrieval-case.schema.json`).
  * Invalid query type: `historical_symbol` is not an allowed enum in the schema.
  * Invalid authoring method: `refactoring_miner_oracle` is not an allowed enum.
  * Missing required target field: `symbol_id`.
  * Invalid change type: `rename_method` is used instead of the schema-defined `rename`.
  * Incomplete prediction object: missing `structural_prediction`, `historical_prediction`, `combined_prediction`, and `rationale`.
* **Impact:** Category B benchmark data was imported directly from raw RefactoringMiner mining runs without passing schema adjudication.

#### 2. Cross-Split Commit-SHA Collision Audit (`audit_benchmark_splits.py`, Exit Code 0)
* **Reported Collision:** SHA `147c8511ddbfa5e8f71bbf5c18ede0c4ceb3bba4` shared between `dev` (`CASE-STRUCT-PY-002`, `psf/requests`) and `test_confirmatory` (`CASE-STRUCT-JA-0012`, `moment/moment`).
* **Forensic Finding:**
  * In `psf/requests`, commit `147c8511` is an authentic release commit (`v2.31.0`).
  * In `moment/moment`, attempting to inspect the commit via `git cat-file -e 147c8511` yields `fatal: Needed a single revision`. **The commit does not exist in Moment's Git DAG.**
  * Further inspection of `structural-cases.json` revealed widespread **copy-paste placeholder recycling** across prototype cases:
    * Flask (`0005`) and Fastify (`0011`) share `735a4701...`
    * Requests (`0002`) and Moment (`0012`) share `147c8511...`
    * Black (`0008`) and Jest (`0013`) share `cf29e624...`
    * FastAPI (`0007`) and Vue (`0016`) share `b549e338...`
    * Prisma (`0015`) and Svelte (`0017`) share `d041ab82...`
* **Verdict:** The collision is **not data leakage** (no shared code or weights), but evidence of **unadjudicated synthetic placeholder data** in `structural-cases.json`. `audit_benchmark_splits.py` exited with code 0 because it was designed as an informational auditor, not an assertion-gated test.

---

## 3. Recomputed Empirical Metrics

### 3.1 Category A: Verified Pilot Cases ($N=5$)

*Denominator = 5 eligible cases (Express.js excluded under DEC-12; not cloned).*

| Configuration | Recall@1 | Recall@5 | Recall@10 | MRR | Abstention Rate | Retrieval Failure Rate | Mean Latency (ms) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **B1 (Structural Only)** | 0.0% (0/5) | **60.0%** (3/5) | **60.0%** (3/5) | 0.2529 | 0.0% (0/5) | **40.0%** (2/5) | 4,610.4 ms |
| **B2 (Historical Only)** | 0.0% (0/5) | 20.0% (1/5) | 20.0% (1/5) | 0.1000 | 80.0% (4/5) | 80.0% (4/5) | 182.2 ms |
| **B3 (Combined Linear)** | **20.0%** (1/5) | 40.0% (2/5) | 40.0% (2/5) | 0.3065 | 0.0% (0/5) | 60.0% (3/5) | **123.0 ms** |
| **B4 (Combined RRF-v2)** | **20.0%** (1/5) | 40.0% (2/5) | 40.0% (2/5) | **0.3153** | 0.0% (0/5) | 60.0% (3/5) | 212.6 ms |

*Detailed Verified Case Ranks:*
* `CASE-STRUCT-JAVA-001` (Guava): B1=117, B2=unretrieved, B3=161, B4=181
* `CASE-STRUCT-PY-002` (Requests): B1=2, B2=2, **B3=1**, **B4=1** *(Both fusions elevate target to #1)*
* `CASE-STRUCT-TS-004` (Zod): B1=2, B2=unretrieved, **B3=2**, **B4=2**
* `CASE-HIST-JAVA-001` (Checkstyle): B1=168, B2=unretrieved, B3=235, B4=235
* `CASE-HIST-JAVA-002` (Guava): **B1=4**, B2=unretrieved, B3=45, B4=15 *(Linear dilution drops target out of top 10)*

---

### 3.2 Category B: Provisional Diagnostic Cases ($N=29$)

*Denominator = 29 provisional refactoring queries across 4 pinned Java repositories.*

| Configuration | Recall@1 | Recall@5 | Recall@10 | MRR | Abstention Rate | Retrieval Failure Rate | Mean Latency (ms) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **B1 (Structural Only)** | 3.5% (1/29) | 24.1% (7/29) | **58.6%** (17/29) | 0.1750 | 13.8% (4/29) | **41.4%** (12/29) | 681.7 ms |
| **B2 (Historical Only)** | 3.5% (1/29) | 24.1% (7/29) | 24.1% (7/29) | 0.1110 | 62.1% (18/29) | 75.9% (22/29) | 91.7 ms |
| **B3 (Combined Linear)** | **3.5%** (1/29) | **31.0%** (9/29) | **58.6%** (17/29) | **0.1893** | **10.3%** (3/29) | **41.4%** (12/29) | **51.2 ms** |
| **B4 (Combined RRF-v2)** | 3.5% (1/29) | 27.6% (8/29) | 55.2% (16/29) | 0.1708 | 10.3% (3/29) | 44.8% (13/29) | 63.3 ms |

---

## 4. Failure Mode Analysis

The 34 evaluated cases were analyzed to classify the concrete mechanism responsible for each failure:

```
+---------------------------------------------------------------------------------------------------+
|                                  RETROSPECT FAILURE CLASSIFICATION                               |
+---------------------------------------------------------------------------------------------------+
|  Mode 1: Multi-Module Sibling Shadowing (Guava, Zod)                                              |
|  Mode 2: Historical Horizon Exceeded (Checkstyle, Datastax, Undertow)                             |
|  Mode 3: Asymmetric Fusion Failure (Linear Dilution in B3 vs Historical Suppression in B4)        |
|  Mode 4: Query Lexical Gap on Behavioral Descriptions                                             |
+---------------------------------------------------------------------------------------------------+
```

### Detailed Case Examination

| Case ID | Status | Repository | Target Symbol | B1 / B2 / B3 / B4 Rank | Primary Failure Mechanism | Evidence & Confidence |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| `CASE-STRUCT-JAVA-001` | Verified | `google/guava` | `ImmutableList.builder` | 117 / NR / 161 / 181 | **Multi-Module Sibling Shadowing** | Structural AST tokens match dozens of identical `builder()` stubs in `android/guava` and `guava-gwt`. *Confidence: High.* |
| `CASE-HIST-JAVA-001` | Verified | `checkstyle` | `Violation.getLineNo` | 168 / NR / 235 / 235 | **Historical Horizon Exceeded** | Rename from `LocalizedMessage` occurred >50 commits prior to release tag; adapter yielded score 0. *Confidence: High.* |
| `CASE-HIST-JAVA-002` | Verified | `google/guava` | `CollectPreconditions.checkNonnegative` | 4 / NR / 45 / 15 | **Destructive Linear Dilution (B3)** | Zero historical score multiplied structural score by 0.60 ($0.1200$), dropping target from #4 to #45. *Confidence: High.* |
| `CASE-HIST-JAVA-0013` | Provisional | `checkstyle` | `DetailAstImpl.setComment` | NR / 2 / 2 / 43 | **RRF Historical Suppression (B4)** | Target has strong historical signal (#2) but zero structural score. B4 asymmetric weights cap historical score below top 31 structural items. *Confidence: High.* |
| `CASE-HIST-JAVA-0035` | Provisional | `java-driver` | `Dispatcher.channelRead0` | NR / NR / NR / NR | **Historical Traversal Depth Exceeded** | Refactoring commit not within 50 commits of trunk pin. Target completely unindexed. *Confidence: High.* |
| `CASE-HIST-JAVA-0078` | Provisional | `graphhopper` | `FlagEncoder.isTurnRestricted` | 3 / NR / 10 / 23 | **Linear Dilution & RRF Gating Penalty** | Strong structural rank (#3) degraded by zero historical channel in both B3 (#10) and B4 (#23). *Confidence: High.* |
| `CASE-HIST-JAVA-0099` | Provisional | `graphhopper` | `Graph.getEdgeIteratorState` | 57 / 2 / 4 / 9 | **Fusion Success** | Both B3 (#4) and B4 (#9) successfully rescue a poorly ranked structural candidate using strong historical signal (#2). *Confidence: High.* |

---

## 5. Research Implications: Supported Findings vs. Hypotheses

### What the Existing Evidence Firmly Supports
1. **Multi-Modal Synergistic Elevation is Real:** When both structural and historical channels detect a target (e.g., Requests `CASE-STRUCT-PY-002` and GraphHopper `CASE-HIST-JAVA-0096`), fusion reliably elevates the target above single-channel baselines (advancing from Rank 2 to Rank 1).
2. **Historical Retrieval Rescues Structurally Obscured Symbols:** When historical evidence is detected within the 50-commit horizon, it can rescue targets with weak structural scores (e.g., advancing GraphHopper `CASE-0099` from Rank 57 to Rank 4).
3. **Rigid History Horizons Cripple Historical Retrieval:** A fixed 50-commit backward window results in a **62%–80% abstention rate**, failing whenever refactorings span across release cycles.
4. **Neither Linear Combination nor RRF-v2 is Universally Optimal:**
   - Linear combination (B3) suffers from destructive dilution when the historical channel abstains.
   - RRF-v2 (B4) suffers from historical suppression when the structural channel abstains, due to asymmetric weighting ($w_s=0.60, w_h=0.40$).

### Hypotheses That Cannot Be Supported Without Further Adjudication
1. *Claim: "RRF-v2 is the superior overall fusion mechanism."* **Refuted by Category B empirical data**, where B3 beats B4 on MRR, Recall@5, and Recall@10.
2. *Claim: "Retrospect provides sub-20ms query latency."* **Refuted by large-repository scans**, where un-indexed symbol scans take 10+ seconds on Guava.
3. *Claim: "Category B proves multi-language generalization."* **Unsubstantiated**, because Category B consists 100% of Java cases derived from RefactoringMiner, and all 29 cases currently fail schema validation.

---

## 6. Actionable Next Steps (Prioritized Roadmap)

Before any new benchmark runs or algorithm modifications are attempted, the research engineering priorities must be executed in this order:

### Priority 1: Benchmark Schema Normalization & Split Integrity Repair
* **Action:** Update `scripts/validate_schemas.py` and normalize `datasets/custom/historical-symbol-retrieval/data/historical-cases.json` to ensure 100% schema compliance.
* **Action:** Purge synthetic copy-paste placeholder SHAs from `structural-cases.json` (cases 0005–0017) and replace them with authentic, checked-out repository release commits.

### Priority 2: Ground-Truth Adjudication of Category B Cases
* **Action:** Execute an automated compiler test harness (Maven/Gradle) on the 29 provisional Java cases to verify that target methods, line ranges, and refactoring origins compile cleanly and represent true answerable tasks.
* **Goal:** Promote 20–25 verified cases into Category A to expand the verified denominator from $N=5$ to $N \ge 25$.

### Priority 3: Architectural Retrieval Fixes (Prior to Algorithmic Tuning)
* **Action (Index Scalability):** Replace the linear array scan in `StructuralRetriever.rankCandidates` with an inverted index (token postings list) to reduce Guava query latency from 11,000 ms to <50 ms.
* **Action (Historical Horizon):** Replace the fixed 50-commit repository-wide traversal with target-specific `git log --follow -n 100 -- <file>` tracing to resolve the 62%–80% historical abstention rate.

---

## 7. Reproducibility Appendix

* **Target Codebase Commit:** `17ea399217737f8d5fe2c32c310b69c2f812b84d`
* **Node.js Environment:** v22.17.1 (win32 x64)
* **Execution Commands & Exit Codes:**
  * `python scripts/validate_schemas.py` $\to$ Exit Code: `1` (175 files checked, 666 schema errors)
  * `python scripts/verify_existing_datasets.py` $\to$ Exit Code: `0` (4 external oracles verified)
  * `python scripts/audit_benchmark_splits.py` $\to$ Exit Code: `0` (436 cases audited, 1 cross-split collision detected)
  * `node scratch/run_full_diagnostic.js` $\to$ Exit Code: `0` (34 cases evaluated, all CSVs/JSONs generated)
* **Primary Output Paths:**
  * Aggregate Metrics: [`aggregate_metrics.csv`](file:///D:/base%20papers%20considered/Test%20creation/results/current_version_diagnostic_2026-10-19/aggregate_metrics.csv)
  * Case Results: [`case_results.csv`](file:///D:/base%20papers%20considered/Test%20creation/results/current_version_diagnostic_2026-10-19/case_results.csv)
  * Failure Analysis: [`failure_analysis.csv`](file:///D:/base%20papers%20considered/Test%20creation/results/current_version_diagnostic_2026-10-19/failure_analysis.csv)
  * Excluded Cases: [`excluded_cases.csv`](file:///D:/base%20papers%20considered/Test%20creation/results/current_version_diagnostic_2026-10-19/excluded_cases.csv)
  * Raw Case Outputs: [`raw_results/`](file:///D:/base%20papers%20considered/Test%20creation/results/current_version_diagnostic_2026-10-19/raw_results/)
  * Validation Logs: [`validation_logs/`](file:///D:/base%20papers%20considered/Test%20creation/results/current_version_diagnostic_2026-10-19/validation_logs/)

---

## Executive Decision Summary (5 Key Points)

1. **Stop Benchmark Runs (Outcome B):** Further benchmarking is halted because benchmark inputs currently suffer from 100% schema validation failure on Category B records and synthetic commit SHA recycling in prototype cards.
2. **Reconciled Verified Pilot Metrics:** The true verified B1 MRR is **`0.2529`** (not `0.267`), and Guava ranks are **B1: 4, B3: 45, B4: 15** under exhaustive whole-repository evaluation across 66,297 symbols.
3. **Refuted Claims of B4 Superiority:** In the 29 provisional cases, **B3 Linear outperforms B4 RRF across all metrics** (MRR $0.1893$ vs $0.1708$; Recall@10 $58.6\%$ vs $55.2\%$), and B1 Structural alone beats B4 on Recall@10.
4. **Identified Core Failure Bottlenecks:** Historical retrieval suffers 62%–80% abstention due to a rigid 50-commit horizon; structural retrieval suffers 11-second delays due to un-indexed array scans; and B4 mathematically suppresses historical-only targets below the top 31 structural items.
5. **Clear Immediate Action:** Prioritize benchmark schema normalization, ground-truth adjudication to expand verified cases beyond $N=5$, and inverted indexing before attempting any retrieval algorithm modifications.
