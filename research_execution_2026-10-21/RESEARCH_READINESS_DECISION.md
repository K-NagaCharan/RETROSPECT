# Research readiness decision — Retrospect (2026-10-21)

**Basis.** All figures were re-verified against the files in this task: comparison TXTs, `per_case_results_all.csv`, `E_lineage/e_lineage_summary.json`, the adjudication CSV and git state.

- **Code state:** HEAD is `17ea399`; the evaluated code is **uncommitted** and identified by SHA-256 (`manifest.json`, `NEXT_ACTION_REPORT.md`).
- **Clones:** the originals in `D:\clones` and `data/external_repos` are clean and on their branches.

## 1. What the evidence is

| Class | Evidence | Size and independence |
|---|---|---|
| **A. Reproduced** | Java E1, Category B renames, B1–B4 at H = 50: **116/116 ranks identical** to the 2026-10-20 reference, in all 3 runs (before the fixes, fix 1, fix 2) | 29 cases → **18 origin-commit clusters**. 25 eligible (4 rejected) → 16 clusters: 11 in-window cases (7 clusters) and 14 outside (9 clusters). The 116 ranks are 4 configurations × 29 cases, **not** 116 tests. |
| **B. Fresh development measurements** | E2 Phase B, B1–B4 at H = 50 | 34 cases with a target: gson 8 (7 clusters), bottle 8 (8), express 10 (10), zod 8 (7). Fusion was designed on this set, so it is **not held-out**. |
| **C. Lineage checks** | E-Lineage: is the labelled commit attached to the target? | 21 in-window cases: Java 7/7, Python 6/7, JavaScript 3/4, TypeScript 2/3. All 3 misses are explained by labels, docstring scope or a revert chain. Development data. |
| **D. Unverified or disputed ground truth** | Adjudication CSV: **0 of 11 rows filled**. Disputed Phase B labels: py_bot_01, ts_zod_04, ts_zod_08 (§2). | — |
| **E. Held-out evaluation** | **None.** Category B was seen during earlier diagnostics (e.g. 0013 was DIAG-01) and has templated queries, so it is a final-study candidate but not pristine held-out data. No held-out Python, JavaScript or TypeScript data exists. | — |

**Key measured numbers** (B1 = structural, B2 = history only, B4 = RRF fusion; R@10 / MRR):

| Group | Cases / clusters | B1 | B2 | B4 | Exact sign-flip test, B4 vs B1 MRR | Rescues / fusion harms |
|---|---|---|---|---|---|---|
| E1 Java, in window | 11 / 7 | 0.73 / 0.153 | 0.82 / 0.315 | 0.91 / 0.402 | ΔMRR **+0.240**, **p = 0.17** | 3 / 1 |
| E1 Java, outside window | 14 / 9 | 0.57 / 0.208 | 0.00 / 0 | 0.14 / 0.062 | — | 0 / 6 |
| E2 Java (gson), dev | 8 / 7 | 0.38 / 0.297 | 0.50 / 0.068 | 0.75 / 0.201 | — | 3 / 0 |
| E2 Python (bottle), dev | 8 / 8 | 0.25 / 0.167 | 0.62 / 0.460 | 0.62 / 0.305 | — | 3 / 0 |
| E2 JavaScript (express), dev | 10 / 10 | 0.40 / 0.275 | 0.10 / 0.100 | 0.40 / 0.250 | — | 0 / 0 |
| E2 TypeScript (zod), dev, after fixes | 8 / 7 | 0.38 / 0.204 | 0.00 / 0.009 | 0.38 / 0.280 | — | 0 / 0 |

## 2. Ground-truth decisions

**No automatic corrections were made.** Every candidate correction below changes a *target* or an *evidence-commit label*, which is a ground-truth choice, not demonstrable metadata. Datasets and the CSV are unchanged.

**Java Category B.** All queries follow the template "Locate current implementation corresponding to historical method `<old>` in `<Class>`". The class name is a structural cue in every case.

| Case | Query names | Target | Unambiguous? | Leaks the answer? | Recommendation | Your decision? |
|---|---|---|---|---|---|---|
| 0013 | `getMessages` / AbstractCheck | `getViolations` | Yes (1:1 rename, `24ead56`) | No | **Accept** | Confirm |
| 0049 | `getResource` / ReferenceCountedPooled | `getBuffer` | Yes (same signature, `b62c3f1`) | No | **Accept** | Confirm |
| 0047 | `send` / WebSocket07FrameSinkChannel | `sendInternal` | Yes (`cea721e`) | No | **Accept** | Confirm |
| 0044 | `handleFrameData` / AjpClientResponseStreamSourceChannel | `updateFrameDataRemaining` | Yes (`6199ea1`, identical parameters) | No | **Accept** | Confirm |
| 0045 | `handleFrameData` / AbstractFramedStreamSourceChannel | `updateFrameDataRemaining` | Yes | No | **Accept** | Confirm |
| 0105 | `removeZeroDegreeNodes` / PrepareRoutingSubnetworks | `markNodesRemovedIfUnreachable` | Mostly (behavioural generalisation; docstring at the pin says "removes zero degree nodes") | No | Accept, with a note | **Yes** |
| 0101 | `setAlgorithmFactory` / GraphHopper | `putAlgorithmFactory` | Mostly (single → per-Weighting) | No | Accept, with a note | **Yes** |
| 0019 | `getMessage` / **Violation** | `getViolation` | Yes | **Yes**: the class was `LocalizedMessage` before this commit, and "Violation" is the target's stem | Successor Y; **exclude from rescue claims** | **Yes** |
| 0020 | `getCustomMessage` / **Violation** | `getCustomViolation` | Yes | **Yes** (same reason) | Successor Y; exclude query | **Yes** |
| 0005 | `isEmptyCtorBlock` / WhitespaceAroundCheck | `…CheckedFromRcurly` | **No**: a 1 → 2 split (`…FromRcurly` and `…FromSlist`) | No | Your judgment | **Yes** |
| 0046 | `handleFrameData` / StreamSourceFrameChannel | `processFrameData` | **No**: two successors (in-place `processFrameData`; inherited `updateFrameDataRemaining`) | No | Your judgment | **Yes** |

**Phase B (development data).**

| Case | Query (sanitized) | Labelled target and commit | Evidence | Recommendation | Your decision? |
|---|---|---|---|---|---|
| **py_bot_01** | "Inspect callback functions to extract parameter specifications across different Python versions" | `Route.get_undecorated_callback`, `750fcbe` | `750fcbe` changes **`get_callback_args`** (`getargspec` → `inspect.signature`), not the labelled target (verified diff) | The label is inconsistent with its own evidence. Retarget to `get_callback_args`, or **exclude**. Meanwhile, **exclude it from rescue counts** (it was a B2 rank-1 "rescue" via other commits). | **Yes** |
| **ts_zod_04** | "Validation rule for standard international currency codes" | `currencyCode`, `d6bc1e3` | `d6bc1e3` added it, `ca0229a` reverted it, `cc4cd4e` re-applied it (all in the window). History attached `cc4cd4e`. | Accept the target. Count either commit of the add/revert/re-apply chain as correct lineage, or relabel to `cc4cd4e`. | **Yes** (lineage policy) |
| **ts_zod_08** | "Ensure array size stays within defined limits during schema validation" | `$ZodArray`; the record says `symbolType: function`, `export const $ZodArray … core.$constructor` | The commit added helper `capSize` (structural rank **1**, B2 306) and one call line in the `$ZodArray` factory (B2 **44**; the interface ranks 43) | Score **only the factory** (the record's own policy). Whether `capSize` is also correct is your call. | **Yes** (`capSize`) |

**Consequence if you accept the recommendations.** Java rescues are **0013 and 0049** (2 cases, 2 clusters). Phase B candidate rescues: Python 2 (py_bot_05, 08), Java/gson 3, of which 2 have query/commit-echo concerns (gsn_05, gsn_08).

## 3. Can the current data support each claim?

| Claim | Status | Exact gap |
|---|---|---|
| 1. Supports Java, Python, JavaScript, TypeScript | **Supported at the engineering level.** Parsing, indexing and history lineage run in all four languages on real repositories; lineage attaches the labelled commit in 18/21 dev cases, and the 3 misses are explained. | Effectiveness is not shown for Python, JavaScript or TypeScript. Known extraction gaps remain: `.tsx` grammar; history skips `.jsx/.mjs/.cjs/.tsx`. |
| 2. History recovers evolution evidence | **Preliminary** | Development data only; 3–7 cases per language; no renames inside the window outside Java |
| 3. Fusion beats structural retrieval | **Not supported as a general claim.** Conditional and preliminary: in-window Java ΔMRR +0.24 (p = 0.17, 7 clusters). Outside the window, fusion harms 6/14. Dev: helps gson and bottle, no effect on express or zod. | No significant held-out result. The effect depends on reachability. |
| 4. History rescues targets missed by structure | **Preliminary:** 2 Java cases (0013, 0049), pending adjudication; dev candidates in Python and Java | Needs adjudicated, independent clusters. No non-Java held-out rescue case exists. |
| 5. CLI answers questions with an LLM | **Not supported:** not implemented | Implementation plus evaluation protocol |

**Can existing data answer the main four-language research question confirmatorily? No.** Phase B is development data, and no held-out Python, JavaScript or TypeScript evolution set exists. One mathematical floor applies, not a sufficiency rule: with an exact two-sided cluster sign-flip test, p < 0.05 is **attainable only with at least 6 independent evolution commits per comparison** (2/2⁶ = 0.031). Phase B languages have 7–10 clusters, but they are development data.

## 4. The single next experiment: E3-Reach (Java, pre-registered)

**Research question.** When the evolution commit is **reachable**, does history-aware retrieval add value beyond structural retrieval for renamed methods? At H = 50, 14 of the 25 eligible cases are unreachable by construction. That confounds "history doesn't help" with "history never saw the commit".

**Design** (fixed before running; nothing tuned):

| Item | Setting |
|---|---|
| Data | All **25 eligible** Category B cases (rejected 0031/0034/0048/0050 excluded by the existing audit rule); **16 origin-commit clusters**; same pins |
| Configuration | Existing B1–B4, unchanged. Only the history window changes: **H = 400**. That is the smallest round value covering every eligible origin; the maximum topological position measured today is 395, so all origins sit before the final window position, which is never diffed. |
| Tooling | Existing driver and worker, isolated clones, new output folder: `scratch/run_java_case_study.js --horizon 400` |
| Baseline | The reproduced H = 50 ranks of the same cases. B1 is unaffected by H, so B1 must reproduce exactly; this is a built-in check. |
| Primary estimand | Cluster-mean ΔMRR (B4 − B1) over 16 clusters, with an exact two-sided sign-flip test |
| Secondary measures | B2 − B1 ΔMRR; rescues (B2 ≤ 10, B1 > 10); fusion rescues and harms; change from H = 50 to H = 400 for the 11 in-window cases (noise cost of a larger window) |
| Sensitivity | Re-analyse excluding cases you reject or judge in §2 (no re-run needed) |

**Pre-defined outcomes:**
- **Success:** ΔMRR > 0 and p < 0.05, **and** fusion harms ≤ fusion rescues.
- **Failure:** ΔMRR ≤ 0, **or** fusion harms > fusion rescues.
- **Inconclusive:** ΔMRR > 0 but p ≥ 0.05, with harms ≤ rescues.
- **Invalid run:** any B1 rank differs from the H = 50 run. B1 doesn't depend on H, so a difference would mean an environment or code change.

**Decision this enables.**
- **Success:** history-aware retrieval adds value beyond structural retrieval when history is reachable, on the cleanest data available. That justifies building the held-out Python, JavaScript and TypeScript set to test the four-language claim.
- **Failure:** the benefit is confined to a few nearby renames. Do **not** invest in non-Java data collection; scope the paper as a limited or negative result.
- **Inconclusive:** existing Java data is exhausted (16 clusters is everything available). Decide the paper scope on the effect size, with the uncertainty stated.

**Threats to state in advance:**
- Category B is not pristine held-out data (it was seen in diagnostics).
- Queries are templated and contain the class name.
- Adjudication is pending.
- A larger window adds commit-message noise. This is part of what is being measured; it is not to be tuned.

## 5. Decision gate

1. **What Retrospect can claim today:**
   - A working four-language structural and history pipeline whose lineage step attaches the right commit on development cases in all four languages.
   - A **reproduced** Java measurement in which, for renamed methods with the commit inside the window, history-aware ranking improves MRR but **not significantly** (p = 0.17, 7 clusters), with 2 clear rescues.
   - Fusion **harms** results when history is unreachable.
   - Nothing about LLM explanations.
2. **The most important unresolved problems:**
   - (a) No held-out Python, JavaScript or TypeScript evaluation data.
   - (b) Adjudication is blank (11 Java cases plus 3 Phase B label disputes).
   - (c) The value of history is confounded with reachability at H = 50, and fusion harms unreachable cases.
3. **Can existing data answer the main research question?** Java: partially, via E3-Reach. Four languages: **no**, not confirmatorily.
4. **Next experiment:** E3-Reach (§4). It decides whether to build held-out non-Java data or narrow the paper.
5. **Success, failure, inconclusive:** as defined in §4.
6. **When to stop experimenting:** after your adjudication (§2) plus E3-Reach. The Java question is then closed, and no further Java experiment adds information from existing data.
   - **If E3-Reach succeeds:** exactly one more step remains — a held-out set of at least 6 independent evolution commits per non-Java language, authored blind, plus one run with these criteria.
   - **If E3-Reach fails or is inconclusive, or that set can't be funded:** stop and decide the paper on the evidence above.

## Blockers that existing evidence cannot resolve

- **Your ground-truth decisions:** 0105, 0101, 0019, 0020, 0005, 0046; py_bot_01; ts_zod_04 lineage policy; ts_zod_08 `capSize`; Netty 0035/0036/0038 classification.
- **No held-out Python, JavaScript or TypeScript data.** It cannot come from Phase B.
- **No commit.** The evaluated code is identified only by hashes; a commit is needed to cite a revision.
- **No LLM layer.** Claim 5 cannot be tested until it exists.
