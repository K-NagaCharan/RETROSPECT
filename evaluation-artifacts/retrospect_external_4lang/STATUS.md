# Status: COMPLETE

All phases (0–5) of the external four-language rename benchmark are done. The confirmatory decision is **SUPPORTED**, and the harm check is a **PASS**. Updated 2026-10-23.

| Phase | Result | Evidence |
|---|---|---|
| 0: freeze code | Snapshot `9d112fa` and merge `03f89e9` of `fix/wasm-leak`. Gates: jest 195/195 tests; G2 136/136 ranks; E1 116/116 ranks | `phase0/jest.log`, `phase0/g2_compare.txt`, `phase0/e1_compare.txt`, `VERSION.md` |
| 1: lineage gate G | Commit `1ac3b35`, which is tag `eval-v1`. On the development split, G equals B1 whenever L is empty (0 violations); G's MRR there was not computed | `phase1/dev_check_result.json` |
| 2: case set | 42 repositories, one rename event each: Java 12, Python 12, JavaScript 7, TypeScript 11. Frozen | `cases/cases.jsonl`, `cases/MANIFEST.sha256.json`, `cases/funnel.json`, `cases/exclusion_log.csv`, `cases/review_sheet.csv` |
| 3: pre-registration | Written before any run, pinned to `eval-v1` | `protocol.md` |
| 4: benchmark | B1–B4 and G at H = 400, 2 repositories in parallel. Each clone clean at its pin before and after | `runs/external_v1/` |
| 5: analysis and reports | Confirmatory, harm check and descriptive results; sensitivity and post-hoc rows | `analysis/external_v1/results.json`, `analysis/external_v1_posthoc/results_posthoc.json`, `REPORT.md`, `paper_tables.md` |

## Confirmatory test (protocol §4)

Task B_id, G vs B1, pooled over 42 repositories:

| Measure | Value |
|---|---|
| MRR B1 | 0.3628 |
| MRR G | 0.7747 |
| Δ (G − B1) | 0.4119 |
| 95% repository-bootstrap CI | [0.279, 0.5489] |
| p (two-sided Monte Carlo sign-flip, 100,000 assignments, seed 20261023) | 9.9999e-06 |
| Rescues / harms @10 | 14 / 0 |
| Decision | **SUPPORTED** |

## Harm check (protocol §5)

Task A, G vs B1, 14 repositories:

| Measure | Value |
|---|---|
| MRR B1 | 0.6512 |
| MRR G | 0.6452 |
| Δ | −0.006 |
| Harms @10 | 0 |
| Result | **PASS** |

## Sensitivity (protocol §7)

The owner reviewed the 29 S3/S3b events (`owner_review/review_sheet_owner.csv`): 26 confirmed, 3 rejected (django/django, tj/commander.js, trpc/trpc). On S1 + S2 + the owner-confirmed events:

| Repos | MRR B1 | MRR G | Δ | 95% CI | p | Rescues / harms |
|---|---|---|---|---|---|---|
| 39 | 0.3856 | 0.7574 | 0.3718 | [0.2348, 0.5091] | 9.9999e-06 | 12 / 0 |

## Post-hoc descriptive rows

These were added after the confirmatory result and are labelled as post hoc. Template 2 is excluded because B1 returns no candidates above its 0.08 threshold.

| Row | Repos | MRR B1 | MRR G | Δ | 95% CI | p | Rescues / harms |
|---|---|---|---|---|---|---|---|
| B_nl, templates 1 and 3 | 42 | 0.3597 | 0.7569 | 0.3972 | [0.2681, 0.529] | 9.9999e-06 | 24 / 0 |
| S1 only, B_id | 12 | 0.278 | 0.5697 | 0.2917 | [0.0932, 0.5174] | 0.0625 | 3 / 0 |
| S1 only, B_nl | 12 | 0.2044 | 0.5281 | 0.3237 | [0.1218, 0.5496] | 0.03125 | 10 / 0 |

The S1 rows have 12 repositories, so their p-values come from exact enumeration.

## Deviations (protocol.md §9)

1. **Deviation 1.** JavaScript reached 7 repositories after exhausting its catalog in S3 and S3b. Its minimum was relaxed from 8 to 7, for JavaScript only. The confirmatory test is pooled and unaffected.
2. **Deviation 2.** Clones use `git -c core.longpaths=true`. apache/drill, droolsjbpm/drools and elastic/elasticsearch were retried after Windows path-length failures.
3. **Deviation 3.** `*.stories.*` files and `tooling/`, `stories/` and `storybook/` paths are excluded as non-production code. The storybook and webpack selections were re-processed.

The §9 note after the confirmatory result records that the sensitivity analysis was run with the owner verdicts (26/29 confirmed) and that the post-hoc descriptive rows were added afterwards, clearly labelled.

## Integrity flags

- **Integrity checks:** no skipped cases and no parser-unhealthy repository at H = 400. Every event was in window and diffed, and G equalled B1 every time L was empty (`results.json` → `integrity`).
- **droolsjbpm/jbpm:** the target is not in the structural index. Its 4 cases (B_id and three B_nl) count as unranked for every system, so they contribute Δ = 0. The cause was not investigated.
- **pylint-dev/pylint:** 1 history extraction failure (a `.txt` test fixture with no language adapter). The parser stayed healthy; the failure is flagged, not dropped.
- **B_nl template 2** ("What happened to OLD after the refactor?"): B1 never ranks the target. The query's non-identifier words keep structural scores below StructuralRetriever's 0.08 minimum-score threshold.
