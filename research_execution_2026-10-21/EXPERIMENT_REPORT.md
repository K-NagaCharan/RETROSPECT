# Execution sprint — experiment report (2026-10-21)

- **Machine-readable outputs:** `per_case_results_all.csv` (63 rows), `aggregate_metrics.csv/.json`, `E1_sign_flip_tests_pre_adjudication.json`.
- **Provenance:** `manifest.json` (source fingerprints, pins, clone state, input hashes).
- **Raw worker outputs and logs:** `E1_java_reproduction/`, `E2_phase_b_four_language/`.
- **Rebuild the tables:** run `python -I analyze_results.py` (read-only on inputs).

All numbers below are **fresh measurements** from this sprint, unless marked otherwise. No snapshot cache was used: the worker was invoked directly for each snapshot.

## What ran

| Run | Data | Cases | Snapshots (pin) | Config | Status |
|---|---|---:|---|---|---|
| **E1** | Category B Java renames (`category_b_repaired.json`) | 29 | checkstyle `10a3a07`, graphhopper `c7497d1`, undertow `cf3abec`, java-driver `f424026` | B1–B4, H = 50, merge-aware `--topo-order` | All 4 workers exited 0, total 210 s; clones restored and clean |
| **E2** | Phase B (`data/*lineage*`), converted by `scratch/convert_phase_b_for_case_study.py` | 34 with a target (6 without a target excluded) | bottle `8ec5fe2`, express `a419aa7`, gson `845664b`, zod `284243f` (HEAD of the shallow clones) | Same B1–B4, H = 50 | All 4 workers exited 0, total 130 s; all 34 targets present in the index |

**Isolated clones.** Both runs used local clones in `D:/clones_eval_2026-10-22`. The originals in `D:\clones` and `data/external_repos` were never checked out and are still clean.

**Source revision.** HEAD is `17ea399`, but the evaluated code is **uncommitted**. It is identified by the SHA-256 fingerprints in `manifest.json`:
- All files that determine ranks are identical to the 2026-10-20 run, except two:
  - `evaluate_snapshot_worker.js`: Stage A labels only.
  - `GitHistoryReader.js`: argument-builder refactor.
- Both are rank-neutral: E1 ranks are identical.

## E1 — Java reproduction: **PASS, 116 / 116 ranks identical**

The 2026-10-20 Java measurements are now reproduced from documented inputs (`E1_comparison.txt`).

| Group (E1, Java renames) | N | Clusters | B1 R@10 / MRR | B2 R@10 / MRR | B3 R@10 / MRR | B4 R@10 / MRR | B2 rescues | Fusion rescue / harm |
|---|---:|---:|---|---|---|---|---:|---|
| Eligible (4 rejected excluded) | 25 | 16 | 0.64 / 0.184 | 0.36 / 0.138 | 0.64 / 0.260 | 0.48 / 0.212 | 3 | 3 / 7 |
| Origin inside the 50-commit window | 11 | 7 | 0.73 / 0.153 | **0.82 / 0.315** | **0.91 / 0.442** | **0.91 / 0.402** | 3 | 3 / 1 |
| Origin outside the window | 14 | 9 | 0.57 / 0.208 | 0.00 / 0.000 | 0.43 / 0.117 | 0.14 / 0.062 | 0 | 0 / 6 |
| Primary 5 (audit-verified renames) | 5 | 5 | 0.60 / 0.189 | 0.60 / 0.219 | 0.80 / 0.321 | 0.80 / 0.365 | 2 | 2 / 1 |

**Cluster-level exact sign-flip test** (pre-adjudication; clusters are origin commits). In-window, B4 − B1 MRR is +0.240 over 7 clusters, **p = 0.17**; Recall@10 gives p = 1.0. Primary 5: ΔMRR +0.176, p = 0.56. **Nothing is significant.**

**Rescue cases** (B2 in the top-10, B1 not):

| Case | B1 | B2 | B4 | Note |
|---|---:|---:|---:|---|
| 0013 | — | 2 | 8 | Primary |
| 0049 | 14 | 4 | 1 | Primary |
| 0019 | 27 | 3 | 5 | Query likely unacceptable: anachronistic class name plus target-stem leak |

0013 and 0019 share one origin commit. **None of the three is adjudicated yet.**

## E2 — Phase B, four languages: **development data, not held-out**

The fusion design was chosen on this set. The original Phase B run used RRF-v1 and history depths of 80–140 commits, so these numbers are **not** comparable with the old Phase B figures. "In window" means the evidence commit is among the 50 commits retrieval reads.

| Language (repo) | Cases | Clusters | In window | B1 R@10 / MRR | B2 R@10 / MRR | B3 R@10 / MRR | B4 R@10 / MRR | B2 rescues | Fusion rescue / harm |
|---|---:|---:|---:|---|---|---|---|---:|---|
| Java (gson) | 8 | 7 | 7 | 0.38 / 0.297 | 0.50 / 0.068 | 0.88 / 0.183 | 0.75 / 0.201 | 3 | 3 / 0 |
| Python (bottle) | 8 | 8 | 7 | 0.25 / 0.167 | **0.62 / 0.460** | 0.62 / 0.314 | 0.62 / 0.305 | 3 | 3 / 0 |
| JavaScript (express) | 10 | 10 | 4 | 0.40 / 0.275 | 0.10 / 0.100 | 0.40 / 0.245 | 0.40 / 0.250 | 0 | 0 / 0 |
| TypeScript (zod) | 8 | 7 | 3 | 0.38 / 0.203 | **0.00 / 0.004** | 0.25 / 0.148 | 0.38 / 0.278 | 0 | 0 / 0 |

Recall@1 and Recall@5 per group are in `aggregate_metrics.csv`. Cluster counts are 7–10 per language, so the results are **descriptive only**.

**Candidate rescues in E2.** All are *rewrites*, not renames: the target name is unchanged and history contributes vocabulary from commit messages and diffs.

| Case | Ranks B1 / B2 / B4 | Query–commit word overlap | Assessment |
|---|---|---|---|
| py_bot_01 | — / 1 / 6 | "inspect" | Low |
| py_bot_05 | — / 7 / 9 | none | — |
| py_bot_08 | — / 2 / 8 | "response" | Low |
| java_gsn_02 | 15 / 9 / 2 | none | — |
| java_gsn_05 | 15 / 7 / 7 | "code hash json primitive" | **Query names the target `JsonPrimitive.hashCode`: leak** |
| java_gsn_08 | — / 7 / 30 | "json path update" | **Query paraphrases the commit message** |

**Excluded (6):** py_bot ×2, ts_zod ×2, java_gsn ×2. These have `has_answer = False`, so there is no target to rank. They are listed in `phase_b_input/phase_b_excluded.json`.

## Valid in-window historical-rescue cases per language

| Language | Adjudicated rescues | Measured rescue candidates | Data status |
|---|---:|---|---|
| Java | **0** (the adjudication CSV is blank) | E1: 0013, 0049 (primary), 0019 (query issue). E2 gson: 3, of which 2 are leak-suspect. | E1 = final-study candidate; E2 = development |
| Python | 0 | E2 bottle: 3 (rewrites, low overlap) | Development only |
| JavaScript | 0 | 0 | Development only |
| TypeScript | 0 | 0 (B2 never in the top-10, even with the commit inside the window) | Development only |

## Findings to report honestly

- **Java:**
  - Inside the window, history-aware ranking beats structural on MRR in both runs. The difference is not significant.
  - Outside the window, history adds nothing, and B4 fusion **harms** 6 of 14 cases.
- **Python:** the historical channel is the strongest single channel on bottle (B2 MRR 0.460 vs B1 0.167). This is development data with N = 8.
- **JavaScript:** history adds nothing on express. B2 R@10 is 0.10, and 6 of 10 evidence commits are outside the window.
- **TypeScript:** the historical channel **fails** on zod (B2 MRR 0.004), even for the 3 cases whose commit is inside the window. Fusion does not hurt (B4 ≥ B1). **This is the most important negative result.** The cause is unknown: lineage extraction or scoring on TypeScript has not been diagnosed.
- **Pooled numbers are deliberately not reported.**

## Blockers and decisions not taken

- **Adjudication:** `ground_truth_adjudication.csv` is blank, so no rescue is "verified". E1 reproduction did not depend on it.
- **No commit:** the evaluated code exists only in the working tree. The fingerprints identify it, but a commit is needed to cite a revision.
- **JS/TS extension gap was not fixed.** `HistoricalRetrievalAdapter.js:516` only diffs `.js/.ts/.py/.java`, and `TypeScriptAdapter` parses `.tsx` with the `typescript` grammar. Measured impact on these runs: zod's 50-commit window touches 9 `.tsx` files, all under `packages/docs/`, none of them targets. Express, bottle and gson have no such files. So the gap does **not** explain the TypeScript failure.
  - **Exact fix for later:** extend the filter at line 516 to the adapters' extensions (via `LanguageAdapterRegistry`), and register a TSX adapter variant using `tree-sitter-tsx.wasm`. Add a `.tsx` fixture test. Re-run E1 to confirm the Java ranks are unchanged.
- **Held-out non-Java data:** there are still no held-out, adjudicated non-Java cases. E2 is development data.

## LLM integration contract (not implemented)

`UnifiedSearch.search()` (`src/retrieval/UnifiedSearch.js`) already returns, for each ranked **current** symbol:
- `symbol` (id, qualifiedName, filePath, range, signature, docstring, **source**);
- `score`, `structuralScore`, `historicalScore`, `structuralReasons`;
- `lineageEvidence` (historicalNames, historicalQualifiedNames, commitMessage, evolutionType, confidence, historyDepth, reasons).

**Missing for attribution:** the evolution records hold the commit hash (`HistoricalRetrievalAdapter.js:548`) and diff text, but `lineageEvidence` does not expose them. Minimum contract:

1. **Input:** `{repoPath, pin, query, k=5}`.
2. **Retrieval:** `search()` top-k, plus, per symbol, `evidence[] = {commit_sha, date, message, diff_hunk (trimmed), predecessor_name, evolutionType, confidence}`. This needs one small change: carry `childCommit` and `diffText` into `lineageEvidence`.
3. **Context:** numbered evidence blocks `[E1] file:range` (code) and `[C1] sha message + hunk`, within a token budget (`ContextBuilder` already budgets tokens).
4. **Provider interface:** `complete({system, user, maxTokens}) → text`. A single adapter; the provider is chosen in config.
5. **Output:** `{answer, claims[] = {text, citations:[E#|C#]}, unanswerable: bool}`.
6. **Safeguards:**
   - The system prompt requires a citation for every claim and allows "insufficient evidence".
   - A post-check drops or flags claims whose citations are not among the supplied IDs.
   - Evaluation counts the supported and unsupported claim rates by human annotation.

## Addendum — extraction fixes 1 and 2 (factory-call symbols, overload collapse)

**What changed.** Applied after `diagnosis_zod/DIAGNOSIS.md`. Commit-message weighting was **not** touched.

- `src/languages/JavaScriptAdapter.js` (SHA-256 `ecc97764…`): new `_findFactoryCallback` and `_factorySymbol`. A **module-level** `const X = f(…, <function or arrow>)` adds one symbol `X` spanning the declarator. Traversal then continues unchanged, so existing symbols keep their names and IDs.
- `src/languages/TypeScriptAdapter.js` (SHA-256 `9cf543f2…`): the same factory branch, plus `_collapseOverloadSignatures`.
  - Signature-only overloads are dropped when an implementation with the same qualified name exists; otherwise only the first is kept.
  - `metadata.overloadCount` records the count. Single interface signatures are untouched.
- Tests: new `tests/unit/factory_and_overload_extraction.test.js`, with 9 tests. One of them is a git-history fixture: an edit inside a `$constructor` callback now yields a non-`unchanged` history profile for the factory symbol.

**Validation.**
- **Test run:** `npx jest --runInBand --testPathIgnorePatterns author_pack_blinding` → 21 suites, **180/180 passed**. The Phase C author-pack test was skipped because it rewrites tracked files.
- **Java non-regression:** E1 rerun (`E1_after_fix/`) → **PASS, 116/116 ranks identical** (`E1_after_fix_comparison.txt`).

**E2 before vs after** (same 34 cases, pins and configuration; `compare_before_after.py` → `before_after_e2.csv/.json`):

| Language | Symbols indexed | B1 MRR | B2 R@10 / MRR | B3 MRR | B4 R@10 / MRR | Rescues / harms |
|---|---|---|---|---|---|---|
| Java (gson) | 4,239 → 4,239 | 0.297 → 0.297 | 0.50 / 0.068 → same | 0.183 → same | 0.75 / 0.201 → same | 3/0 → 3/0 |
| Python (bottle) | 1,044 → 1,044 | 0.167 → same | 0.62 / 0.460 → same | 0.314 → same | 0.62 / 0.305 → same | 3/0 → 3/0 |
| JavaScript (express) | 3,101 → 3,109 | 0.275 → same | 0.10 / 0.100 → same | 0.245 → same | 0.40 / 0.250 → same | 0/0 → 0/0 |
| TypeScript (zod) | 3,531 → **4,136** | 0.203 → 0.204 | 0.00 / **0.004 → 0.007** | 0.148 → 0.171 | 0.38 / 0.278 → 0.279 | 0/0 → 0/0 |

**Changed cases (all TypeScript):**

| Case | B1 | B2 | B3 | B4 | Stage A |
|---|---|---|---|---|---|
| ts_zod_08 `$ZodArray` | — | none → **71** | none → 76 | none → 88 | `NO_HISTORICAL_EVIDENCE` → **`REACHABLE`** |
| ts_zod_05 | 4 | 32 → 25 | 1 | 1 | unchanged |
| ts_zod_04 | 1 | 373 → 324 | 6 → 3 | 1 | unchanged |
| ts_zod_01 | 24 → 22 | — | 283 → 227 | 40 → 47 | unchanged (outside window) |
| ts_zod_07 | 3 | — | 57 → 71 | 5 | unchanged (outside window) |

**Interpretation.**
- The fixes repair attribution: the `$ZodArray` change is now linked to a `$ZodArray` symbol. The TypeScript historical channel is still weak (no case reaches B2 top-10), because the dominant cause from the diagnosis — commit-message noise in a large, verbose monorepo — is unchanged by design.
- No rank changed in Java, Python or JavaScript.
- **ts_zod_08 is now ambiguous:** an `interface $ZodArray` and a factory `$ZodArray` share the name and file. The worker counts the best-ranked match, so the target definition for 08 is an **owner decision** (DIAGNOSIS.md, item 4).
- These are development-data results; no ranking parameter was changed.

## Files created or modified in this sprint

- **New:**
  - `scratch/convert_phase_b_for_case_study.py`
  - `research_execution_2026-10-21/` (this folder)
  - `D:/clones_eval_2026-10-22/` (8 isolated clones, outside the project)
- **Modified after the main runs (fixes addendum):** `src/languages/JavaScriptAdapter.js` (already modified before this sprint) and `src/languages/TypeScriptAdapter.js`.
- **New test:** `tests/unit/factory_and_overload_extraction.test.js`.
- **Unchanged:** no dataset, ground-truth or existing result/report files were modified. Nothing was staged or committed.
