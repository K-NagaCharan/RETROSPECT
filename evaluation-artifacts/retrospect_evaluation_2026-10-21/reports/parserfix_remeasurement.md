# Parser-fix re-measurement (Deviation 2)

**Re-measurement with corrected software; no parameters changed.** See `reports/deviations_log.md` (Deviation 2) for the code, commits and procedure.

**Versions compared:**
- **v3:** `evaluation/analysis/BCA_v3`, `D_v3`.
- **v4:** `evaluation/analysis/v4_parserfix/{BCA,D}`, which is v3 with the aborted snapshots replaced by their re-runs.

## Gates

| Gate | Check | Result |
|---|---|---|
| G1 | E1 reproduces 116/116 reference ranks | PASS (116/116 ranks, 29/29 cases) |
| G2 | Harness equivalence reproduces 136/136 E2 ranks | PASS (136/136 ranks, 34/34 cases) |
| G3 | guava 317 KB stress + full guava H=400 pass, healthy probe, extractionFailures=0 | PASS (stress 6000/6000; index 66211 symbols, failures 0; H=400 399 commits, 25548 symbols with history, failures 0; probe healthy True) |

## Re-run snapshots

**History-profile size** is the number of current symbols with at least one history record. v3 did not record it; it was added to the harness by this fix. **Failures** are counted as structural / history H=50 / history H=400.

| v3 run | Repository | Symbols v3 → v4 | Parser healthy after H400, v3 → v4 | Profile size v4 (H50 / H400) | Failures v4 | Clean at pin before and after |
|---|---|---|---|---|---|---|
| development_BCA_v3 | guava | 66211 → 66211 | False → True | 3615 / 25548 | 0 / 0 / 0 | True |
| development_BCA_v3 | zod | 3674 → 3674 | False → True | 446 / 1872 | 0 / 0 / 0 | True |
| development_D_v3 | typeorm | 7504 → 7504 | False → True | 6838 / 7494 | 0 / 0 / 0 | True |
| development_D_v3 | guava | 66211 → 66211 | False → True | 3615 / 25548 | 0 / 0 / 0 | True |
| development_D_v3 | zod | 3674 → 3674 | False → True | 446 / 1872 | 0 / 0 / 0 | True |
| held_out_test_BCA_v3 | typeorm | 7504 → 7504 | False → True | 6838 / 7494 | 0 / 0 / 0 | True |
| held_out_test_BCA_v3 | lodash | 4438 → 4438 | False → True | 165 / 333 | 0 / 0 / 0 | True |
| held_out_test_D_v3 | lodash | 4438 → 4438 | False → True | 165 / 333 | 0 / 0 / 0 | True |
| held_out_test_D_v3 | moment | 7609 → 7609 | False → True | 951 / 2475 | 0 / 0 / 0 | True |
| held_out_test_D_v3 | typeorm | 7504 → 7504 | False → True | 6838 / 7494 | 0 / 0 / 0 | True |
| validation_D_v3 | moment | 7609 → 7609 | False → True | 951 / 2475 | 0 / 0 / 0 | True |

## Primary analysis (pre-registered; held-out, B_identifier, target indexed, in window and diffed at H = 400; B4 vs B1)

| Language | Version | Cases | Clusters | MRR B1 | MRR B4 | ΔMRR | p (exact) | p (Holm) | Rescues / harms | Decision |
|---|---|---|---|---|---|---|---|---|---|---|
| java | v3 | 6 | 6 | 0.085 | 0.233 | 0.148 | 0.0312 | 0.1250 | 2 / 0 | INCONCLUSIVE |
| java | v4 | 6 | 6 | 0.085 | 0.233 | 0.148 | 0.0312 | 0.1250 | 2 / 0 | INCONCLUSIVE |
| java | sensitivity (parser-healthy only) v3 → v4 | 6 → 6 | | | | 0.148 → 0.148 | 0.0312 → 0.0312 | | | |
| python | v3 | 2 | 2 | 0.667 | 0.667 | 0.000 | 1.0000 | 1.0000 | 0 / 0 | NOT_TESTABLE (<6 clusters) |
| python | v4 | 2 | 2 | 0.667 | 0.667 | 0.000 | 1.0000 | 1.0000 | 0 / 0 | NOT_TESTABLE (<6 clusters) |
| python | sensitivity (parser-healthy only) v3 → v4 | 2 → 2 | | | | 0.000 → 0.000 | 1.0000 → 1.0000 | | | |
| javascript | v3 | 1 | 1 | 0.333 | 0.500 | 0.167 | 1.0000 | 1.0000 | 0 / 0 | NOT_TESTABLE (<6 clusters) |
| javascript | v4 | 1 | 1 | 0.333 | 0.500 | 0.167 | 1.0000 | 1.0000 | 0 / 0 | NOT_TESTABLE (<6 clusters) |
| javascript | sensitivity (parser-healthy only) v3 → v4 | 1 → 1 | | | | 0.167 → 0.167 | 1.0000 → 1.0000 | | | |
| typescript | v3 | 5 | 3 | 0.704 | 0.729 | 0.013 | 1.0000 | 1.0000 | 1 / 0 | NOT_TESTABLE (<6 clusters) |
| typescript | v4 | 5 | 3 | 0.704 | 0.729 | 0.013 | 1.0000 | 1.0000 | 1 / 0 | NOT_TESTABLE (<6 clusters) |
| typescript | sensitivity (parser-healthy only) v3 → v4 | 4 → 5 | | | | 0.020 → 0.013 | 1.0000 → 1.0000 | | | |

## Pooled held-out Task B (descriptive)

| Stratum | Version | Cases / clusters | MRR B1 | B2 | B3 | B4 | B4 − B1 (cluster) | p | Rescues / harms |
|---|---|---|---|---|---|---|---|---|---|
| in window, H = 400 | v3 | 14 / 12 | 0.407 | 0.650 | 0.528 | 0.491 | +0.091 | 0.00781 | 3 / 0 |
| in window, H = 400 | v4 | 14 / 12 | 0.407 | 0.650 | 0.528 | 0.491 | +0.091 | 0.00781 | 3 / 0 |
| all indexed, H = 400 | v3 | 63 / 49 | 0.433 | 0.249 | 0.357 | 0.271 | -0.082 | 0.153 | 4 / 22 |
| all indexed, H = 400 | v4 | 63 / 49 | 0.433 | 0.249 | 0.346 | 0.270 | -0.084 | 0.146 | 4 / 23 |
| all indexed, H = 50 | v3 | 63 / 49 | 0.433 | 0.088 | 0.305 | 0.170 | -0.214 | 1e-05 | 3 / 17 |
| all indexed, H = 50 | v4 | 63 / 49 | 0.433 | 0.088 | 0.305 | 0.170 | -0.214 | 1e-05 | 3 / 17 |

## Task D false-lineage-claim rate (B2 top-10 lists the deleted name)

| Split / language | H | Cases / clusters | v3 | v4 |
|---|---|---|---|---|
| development / java | 400 | 20 / 14 | 0.0000 | 0.0000 |
| development / javascript | 400 | 7 / 6 | 0.0000 | 0.0000 |
| development / pooled | 400 | 93 / 60 | 0.0108 | 0.0108 |
| development / python | 400 | 42 / 23 | 0.0000 | 0.0000 |
| development / typescript | 400 | 24 / 17 | 0.0417 | 0.0417 |
| held_out_test / java | 400 | 567 / 34 | 0.0000 | 0.0000 |
| held_out_test / javascript | 400 | 61 / 40 | 0.0000 | 0.0000 |
| held_out_test / pooled | 400 | 903 / 180 | 0.0000 | 0.0000 |
| held_out_test / python | 400 | 155 / 70 | 0.0000 | 0.0000 |
| held_out_test / typescript | 400 | 120 / 36 | 0.0000 | 0.0000 |
| validation / java | 400 | 78 / 9 | 0.0000 | 0.0000 |
| validation / javascript | 400 | 23 / 11 | 0.0000 | 0.0000 |
| validation / pooled | 400 | 151 / 41 | 0.0000 | 0.0000 |
| validation / python | 400 | 23 / 10 | 0.0000 | 0.0000 |
| validation / typescript | 400 | 27 / 11 | 0.0000 | 0.0000 |
| development / java | 50 | 20 / 14 | 0.0000 | 0.0000 |
| development / javascript | 50 | 7 / 6 | 0.0000 | 0.0000 |
| development / pooled | 50 | 93 / 60 | 0.0108 | 0.0108 |
| development / python | 50 | 42 / 23 | 0.0000 | 0.0000 |
| development / typescript | 50 | 24 / 17 | 0.0417 | 0.0417 |
| held_out_test / java | 50 | 567 / 34 | 0.0000 | 0.0000 |
| held_out_test / javascript | 50 | 61 / 40 | 0.0164 | 0.0164 |
| held_out_test / pooled | 50 | 903 / 180 | 0.0011 | 0.0011 |
| held_out_test / python | 50 | 155 / 70 | 0.0000 | 0.0000 |
| held_out_test / typescript | 50 | 120 / 36 | 0.0000 | 0.0000 |
| validation / java | 50 | 78 / 9 | 0.0000 | 0.0000 |
| validation / javascript | 50 | 23 / 11 | 0.0000 | 0.0000 |
| validation / pooled | 50 | 151 / 41 | 0.0000 | 0.0000 |
| validation / python | 50 | 23 / 10 | 0.0000 | 0.0000 |
| validation / typescript | 50 | 27 / 11 | 0.0000 | 0.0000 |

## E3-Reach (Java, H = 400, 18 primary cases), original vs fixed code

| Case | B1 original → fixed | B2 original → fixed | B3 original → fixed | B4 original → fixed |
|---|---|---|---|---|
| CASE-HIST-JAVA-0013 | — | 2 | 4 | 13 |
| CASE-HIST-JAVA-0049 | 14 | 4 | 4 | 2 |
| CASE-HIST-JAVA-0044 | 4 | 3 | 2 | 2 |
| CASE-HIST-JAVA-0045 | 8 | 5 | 4 | 4 |
| CASE-HIST-JAVA-0046 | 10 | 6 | 6 | 7 |
| CASE-HIST-JAVA-0047 | 8 | 166 | 44 | 32 |
| CASE-HIST-JAVA-0105 | 4 | 3 | 2 | 3 |
| CASE-HIST-JAVA-0101 | 10 | 3 | 2 | 2 |
| CASE-HIST-JAVA-0096 | 7 | 3 | 3 | 3 |
| CASE-HIST-JAVA-0097 | 33 | 5 | 6 | 6 |
| CASE-HIST-JAVA-0099 | 57 | 5 | 6 | 6 |
| CASE-HIST-JAVA-0055 | 7 | 3 | 3 | 3 |
| CASE-HIST-JAVA-0058 | 6 | 6 | 6 | 3 |
| CASE-HIST-JAVA-0078 | 3 | 759 | 10 | 24 |
| CASE-HIST-JAVA-0043 | 7 | 174 | 9 | 8 |
| CASE-HIST-JAVA-0001 | 11 | 3 | 3 | 4 |
| CASE-HIST-JAVA-0028 | 2 | 3 | 2 | 2 |
| CASE-HIST-JAVA-0029 | 3 | 1 | 2 | 2 |

Rank changes: 0 of 72 (case, configuration) cells.

| Headline | Original | Fixed |
|---|---|---|
| Valid | True | True |
| MRR B1 | 0.1623 | 0.1623 |
| MRR B4 | 0.2825 | 0.2825 |
| ΔMRR B4 − B1 (cluster mean) | +0.1068 | +0.1068 |
| Exact two-sided p | 0.06641 | 0.06641 |
| Fusion rescues / harms @10 | 4 / 2 | 4 / 2 |
| Outcome | INCONCLUSIVE | INCONCLUSIVE |

## Materiality

An item **changed materially** if any MRR moved by at least 0.02, or any decision, rescue count or harm count changed.

- Primary java: unchanged
- Primary python: unchanged
- Primary javascript: unchanged
- Primary typescript: unchanged
- Pooled held-out Task B, in window, H = 400: unchanged
- Pooled held-out Task B, all indexed, H = 400: changed materially
- Pooled held-out Task B, all indexed, H = 50: unchanged
- Task D false-claim rates: unchanged
- E3-Reach primary: unchanged
