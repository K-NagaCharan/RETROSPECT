# Retrospect — Evidence & Dataset Inventory

**Branch:** \`eval-reframing-empirical-study\`  
**Dataset Workspace:** \`D:\\base papers considered\\Test creation\`  
**Date:** 2026-10-20  
**Evaluator Status:** RECONCILED & AUDITED

---

## 1. Executive Summary & Audit Mandate

To establish a defensible empirical evaluation, this inventory audits all existing datasets, diagnostics, and experiment outputs across \`Retrospect\` and \`Test creation\`. In accordance with empirical software engineering standards:
- **No benchmark cases are selected based on whether Retrospect succeeds.**
- **No legacy synthetic cases with hallucinated Git hashes are accepted.**
- **Heterogeneous cohorts are decoupled into distinct analysis strata.**
- **Ground truth is established independently of retrieval rankings via Git commits, AST diffs, and RefactoringMiner traces.**

---

## 2. Comprehensive Dataset Census

### Table 1: Inventory of Evaluated and Background Datasets

| Dataset ID | Family | Languages | Target Repositories | Total Cases | Usable / Eligible | Excluded | Provenance & Evidence Basis | Adjudication & Evaluation Role |
|---|---|---|---|---:|---:|---:|---|---|
| **\`category-b-repaired\`** | Historical Symbol Retrieval | Java | \`checkstyle\`, \`graphhopper\`, \`undertow\`, \`datastax-java-driver\` | 29 | **29** | 0 | RefactoringMiner oracle + AST hard negatives extracted via \`javalang\`. 100% schema compliant. | **Stratified:**<br>• 5 In-Policy Primary ($k \le 50$)<br>• 20 Distance Diagnostic ($k > 50$)<br>• 4 Quarantined Negatives (Cat D) |
| **\`historical-pilot-v1\`** | Cross-Language Retrieval | Python, JS, TS | \`httpx\`, \`pytest\`, \`marshmallow\`, \`moment\`, \`mocha\`, \`vue\`, \`rxjs\`, \`lodash\` | 12 | **11** | 1 | Real Git commits and refactoring events with curated natural language queries. | **Cross-Language Exploratory:**<br>11 cases with verified Git pins in clones; 1 case (\`CASE-HIST-JS-004\` lodash) excluded due to missing pin in local DAG. |
| **\`verified-pilot-v1\`** | Verified Anchor Cases | Java, Python, TS | \`guava\`, \`requests\`, \`zod\`, \`checkstyle\` | 5 | **5** | 0 | Hand-verified ground-truth symbols in authentic clones. | **Controls & Anchors:**<br>• 3 Category C Current-Code Controls<br>• 2 Historical Pilot Anchors |
| **\`legacy-custom-structural\`** | Synthetic Structural | Java, Python, JS, TS | 18 catalog repos | 17 | 3 | **14** | Synthetic prototype catalog from early project iterations. | **EXCLUDED:** 14 cases contained synthetic commit hashes not in Git DAGs. (3 verified cases promoted to \`verified-pilot-v1\`). |
| **\`legacy-custom-refactoring\`** | Unauthored AST Traces | Java | \`checkstyle\`, \`junit5\`, \`trpc\` | 42 | 0 | **42** | Raw RefactoringMiner commits with diff tokens. | **EXCLUDED:** Lacks authored natural-language queries. Cannot be evaluated as retrieval benchmarks. |
| **\`legacy-custom-negatives\`** | Confounder Mining | Java, Python, JS, TS | 23 catalog repos | 100 | 0 | **100** | Synthetic negative candidates mined automatically. | **EXCLUDED:** 100% failed referential integrity against cloned repository fleet. |

---

## 3. Cohort Stratification & Epistemic Roles

A critical finding of the October 20 audit was that pooling all 45 evaluated cases into a single composite metric ($N = 45$) corrupted the evaluation. Under the reframed research question, cases are classified into 5 distinct analytical cohorts:

```
+---------------------------------------------------------------------------------------------------+
|                                 RECONCILED EVALUATION COHORTS (N = 45)                            |
+---------------------------------------------------------------------------------------------------+
| 1. Primary In-Policy Refactorings (N = 5, M = 5 clusters)                                         |
|    - Target: Obsolete/refactored methods within H = 50 topological search window                  |
|    - Role: Primary estimand population to answer EQ1 (historical rescue vs structural blindness) |
+---------------------------------------------------------------------------------------------------+
| 2. Category C: Current-Code Controls (N = 3, M = 3 clusters)                                      |
|    - Target: Unmodified contemporary symbols (requests, zod, guava)                               |
|    - Role: Secondary control population to answer EQ4 (rank dilution on contemporary code)        |
+---------------------------------------------------------------------------------------------------+
| 3. Category D: Quarantined Negatives (N = 4, M = 4 clusters)                                      |
|    - Target: Non-lineage distractors / unanswerable queries in Undertow and Datastax              |
|    - Role: Secondary control population to answer EQ7 (safe abstention vs false positives)       |
+---------------------------------------------------------------------------------------------------+
| 4. Distance-Stratified Diagnostic (N = 20, M = 13 clusters)                                       |
|    - Target: Refactorings with origin distance k between 52 and 637 commits                       |
|    - Role: Empirical boundary diagnostic to answer EQ4 (historical search horizon decay)          |
+---------------------------------------------------------------------------------------------------+
| 5. Cross-Language Exploratory Pilots (N = 11, M = 11 clusters)                                    |
|    - Target: Python (4), JavaScript (3), TypeScript (4) refactoring cases                         |
|    - Role: Exploratory feasibility check for multi-language AST/Git traversal                      |
+---------------------------------------------------------------------------------------------------+
| 6. Historical Pilot Anchors (N = 2, M = 2 clusters)                                               |
|    - Target: Single-commit historical events (Checkstyle, Guava; dist = 0)                         |
|    - Role: Boundary anchors                                                                       |
+---------------------------------------------------------------------------------------------------+
```

---

## 4. Query Leakage & Circularity Audit

Every query in the evaluated suite was audited for leakage against its ground-truth target:

1. **Obsolete Identifier-Assisted Queries (Category A):**  
   - Explicitly query using the obsolete or predecessor name (e.g., *"Locate current implementation corresponding to historical method shouldStartToken in RightCurlyCheck"*).
   - **Legitimate Use Case:** Represents developer migrating legacy code or reading historical stack traces.
   - Evaluated to test whether Retrospect can trace the name through Git diffs forward to the modern symbol.
2. **Behavioral / Natural Language Queries (Category B):**  
   - Describe function behavior without mentioning the historical identifier (e.g., *"Pipeable operator that switches to next observable sequence when current stream completes or emits an error"*).
   - Evaluated to test semantic match against commit messages and diff tokens.
3. **No Ground-Truth Leakage in Metadata:**  
   - Audits confirmed that \`audit_notes\`, schema annotations, and evaluation labels are completely stripped from query payloads, ensuring zero leakage into retrieval scorers.

---

## 5. Artifact Usability Ledger

| Artifact / Report Path | Status | Usability Recommendation |
|---|:---:|---|
| [\`D:\base papers considered\Test creation\results\category_b_benchmark_repair_2026-10-19\category_b_repaired.json\`](file:///D:/base%20papers%20considered/Test%20creation/results/category_b_benchmark_repair_2026-10-19/category_b_repaired.json) | **Verified** | Authoritative dataset for 29 Category B cases with AST hard negatives. Fully schema-compliant. |
| [\`D:\base papers considered\Test creation\experiments\final_multirepo_evaluation_audit_2026-10-20\case_reconciliation.csv\`](file:///D:/base%20papers%20considered/Test%20creation/experiments/final_multirepo_evaluation_audit_2026-10-20/case_reconciliation.csv) | **Verified** | Authoritative per-case reconciliation table mapping all 46 cases to their verified cohorts and topological depths. |
| [\`D:\base papers considered\Test creation\experiments\final_multirepo_evaluation_audit_2026-10-20\corrected_per_case_results.csv\`](file:///D:/base%20papers%20considered/Test%20creation/experiments/final_multirepo_evaluation_audit_2026-10-20/corrected_per_case_results.csv) | **Verified** | Verified per-case retrieval outputs across B1, B2, B3, B4. |
| [\`D:\base papers considered\Test creation\experiments\historical_retrieval_diagnostic_v3_merge_aware_2026-10-20\`](file:///D:/base%20papers%20considered/Test%20creation/experiments/historical_retrieval_diagnostic_v3_merge_aware_2026-10-20) | **Diagnostic Only** | Bounded 9-case diagnostic. Illustrates merge-aware behavior; not usable as standalone proof. |
| [\`D:\base papers considered\Test creation\datasets\custom\historical-symbol-retrieval\data\historical-cases.json\`](file:///D:/base%20papers%20considered/Test%20creation/datasets/custom/historical-symbol-retrieval/data/historical-cases.json) | **Legacy / Defective** | Superseded by \`category_b_repaired.json\`. Contained 261 schema errors and lacked hard negatives. |
| Raw unauthored datasets (\`legacy-custom-refactoring\`, \`legacy-custom-negatives\`) | **Invalid / Excluded** | Excluded from primary and secondary benchmarks. |
