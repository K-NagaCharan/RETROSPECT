# Next-action report — extraction fixes, verification, decisions (2026-10-21)

**Evidence status.** Everything below was re-verified in this task against the files. HEAD is still `17ea399` and all evaluated code is **uncommitted**.

**Source identity** (SHA-256, first 16 characters):

| File | Hash |
|---|---|
| `src/languages/JavaScriptAdapter.js` | `0641eeebac973f42` |
| `src/languages/TypeScriptAdapter.js` | `61035db6c22f11f5` |
| `tests/unit/factory_and_overload_extraction.test.js` | `c06e42792460be70` |

**Configuration:** B1 structural; B2 historical; B3 linear 0.6/0.4; B4 RRF k=60, 0.5/0.5; H = 50, merge-aware `--topo-order`.

**Data:**
- E1: `category_b_repaired.json` (SHA-256 `acb2e388…`), 29 cases.
- E2: Phase B, 34 cases with a target (`phase_b_input/phase_b_case_study_input.json`).

## 1. Are both fixes correct?

**Fix 2, overload collapse: correct as intended.**
- **Verified:** implementation identity is kept (the implementation's own record and ID survive, with `overloadCount` set). Signature-only groups keep one representative. Getters, setters and single interface signatures are untouched.
- **Known edge case, not fixed:** with TS declaration merging (`interface Foo { m() }` + `class Foo { m() {} }`), the interface's `Foo.m` signature folds into the class's `Foo.m` and is labelled `overloadCount: 1`. It is rare and doesn't affect any evaluated case.

**Fix 1, factory extraction: a defect was found and corrected in this task.**
- The original rule (any module-level `const X = call(…, fn)`) captured computed values. In **express all 8 new symbols were false positives** (`server = app.listen(port, cb)`, `names = users.map(fn)`, …). In zod it also caught test values (`z.preprocess(...)`, `z.string().refine(fn)`).
- **Correction:** factory symbols are now limited to **exported** declarations (`export const X = f(…, fn)`), via `JavaScriptAdapter._isExportedDeclarator`, used by both adapters. Results:
  - express: 0 factory symbols;
  - zod: 253 (250 `core.$constructor`, plus exported `makeSchema`, `makeData`, `cached`).
- **Trade-off (documented):** non-exported internal factories and CommonJS `exports.x = f(fn)` are not covered.
- **Attribution:** a history fixture test confirms that an edit inside an exported factory callback produces a modified profile for that symbol.

**ID stability.** No existing symbol is renamed or re-scoped. Factory symbols are additions; collapsed signatures are removals. One known side effect: an edit inside a nested function in a factory callback now also marks the enclosing factory as modified. This is consistent with how class symbols span their methods.

## 2. Tests executed

| Command | Result |
|---|---|
| `npx jest --runInBand --testPathIgnorePatterns author_pack_blinding` (before the correction) | 21 suites, **180/180 passed** (this verifies the earlier claim) |
| Same command, after the correction | 21 suites, **181/181 passed**. Added: a negative test for non-exported computed values (express/zod patterns). Changed: the JS wrapper test now uses `export`. |
| Read-only edge-case probes (`FunctionExtractor` on inline snippets) | Results as listed in §1 |

The author-pack test was not run because it rewrites tracked Phase C files. Those files are untouched; their modification time is still 18:30:41.

## 3. Verified before/after results

**Java E1** (29 cases): **116/116 ranks identical** to the reference in all three runs:
- `E1_comparison.txt`: before the fixes;
- `E1_after_fix_comparison.txt`: first fix;
- `E1_after_fix2_comparison.txt`: refined fix.

All workers exited 0 and the isolated clones stayed clean. This shows the measurement is **reproducible from documented inputs** with the fingerprinted, uncommitted code.

**E2 Phase B** (development data; same 34 cases, pins and configuration). Source: `before_after_e2_fix2.json`.

| Language | Symbols (before → fix 1 → fix 2) | B1 R@10 / MRR | B2 R@10 / MRR (before → fix 2) | B3 MRR | B4 R@10 / MRR | B2 rescues |
|---|---|---|---|---|---|---|
| Java (gson, 8) | 4,239 → 4,239 → 4,239 | 0.38 / 0.297, unchanged | 0.50 / 0.068, unchanged | 0.183, unchanged | 0.75 / 0.201, unchanged | 3 → 3 |
| Python (bottle, 8) | 1,044 → 1,044 → 1,044 | 0.25 / 0.167, unchanged | 0.62 / 0.460, unchanged | 0.314, unchanged | 0.62 / 0.305, unchanged | 3 → 3 |
| JavaScript (express, 10) | 3,101 → 3,109 → **3,101** | 0.40 / 0.275, unchanged | 0.10 / 0.100, unchanged | 0.245, unchanged | 0.40 / 0.250, unchanged | 0 → 0 |
| TypeScript (zod, 8) | 3,531 → 4,136 → **3,675** | 0.38 / 0.203 → 0.204 | 0.00 / **0.004 → 0.009** | 0.148 → 0.173 | 0.38 / 0.278 → 0.280 | 0 → 0 |

**Per-case ranks:** Java, Python and JavaScript are identical across all three runs. TypeScript changes (before → refined fix):

| Case | B1 | B2 | B3 | B4 | Stage A |
|---|---|---|---|---|---|
| ts_zod_08 | — | **— → 43** | — → 48 | — → 60 | `NO_HISTORICAL_EVIDENCE` → `REACHABLE` |
| ts_zod_05 | 4 | 32 → 21 | 1 | 1 | unchanged |
| ts_zod_04 | 1 | 373 → 290 | 6 → 3 | 1 | unchanged |
| ts_zod_01 | 24 → 22 | — | 283 → 210 | 40 → 43 | unchanged (outside window) |
| ts_zod_07 | 3 | — | 57 → 43 | 5 | unchanged (outside window) |

**No TypeScript case reaches the B2 top-10.**

## 4. ts_zod_08 (`$ZodArray`) ground truth

- **What the benchmark record says** (`data/benchmark_lineage_audited_v3.json`): `current_symbol.symbolType = "function"` with signature `export const $ZodArray: core.$constructor<$ZodArray>`, and the audit note "symbol name from _array to $ZodArray". By the record's own policy, **the target is the factory implementation (line 1882), not the interface (line 1845)**, so this part is not ambiguous.
- **What the query asks:** "Ensure array size stays within defined limits during schema validation" (original: "Verify array container length bounds prior to traversing child items"). It describes behaviour, not a type.
- **What commit `e06a510` actually did:** added a **new helper `capSize(...)`** (line 1848) holding the bounds logic (plus `arraySize`/`mapSize`/`setSize`); `$ZodArray` gained one line, `capSize(inst, arraySize)`.
- **Measured ranks** (read-only trace `diagnosis_zod/trace_zodarray.js`):

| Symbol | B1 | B2 |
|---|---:|---:|
| interface `$ZodArray` | — | 43 |
| factory `$ZodArray` | — | **44** |
| `capSize` | **1** | 306 |

  The worker's name-only matching counts the better of the two `$ZodArray` symbols (43). Under the record's policy the correct B2 rank is 44.
- **Recommendation:** keep the record's target, the **factory `$ZodArray`**, and score only that symbol. Whether `capSize` should also count as a correct answer is a **subjective decision for you**: the query arguably describes `capSize` best, and structural retrieval ranks it first. No label was changed.

## 5. Adjudication (11 cases)

The full table is in `ADJUDICATION_DECISION_TABLE.md`; the CSV is unchanged and still blank.

| Recommendation | Cases |
|---|---|
| Accept (confirm only) | 0013, 0049, 0047, 0044, 0045 |
| Accept with a note (your decision) | 0105 (generalisation), 0101 (signature change) |
| Successor Y but query rejected (anachronism + stem leak; your decision) | 0019, 0020 |
| Your judgment | 0005 (1 → 2 split), 0046 (two candidate successors) |
| Netty 0035/0036/0038 | Classify as framework migration, not rename |

If the recommendations are accepted, the valid Java rescues are **0013 and 0049** (2 cases, 2 commits).

## 6. The single best next experiment

**E-Lineage: per-language lineage-attribution accuracy on the existing Phase B in-window cases.**

- **Cases:** 21 cases with a target and the evidence commit inside the window: Java 7, Python 7, JavaScript 4, TypeScript 3.
- **Question:** in each language, does the history channel attach the **labelled evidence commit** to the **labelled target symbol**? Measure: the target's profile contains that commit (correct / wrong commit / none).
- **Why this one:**
  - It answers the open per-language question ("is lineage reliable?") separately from ranking.
  - It needs no new labels and no tuning: it uses existing labels and the current, fixed code.
  - It covers all four languages.
  - It is a cheap read-only trace (about 3 minutes, like `trace_zod_b2.js`), plus one small change to the trace to log the profile's commit hash (`HistoricalRetrievalAdapter.js` ~548 already has `childCommit`).
- **What it cannot do:** establish retrieval effectiveness. The data is development data.

## 7. Exact blockers to a defensible four-language evaluation

1. **No held-out non-Java data.**
   - Phase B is development data (the fusion design was chosen on it). Python, JavaScript and TypeScript have **no** adjudicated, in-window, held-out evolution cases.
   - **Smallest resolving action (your decision):** author a small held-out set per language from repos *already cloned* in `D:\clones` (Python: httpx, pytest, marshmallow…; JavaScript: mocha, moment, koa…; TypeScript: vue, rxjs, typeorm…).
   - **Protocol:** select in-window rename/rewrite events, write queries blind to the retrieval output, adjudicate, and only then run E1-style B1–B4 once.
2. **Adjudication is blank.** No rescue is "verified" yet, in any language.
3. **No commit.** The results are reproducible only via the file fingerprints. A commit is needed to cite a revision.
4. **TypeScript ranking weakness** (commit-message noise, `diagnosis_zod/DIAGNOSIS.md`). Any weighting fix is an algorithm change and must be validated on the held-out set from blocker 1, never on Phase B.
5. **ts_zod_08 scoring rule:** score the factory only, or also `capSize` (§4).

## 8. Files modified or created in this task

- **Modified:**
  - `src/languages/JavaScriptAdapter.js`: added `_isExportedDeclarator`; the factory condition now requires export.
  - `src/languages/TypeScriptAdapter.js`: the same factory condition.
  - `tests/unit/factory_and_overload_extraction.test.js`: one test changed to `export`, and one negative test added.
- **New, in `research_execution_2026-10-21/`:**
  - `E1_after_fix2/`, `E2_after_fix2/` (+ stdout files);
  - `E1_after_fix2_comparison.txt`;
  - `before_after_e2_fix2.json`;
  - `diagnosis_zod/trace_zodarray.js`;
  - `ADJUDICATION_DECISION_TABLE.md`;
  - this report.
- **Not modified:**
  - earlier results (`E1_java_reproduction/`, `E2_phase_b_four_language/`, `E2_after_fix/`, `before_after_e2.*`, `EXPERIMENT_REPORT.md`);
  - datasets, ground truth, the adjudication CSV;
  - the original clones (`D:\clones`, `data/external_repos`), which are clean.
- Nothing was staged or committed.
