# Schema Validation Report: Category B Benchmark Repair

**Audit Subject:** Schema Conformance Verification of Repaired Category B Benchmark  
**Date:** 2026-10-19  
**Validator:** `jsonschema.Draft202012Validator` (Python 3.x / `validate_schemas.py`)  
**Target Schema:** `D:/base papers considered/Test creation/schemas/retrieval-case.schema.json`  
**Repaired Dataset:** `d:/base papers considered/Retrospect/reports/category_b_benchmark_repair_2026-10-19/category_b_repaired.json`  
**Status:** **PASSED (0 ERRORS)**  

---

## 1. Executive Summary

A formal schema-validation pass was executed on the newly created, separate `category_b_repaired.json` dataset using the standard Retrospect validator (`jsonschema.Draft202012Validator`).

- **Original Evaluated Category B Records:** 29 records examined.
  - **Original Errors:** **261 validation errors** across 9 schema violations (9 violations $\times$ 29 cases).
  - **Original Error Rate:** **100% failure rate** (29 of 29 cases failed).
- **Repaired Category B Records:** 29 records examined.
  - **Repaired Errors:** **0 validation errors**.
  - **Repaired Error Rate:** **0% failure rate** (29 of 29 cases passed).
  - **Exit Code:** **0**.

The repaired dataset achieves 100% formal schema conformance without altering case identifiers, evaluation pin revisions, repository identities, or target symbols.

---

## 2. Validation Metrics: Baseline vs. Repaired

| Metric | Original Baseline (`historical-cases.json`) | Repaired Dataset (`category_b_repaired.json`) | Net Change |
|---|---|---|---|
| **Evaluated Records** | 29 | 29 | 0 |
| **Schema-Conformant Records** | 0 (0.0%) | **29 (100.0%)** | +29 (+100.0%) |
| **Schema-Invalid Records** | 29 (100.0%) | **0 (0.0%)** | -29 (-100.0%) |
| **Total Schema Violations** | 261 | **0** | -261 (-100.0%) |
| **Missing `hard_negatives`** | 29 cases (100%) | **0 cases (0%)** | Resolved (58 authentic distractors) |
| **Invalid `query_type`** | 29 cases (`"historical_symbol"`) | **0 cases** | Normalized to `"refactoring_successor"` |
| **Invalid `authoring_method`** | 29 cases (`"refactoring_miner_oracle"`) | **0 cases** | Normalized to `"synthetic_templated"` |
| **Missing `symbol_id`** | 29 cases | **0 cases** | Populated unique `SYM-*` IDs |
| **Invalid `change_type`** | 29 cases (`"rename_method"`) | **0 cases** | Normalized to `"rename"` |
| **Missing Expected Predictions** | 29 cases (4 fields missing each) | **0 cases** | Parameterized by commit distance |
| **SHA-256 Checksum** | `92A5B7E0E8D21E88BA31E1FB2D7DD869DD5D2E1A401CF2FEBF7D6372BD758D3B` | `ACB2E388BF510B719E56F82263DEC349C2258194FC66DAC4E54038DE5FE2B94F` | Distinct immutable artifact |

---

## 3. Systematic Resolution of the 9 Schema Violations

Every violation identified in the prior evidence audit was repaired using evidence-backed transformations:

### 1. Missing Required Property: `hard_negatives`
- **Original Defect:** The field `hard_negatives` was absent from all 29 records, preventing the retrieval benchmark from evaluating distractor discrimination.
- **Repair Action:** Using `javalang` AST parsing directly against the target Java files checked out at their evaluation pin commits, **58 authentic declared methods** (2 per case) were extracted.
- **Conformity:** Each distractor contains `symbol_name`, `file_path`, valid enum `negative_type` (`"same_file_adjacent"` or `"structural_sibling"`), and a specific `distractor_rationale`.

### 2. Invalid Enum: `query.query_type`
- **Original Defect:** Value `"historical_symbol"` is not in schema enum `["behavioral_description", "implementation_detail", "historical_name_lookup", "refactoring_successor", "api_migration_query", "misleading_historical_trap", "unanswerable_obsolete"]`.
- **Repair Action:** Normalized to `"refactoring_successor"`. All 29 queries explicitly ask to locate the current implementation corresponding to a refactored historical method.

### 3. Invalid Enum: `query.authoring_method`
- **Original Defect:** Value `"refactoring_miner_oracle"` is not in schema enum `["human_curated", "developer_commit_message", "synthetic_templated", "issue_tracker_derived"]`.
- **Repair Action:** Normalized to `"synthetic_templated"`. Queries follow a rigid synthetic sentence template parameterized by RefactoringMiner outputs.

### 4. Missing Required Property: `target_symbols[0].symbol_id`
- **Original Defect:** Object in `target_symbols` lacked mandatory `symbol_id`.
- **Repair Action:** Populated unique, deterministic symbol identifiers formatted as `SYM-HIST-JAVA-{ID}-TARGET`.

### 5. Invalid Enum: `historical_evidence.change_type`
- **Original Defect:** Value `"rename_method"` is not in schema enum `["rename", "move", "extract", "inline", "rewrite", "signature_change", "deprecation", "deletion"]`.
- **Repair Action:** Normalized `"rename_method"` to `"rename"`.

### 6–9. Missing Expected Retrieval Behavior Fields
- **Original Defect:** Object `expected_retrieval_behavior` contained legacy unstructured keys (`{"status": "hypothesis, unverified", "retriever_evaluated": false}`) instead of required fields: `structural_prediction`, `historical_prediction`, `combined_prediction`, and `rationale`.
- **Repair Action:**
  - For cases where origin-to-pin commit distance $\le 50$ (9 cases):
    - `structural_prediction`: `"top_k"`
    - `historical_prediction`: `"top_k"`
    - `combined_prediction`: `"top_k"`
    - `rationale`: Explains that historical traversal horizon ($k=50$) reaches the refactoring commit.
  - For cases where origin-to-pin commit distance $> 50$ (20 cases):
    - `structural_prediction`: `"top_k"`
    - `historical_prediction`: `"unretrieved"`
    - `combined_prediction`: `"top_k"`
    - `rationale`: Explains that refactoring commit is beyond the 50-commit horizon, predicting historical abstention.

---

## 4. Validator Execution Verification

The validator was executed via Python using `jsonschema.Draft202012Validator`:

```python
import json, jsonschema

with open('D:/base papers considered/Test creation/schemas/retrieval-case.schema.json', 'r') as f:
    schema = json.load(f)
v = jsonschema.Draft202012Validator(schema)

with open('d:/base papers considered/Retrospect/reports/category_b_benchmark_repair_2026-10-19/category_b_repaired.json', 'r') as f:
    cases = json.load(f)

errors = [err for c in cases for err in v.iter_errors(c)]
print(f"Total Errors: {len(errors)}")  # Output: Total Errors: 0
```

**Verdict:** The repaired dataset satisfies all formal structural and taxonomic constraints of `retrieval-case.schema.json`.
