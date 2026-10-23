# Deviations log

## Deviation 1 (2026-10-22): Tree-sitter WASM abort guard and parser-health probes

This deviation is recorded in `reports/evaluation_protocol.md` §8. It added:
- one process per repository;
- a zero-symbol guard;
- parser-health probes after indexing and after each history pass;
- a sensitivity analysis restricted to parser-healthy snapshots.

It was made before any result was read.

## Deviation 2 (2026-10-22): parser memory-leak fix

**Statement: re-measurement with corrected software; no parameters changed.** No ranking logic, weight, threshold, history window, case, split, seed or analysis step was changed.

### Code

| Item | Value |
|---|---|
| Repository | `D:\base papers considered\Retrospect` |
| Branch | `fix/wasm-leak` |
| Base commit | `17ea399217737f8d5fe2c32c310b69c2f812b84d` |
| Fix commit | `ed02019c88d805017a2a356aeb9236ca71063f1d` |
| Commit message | "fix: free Tree-sitter trees, reuse parsers, count extraction failures" |

The working tree's earlier uncommitted changes, including other edits in `HistoricalRetrievalAdapter.js`, were **not** included. Only the fix's hunks were staged.

### What changed

Diagnosis: `reports/wasm_abort_diagnosis.md`.

1. **`src/parser/FunctionExtractor.js`:** `tree.delete()` in a `finally` after symbol and import extraction. Trees live in WASM memory and were never freed.
2. **`src/languages/LanguageAdapter.js` and `src/parser/TreeSitterManager.js`:** one lazily created, cached `Parser` per language (`getParser`). A new `Parser` was previously constructed and leaked on every parse.
3. **`src/structural/index/StructuralIndex.js` and `src/retrieval/HistoricalRetrievalAdapter.js`:** swallowed extraction errors are now counted as `extractionFailures` (`{count, firstError}`). These are exposed in `index.extractionFailures` / `index.stats.extractionFailures` and in `indexRepositoryHistory(...).stats.extractionFailures`. Return behaviour is unchanged: a failed file still contributes no symbols. The count lives in the history-indexing result's `stats`, not inside each per-symbol history profile, so profile objects consumed by scoring are unchanged.
4. **Tests:**
   - `tests/unit/parser_memory_fix.test.js`: equivalence with the pre-fix snapshot for one fixture per language, parser reuse, tree deleted even when extraction throws, and failure accounting in the index and in history.
   - `tests/stress/wasm_leak_stress.test.js`: 6,000 production-path extractions of a ~60 KB real file per language.
   - `tests/fixtures/parserfix/`: four synthetic fixtures plus `prefix_snapshot.json`.

     The snapshot was generated from the base commit (`git archive 17ea399`) and is byte-identical to the pre-fix working tree's output. Two fixture constructs, TypeScript overload signatures and `module.exports = function name()`, were removed beforehand because unrelated uncommitted adapter changes in the working tree treat them differently from the base commit.

### Test suite

`npx jest --runInBand --testPathIgnorePatterns author_pack_blinding` gave **23 suites, 195 tests, all passed**, including the stress suite.

`author_pack_blinding.test.js` was excluded under the standing rule: it rewrites timestamps in 20 tracked Phase C files. Those files were verified unchanged afterwards.

**Pre-fix code on the same stress files** (scratch run of the base commit) aborts with `ExitStatus exit(1)`:

| Language | Aborts at extract # | Source parsed |
|---|---|---|
| Java | 1,700 | ~98 MB |
| Python | 1,476 | ~92 MB |
| JavaScript | 1,228 | ~78 MB |
| TypeScript | 1,810 | ~117 MB |

The test therefore covers the defect.

### Harness

`scripts/evaluation/run_benchmark.js` and `scratch/evaluate_snapshot_worker.js` both `require` Retrospect's `src/` directly. Neither holds a separate parser or extractor copy, so both load the fixed code without modification.

The harness gained recording only: `structural_extraction_failures`, `history_extraction_failures_H*`, `history_symbols_with_history_H*` and `history_commits_analyzed_H*` in the run manifest. Ranking code is untouched.

### Gates

| Gate | Result | Evidence |
|---|---|---|
| G1: E1 reproduces 116/116 reference ranks | **PASS** (116/116, 29/29 cases) | `Retrospect/research_execution_2026-10-21/E1_parserfix/` (`compare_ranks.py` vs `research_corrected_2026-10-21/per_case_results_corrected.csv`) |
| G2: harness equivalence reproduces 136/136 E2 ranks | **PASS** (136/136, 34/34 cases) | `evaluation/harness_equivalence/run_parserfix/` vs `E2_after_fix2/per_case_results.csv` |
| G3: guava 317 KB stress and full guava H = 400 pass, probe healthy, `extractionFailures` = 0 | **PASS** | `evaluation/gates_parserfix/g3_guava.json` |

**G3 detail:** 6,000 / 6,000 extractions of `PublicSuffixPatterns.java` (the pre-fix code aborted at #418). Then, in the same process:
- the full index: 66,211 symbols, 0 failures;
- the H = 400 history pass: 399 commits, 6,712 changed files, 25,548 symbols with history, 0 failures.

The probe was healthy after every stage.

### Re-run snapshots

These are the v3 snapshot-runs whose parser aborted, all during the H = 400 history pass, per the per-case probes:

| v3 run | Repositories re-run | New folder |
|---|---|---|
| `held_out_test_BCA_v3` | lodash, typeorm | `held_out_test_BCA_v3_v4_parserfix/` |
| `held_out_test_D_v3` | lodash, moment, typeorm | `held_out_test_D_v3_v4_parserfix/` |
| `validation_D_v3` | moment | `validation_D_v3_v4_parserfix/` |
| `development_BCA_v3` | guava, zod | `development_BCA_v3_v4_parserfix/` |
| `development_D_v3` | guava, typeorm, zod | `development_D_v3_v4_parserfix/` |

`validation_BCA_v3` had no aborts. The analysis inputs `evaluation/runs/merged_v4_parserfix/<run>/` hold v3 rows for unaffected repositories plus v4 rows for re-run ones; see `SOURCE.json` in each. The analysis is in `evaluation/analysis/v4_parserfix/` and uses the same `analyze_benchmark.py`, protocol and seeds.

E3-Reach was re-run with the fixed code into `Retrospect/research_execution_2026-10-21/E3_reach_parserfix/`. It was analysed by `E3_reach_parserfix_analyze.py`, a path-only copy of the pre-registered `E3_reach_analyze.py`, into `E3_reach_parserfix_analysis/`. The original E3 results are untouched.

**Results:** `reports/parserfix_remeasurement.md`.
