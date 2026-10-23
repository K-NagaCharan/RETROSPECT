# Benchmark Case Loader Validation Report

**Date:** 2026-10-19  
**Component:** `src/evaluation/BenchmarkCaseLoader.js`  
**Test Suite:** `tests/evaluation/new_evaluator.test.js`  
**Status:** VALIDATED & TESTED (8/8 Loader Unit Tests Passing)

---

## 1. Scope & Objective

The objective of the `BenchmarkCaseLoader` is to provide a robust, benchmark-agnostic ingestion engine for the rebuilt Git-first benchmark. It replaces legacy ad-hoc loading scripts and enforces strict validation before evaluation begins.

### Key Guarantees
1. **No Retrospect-internal symbol IDs required:** Target identification relies strictly on repository path, relative file path, symbol name, declaration signature, and line span.
2. **No ground-truth inference from retrieval:** Expected targets and decoy sets must be explicitly defined in the benchmark JSON.
3. **No silent data repair:** Malformed records are never silently coerced into valid records. They are recorded in structured exclusion logs with human-readable error reasons.
4. **Git tree and object verification:** Pinned commit SHAs and target file paths are verified against actual Git DAGs in `D:/clones` using `git cat-file -e`.
5. **Decoy / distractor enforcement:** Every case must specify at least one valid distractor in `decoys`.
6. **Separation of schema validation from semantic lineage:** A case passing Git object verification is recorded as syntactically and structurally valid in Git, but is never assumed to be semantically verified without human adjudication.

---

## 2. Loader Test Scenarios & Results

The automated test suite `tests/evaluation/new_evaluator.test.js` executes the following test scenarios against `BenchmarkCaseLoader`:

| Test Case | Input Condition | Expected Behavior | Result |
| :--- | :--- | :--- | :--- |
| **Valid Canonical Case** | Full v2.0 schema case (`repo`, `pin_sha`, `query`, `target`, `decoys`, `category`, `language`, `origin_commit`, `commit_distance_origin_to_pin`, `contains_historical_identifier`, `split`). | Case loaded successfully into `validCases` array. | **PASS** |
| **Missing Target Specification** | Case with `target: null` or omitted `target`. | Excluded with error type `VALIDATION_FAILURE` and reason: *"Missing 'target' specification object."* | **PASS** |
| **Invalid Pin SHA** | `pin_sha: 'invalid_sha_123'` (non-hex or length $\ne 40$). | Excluded with reason: *"Invalid 'pin_sha' (expected 40-character hex SHA...)"* | **PASS** |
| **Missing Repository** | Case with `repo: ''` or null. | Excluded with reason: *"Missing or invalid 'repo' string."* | **PASS** |
| **Empty Decoys** | Case with `decoys: []`. | Excluded with reason: *"Case must define at least one valid distractor in 'decoys'."* | **PASS** |
| **Invalid Line Span** | `line_span: [500, 200]` (start > end) or non-array. | Excluded with reason: *"Target 'line_span' must be a 2-element array [start, end] with 1 <= start <= end..."* | **PASS** |
| **Legacy Schema Normalization** | Record using legacy field names (`repository_id`, `source_revision_sha`, `target_symbols`, `hard_negatives`, `commit_distance`). | Normalized into canonical v2.0 structure without data loss. | **PASS** |
| **Missing Git Clone** | Case pointing to repository not present in `D:/clones`. | Excluded during git tree verification with reason: *"Repository clone not found for repo '...' in clones directory..."* | **PASS** |

---

## 3. Normalization Mapping Reference

For backward compatibility with intermediate prototypes while preventing corruption of the canonical harness, the loader maps legacy fields as follows:

| Legacy Field Name | Canonical v2.0 Field Name | Transformation / Normalization |
| :--- | :--- | :--- |
| `repository_id` / `repository` | `repo` | String trimmed. |
| `source_revision_sha` / `commit` | `pin_sha` | Lowercased 40-char hex validation. |
| `query.query_text` / `query.text` | `query` | Extracted as top-level string. |
| `target_symbols[0]` | `target` | Flattened to single target object. |
| `target.filePath` / `target.file_path` | `target.file_path` | Normalized with forward slashes `/`. |
| `target.name` / `target.symbol_name` | `target.symbol_name` | String trimmed. |
| `target.line_range` | `target.line_span` | Validated as `[start, end]`, `1 <= start <= end`. |
| `hard_negatives` | `decoys` | Normalized array of distractor objects with `distractor_type`. |
| `target_language` | `language` | Capitalized language string. |
| `commit_distance` | `commit_distance_origin_to_pin` | Integer or null. |
| `contains_historical_identifier` | `contains_historical_identifier` | Strict boolean (`true`/`false`). |
| `split` | `split` | Lowercased (`'dev'`, `'val'`, `'test_confirmatory'`). |

---

## 4. Exclusion Reporting Structure

When a case is excluded during loading or validation, the loader appends an entry to `excludedCases` adhering to the following structure:

```json
{
  "case_id": "CASE-BAD-001",
  "index": 14,
  "reason": "Invalid 'pin_sha' (expected 40-character hex SHA, got 'bad_sha'); Target missing valid 'file_path'.",
  "error_type": "VALIDATION_FAILURE",
  "raw_case": { ... }
}
```

This guarantees complete traceability and ensures that evaluation numerators and denominators ($k/N$) are calculated strictly over eligible, fully validated cases.
