> Applies to the 2026-10-19 evaluator-preparation phase (Category-B cases read by `src/evaluation/BenchmarkCaseLoader.js`). The 2026-10-21 four-language benchmark and the external benchmark use their own case files; see [DOCS_INDEX.md](DOCS_INDEX.md).

# Retrospect Rebuilt Benchmark Schema Specification

**Version:** 2.0 (Git-First Benchmark)  
**Date:** 2026-10-19  
**Status:** Canonical Benchmark Specification  

---

## 1. Specification Overview

This document specifies the canonical case schema for the rebuilt, Git-first benchmark for Retrospect. The schema decouples the benchmark from legacy Retrospect-internal naming conventions, enforces precise target definition, supports stratified query-leakage analysis, and integrates explicit split protection.

---

## 2. Benchmark Case Schema

Each case in the benchmark must conform to the following JSON structure:

```json
{
  "case_id": "CASE-HIST-0001",
  "repo": "google/guava",
  "pin_sha": "db74bd2fdac443223d45e6fc5c66548542be1081",
  "query": "Check that integer index is non-negative and throw appropriate exception",
  "target": {
    "file_path": "guava/src/com/google/common/collect/CollectPreconditions.java",
    "symbol_name": "CollectPreconditions.checkNonnegative",
    "parameter_types": ["int", "String"],
    "line_span": [37, 43]
  },
  "decoys": [
    {
      "file_path": "guava/src/com/google/common/collect/CollectPreconditions.java",
      "symbol_name": "CollectPreconditions.checkPositive",
      "distractor_type": "same_file_adjacent",
      "distractor_rationale": "Sibling validation method in same utility class verifying positive rather than non-negative condition."
    }
  ],
  "category": "historical_evolution",
  "language": "Java",
  "origin_commit": "5de36fdaf4f95d13dae72a4401c1f77649d21226",
  "commit_distance_origin_to_pin": 4149,
  "contains_historical_identifier": false,
  "split": "val"
}
```

---

## 3. Field Definitions & Requirements

### Core Identity & Location
- **`case_id` (string, optional for internal execution, recommended):**  
  A stable external identifier provided by the benchmark dataset for logging and traceability. The evaluator **must not** require any specific internal naming pattern or prefix.
- **`repo` (string, required):**  
  The canonical repository slug matching local clone directories (e.g. `"google/guava"`, `"datastax/java-driver"`, `"checkstyle/checkstyle"`).
- **`pin_sha` (string, required):**  
  A 40-character hexadecimal Git commit hash representing the exact repository snapshot against which evaluation is performed.

### Query
- **`query` (string, required):**  
  The natural language or behavioral developer query submitted to the retrieval pipeline (minimum length: 5 characters).
- **`contains_historical_identifier` (boolean, required):**  
  Declares whether the query explicitly contains the historical function or class identifier. Used for stratified evaluation to detect and isolate lexical identifier leakage.

### Target Specification
- **`target` (object, required):**
  - **`file_path` (string, required):** Relative file path from the repository root to the target source file at `pin_sha`.
  - **`symbol_name` (string, required):** The fully qualified or enclosing-class-scoped symbol name (e.g. `"CollectPreconditions.checkNonnegative"`).
  - **`parameter_types` (array of strings, optional/recommended):** Exact argument types (e.g. `["int", "String"]`) to disambiguate overloaded methods.
  - **`line_span` (array of 2 integers, required):** `[start_line, end_line]` (1-indexed, inclusive) defining the exact span of the target definition.

### Distractor Model
- **`decoys` (array of objects, required):**  
  One or more verified hard negative distractors. Each decoy must define:
  - `file_path` (string, required)
  - `symbol_name` (string, required)
  - `distractor_type` (string, enum: `"same_file_adjacent"`, `"structural_sibling"`, `"lexical_distractor"`, `"unrelated_reused_name"`)
  - `distractor_rationale` (string, required)

### Evolutionary Provenance
- **`category` (string, required):**  
  The functional category of the retrieval case (e.g. `"historical_evolution"`, `"structural_search"`, `"api_migration"`).
- **`language` (string, required):**  
  Target programming language: `"Java"`, `"Python"`, `"JavaScript"`, or `"TypeScript"`.
- **`origin_commit` (string, nullable):**  
  40-character hexadecimal Git commit hash representing the true historical refactoring or birth commit where the lineage event occurred. Set to `null` for pure structural cases.
- **`commit_distance_origin_to_pin` (integer, nullable):**  
  Topological Git commit distance from `origin_commit` to `pin_sha` (`git rev-list --count origin..pin`). Used for stratified horizon analysis.

### Split Protection
- **`split` (string, required):**  
  One of `"dev"`, `"val"`, or `"test_confirmatory"`.  
  Cases with `"test_confirmatory"` are strictly sealed and **must be rejected** by standard diagnostic evaluator runs unless explicit confirmation flags are provided.

---

## 4. Normalization and Legacy Compatibility Mapping

When ingesting cases from existing intermediate schemas (such as `retrieval-case.schema.json`), the case loader applies deterministic normalization:

| Canonical Field | Intermediate / Legacy Field | Normalization Rule |
|---|---|---|
| `repo` | `repository_id` | Direct string assignment. |
| `pin_sha` | `source_revision_sha` | Direct string assignment. |
| `query` | `query.query_text` or `query` | If object, extracts `.query_text`; if string, takes value directly. |
| `target.file_path` | `target_symbols[0].file_path` | Extracts from first target symbol. |
| `target.symbol_name` | `target_symbols[0].symbol_name` | Extracts from first target symbol. |
| `target.line_span` | `target_symbols[0].line_range` | Maps 2-element array. |
| `decoys` | `hard_negatives` | Maps list, converting `negative_type` -> `distractor_type`. |
| `origin_commit` | `historical_evidence.origin_commit_sha` | Extracts SHA if present; otherwise `null`. |
| `contains_historical_identifier` | `contains_historical_identifier` | Boolean check; defaults to `false` if missing. |
| `split` | `split` or metadata tag | Strict validation against allowed partitions. |

---

## 5. Separation of Structural Validation vs. Lineage Adjudication

The evaluation system strictly distinguishes two levels of case validity:

1. **Structural & Repository Validity (Evaluator Level):**
   - Repository clone exists and is readable.
   - `pin_sha` exists in the local Git DAG (`git cat-file -e`).
   - `target.file_path` exists at `pin_sha`.
   - `target.symbol_name` can be located in `target.file_path` within `line_span`.
   - Decoy symbols exist and are callable.
   - *A case passing this check is syntactically executable by the evaluator.*
2. **Semantic Lineage Adjudication (Ground-Truth Level):**
   - Independent verification that `origin_commit` represents a causal transformation from predecessor to successor.
   - Verification that the query reflects genuine developer intent without semantic drift.
   - *This check requires human domain sign-off and cannot be established by automated code execution or AST parsing alone.*
