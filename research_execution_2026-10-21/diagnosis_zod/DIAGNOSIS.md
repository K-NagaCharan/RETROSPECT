# Why B2 (historical only) scores near zero on zod — read-only diagnosis

- **Trace:** `trace_zod_b2.js`. It builds the same structural index and 50-commit history profiles as the E2 worker, in memory, on `D:/clones_eval_2026-10-22/phaseb_zod` at pin `284243f`. No checkout or writes; the clone is still clean.
- **Other evidence:** read-only `git show` / `git grep`, and `FunctionExtractor` on files at the pin.
- **Code:** no code was changed.

## Summary

**This is not a TypeScript parsing failure.** History extraction works on zod: 49 commits analysed, 284 code files changed, **511 of 3,531 symbols received history profiles**.

The near-zero B2 MRR (0.004) comes from four separate causes:

| Zod cases | Cause | Type |
|---|---|---|
| 01, 02, 06, 07, 09 (5 of 8) | Evidence commit is outside the 50-commit window, so B2 cannot score them by design | Reachability. Same behaviour as Java; not TS-specific. |
| **08** `$ZodArray` (in window, position 3) | **Extraction gap.** The implementation is `export const $ZodArray = core.$constructor("$ZodArray", (inst, def) => {…})` (core/schemas.ts:1882). `TypeScriptAdapter` extracts a variable only when its initializer is an arrow or function expression, never a call expression with a callback. The only `$ZodArray` symbol is the one-line `interface` at line 1845, so the fix in commit `e06a510` (inside the callback, around line 1930) never reaches it. The same commit's evidence lands on `compile.ts` functions, which take the top B2 ranks. **Prevalence:** 98 such `$constructor` definitions in `packages/zod/src` (core/schemas.ts 74, checks.ts 22, errors.ts 2). | **Adapter defect** (TS, and the same pattern in JS) plus target granularity: the ground-truth target resolves to the interface |
| **05** `properties` (in window, position 24) | Lineage is **correct** (`modified`, `certain`, right commit; score 0.290), but 31 symbols rank above it. Most come from one docs commit, `0c483c5` "docs: Zod 4.6 announcement post" (**2,913-word message**, 10 files, adds `bench/validate-vs-safeparse.ts`). Every new symbol in that commit inherits the whole message, which matches generic query terms ("define", "schema", "validation", "object"); score 0.364. | **Ranking design:** commit-message evidence is not normalised for message length or file relevance |
| **04** `currencyCode` (in window, position 31) | A `new_symbol`: no predecessor, so no historical-name signal. The profile is marked `uncertain`, so the ×0.65 discount applies; score 0.093. **449 symbols** have B2 > 0 for this query because broad terms ("validation", "standard") hit many large-commit messages and diffs; the target ranks 373. | **Ranking design** plus case type: new symbols have nothing to rescue |
| (all) | TypeScript overload signatures are extracted as separate symbols (`isSignatureOnly`): **204 of 907** symbols in core/classic schemas.ts and compile.ts. Each inherits the same profile, so top-k slots fill with duplicates (`compileChild` ×3, `input` ×3). | **Adapter / indexing defect** (TS-specific) |

**Why bottle (Python) works and zod doesn't.** Here are the in-window commit statistics measured on the four Phase B snapshots:

| Repo | Median message words | p90 | Max | Code files changed in window |
|---|---:|---:|---:|---:|
| zod | 13 | 169 | **2,913** | **284** |
| gson | 45.5 | 205 | 367 | 110 |
| express | 37 | 58 | 192 | 29 |
| bottle | 7 | 30 | 57 | 56 |

Bottle is a single-file library with short commit messages that usually name the function. zod is a monorepo with very verbose messages, the `$constructor` pattern and overloads.

## Implications

- The **TS-specific defects** are (a) unextracted `const X = f(…, callback)` implementations and (b) overload-signature duplicates. Both are correctness issues in the adapter and index, independent of any benchmark.
- **Commit-message noise** is a ranking-design weakness that is not specific to any language. Any fix to it is an algorithm change. It **must not be tuned on zod/Phase B and then reported on the same data**: zod is development data.
- The zod B2 numbers in E2 are **valid measurements of the current system**. They should be reported with this breakdown rather than as "TypeScript unsupported".

## Candidate fixes (not applied; each needs a decision)

| # | Change | Kind | Validation required |
|---|---|---|---|
| 1 | In `TypeScriptAdapter` and `JavaScriptAdapter`, extract `variable_declarator` whose value is a `call_expression` with a function or arrow argument (e.g. `$constructor`) as a symbol spanning the call | Correctness | Unit fixture; E1 ranks unchanged (Java unaffected); rerun E2 TS/JS and report before vs after |
| 2 | Collapse `isSignatureOnly` overloads into the implementation symbol (or exclude them from ranking) | Correctness | Unit fixture; rerun E2 TS |
| 3 | Bound commit-message evidence (e.g. subject + first paragraph, or length-normalised term weight) | **Algorithm change** | Must be validated on data *not* used to design it (held-out). Otherwise report only as an ablation. |
| 4 | ts_zod_08 ground truth: does "$ZodArray" mean the interface or the `$constructor` implementation? | Ground-truth decision (owner) | — |
