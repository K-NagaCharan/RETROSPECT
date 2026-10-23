# E-Lineage — per-language lineage attribution (Phase B, in-window cases)

**Question.** For each Phase B case that has a target and whose **labelled evidence commit** lies in the 50-commit window read by retrieval, does the history channel attach that commit to the **labelled target symbol**?

**Scope.** This is an engineering check of lineage, not of retrieval effectiveness. Phase B is **development data**.

**How it ran.** `../E_lineage_run.js`, read-only:
- Same code path as the E2 worker: `indexRepository` plus `HistoricalRetrievalAdapter.indexRepositoryHistory`, merge-aware `--topo-order`, H = 50.
- Current adapters (fixes 1 and 2).
- Isolated clones at their pins: HEAD verified equal to the pin; clean before and after; nothing checked out.

**Outcomes:**
- **CORRECT:** the target's profile contains the labelled commit (exact subject line and full message).
- **WRONG_COMMIT:** the profile has history, but not the labelled commit.
- **NO_COMMIT:** the profile is empty.

**Data.** Outputs are `e_lineage_results.json/.csv` and `e_lineage_summary.json`. An earlier run is kept as `../E_lineage_v1_superseded_matcher_bug/`. Its target matcher lacked the worker's `qualifiedName` rule and its commit detection used substrings; it is not valid.

## Results (21 cases; every labelled commit was inside the window and diffed by retrieval)

| Language (repo) | Cases | CORRECT | WRONG_COMMIT | NO_COMMIT | Notes on non-correct cases |
|---|---:|---:|---:|---:|---|
| Java (gson) | 7 | **7** | 0 | 0 | — |
| Python (bottle) | 7 | **6** | 1 | 0 | py_bot_01: **ground-truth mismatch** (below) |
| JavaScript (express) | 4 | **3** | 0 | 1 | js_exp_09: doc-comment-only commit (below) |
| TypeScript (zod) | 3 | **2** | 1 | 0 | ts_zod_04: revert / re-apply chain (below) |

**Strict attribution rate:** Java 7/7, Python 6/7, JavaScript 3/4, TypeScript 2/3. With N = 3–7 per language, these are descriptive only.

## The three non-correct cases (verified with `git show`)

| Case | What happened | Classification |
|---|---|---|
| **py_bot_01** (`Route.get_undecorated_callback`) | Labelled commit `750fcbe` ("Switch to inspect.signature()") changed `get_callback_args` (`getargspec(...)` → `inspect.signature(...)`), **not** the labelled target. History attached the 3 commits that did modify the target. | **Phase B label error.** The system is correct. This case was one of E2's Python "rescues" (B2 rank 1), so that rescue does not rest on the labelled evolution. |
| **js_exp_09** (`res.location`) | Labelled commit `91d333b` only edited the JSDoc **above** the function (lines 782–790, outside its range); the function body is unchanged. | **Known limitation:** lineage tracks function bodies, so docstring-only changes are not recorded as evolution. The case is labelled `hard_negative` (with an answer) in Phase B. |
| **ts_zod_04** (`currencyCode`) | The labelled commit `d6bc1e3` added the function. `ca0229a` reverted it and `cc4cd4e` re-applied it (both in the window). History attached `cc4cd4e`, the commit the current code descends from. | **Label choice, not a lineage error.** The labelled commit is the original introduction, which was later reverted. |

**Under this reading there is no case where history attached an unrelated commit to the labelled target.**

## Other observations

- **ts_zod_05 and ts_zod_08 each match two symbols** (overload members, and interface plus factory `$ZodArray`). Both symbols carry the labelled commit, so the outcome doesn't depend on which is the intended target.
- **Newly added functions get `evolutionType: uncertain`**, which triggers B2's ×0.65 discount (gson 01/03/04/06, zod 04). That's a ranking effect, not an attribution error.
- **express attaches history to only 9 of 3,101 symbols**: the window touches few code files (29). This is a reachability property of that repository's history, consistent with E2's low JavaScript B2 scores.

## What this does and does not show

- **Shows:** on the available development cases, lineage extraction attaches the labelled evolution commit to the right current symbol in **all four languages**. The non-correct outcomes come from labels, docstring scope or revert chains, not from wrong matches.
- **Does not show:**
  - retrieval effectiveness (that's E2, ranking);
  - behaviour on renames outside Java (no Phase B rename is inside the window);
  - performance on held-out data.
- **Phase B data issue:** py_bot_01's label should be reviewed (target `get_callback_args` vs `get_undecorated_callback`). It is an owner decision; no label was changed.
