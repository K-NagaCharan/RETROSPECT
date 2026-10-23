# External 4-language rename benchmark: report

Pre-registered in `protocol.md` (deviations in §9). Code: Retrospect `eval-v1` (see `VERSION.md`). Every number below is read from `analysis/external_v1/results.json`.

## Funnel

| Language | Source | Repos considered | Excluded | Clone skipped | No valid event | Candidate events | Passed extractor check | Dropped at pin | Selected |
|---|---|---|---|---|---|---|---|---|---|
| java | S1 | 46 | 4 | 6 | 24 | 181 | 45 | 12 | 12 |
| python | S3 | 19 | 5 | 0 | 3 | 420 | 114 | 3 | 11 |
| python | S2 | 3 | 1 | 0 | 1 | 38 | 9 | 0 | 1 |
| javascript | S3 | 25 | 8 | 0 | 12 | 144 | 24 | 7 | 5 |
| javascript | S3b | 12 | 0 | 0 | 10 | 93 | 5 | 2 | 2 |
| typescript | S3 | 25 | 4 | 1 | 9 | 1500 | 139 | 15 | 11 |
| total |  |  |  |  |  |  |  |  | 42 |

## Confirmatory test

| Task | Repos | MRR B1 | MRR G | R@1 B1 | R@1 G | R@10 B1 | R@10 G | Δ (G − B1) | 95% CI | p (two-sided) | Rescues / harms @10 | Decision |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| B_id | 42 | 0.363 | 0.775 | 0.262 | 0.714 | 0.524 | 0.857 | 0.412 | [0.279, 0.549] | 1.0e-05 | 14 / 0 | SUPPORTED |

## Harm check

| Task | Repos | MRR B1 | MRR G | Δ | Harms @10 | Result |
|---|---|---|---|---|---|---|
| A | 14 | 0.651 | 0.645 | -0.006 | 0 | PASS |

## Descriptive results

| Stratum | Comparison | Repos | MRR B1 | MRR sys | Δ | 95% CI | p | Rescues / harms |
|---|---|---|---|---|---|---|---|---|
| B_id | G lineage gate vs B1 | 42 | 0.363 | 0.775 | 0.412 | [0.279, 0.549] | 1.0e-05 | 14 / 0 |
| B_id | B2 historical vs B1 | 42 | 0.363 | 0.653 | 0.290 | [0.125, 0.451] | 0.0015 | 14 / 4 |
| B_id | B3 linear fusion vs B1 | 42 | 0.363 | 0.553 | 0.191 | [0.062, 0.319] | 0.0056 | 14 / 1 |
| B_id | B4 RRF fusion vs B1 | 42 | 0.363 | 0.520 | 0.158 | [0.046, 0.275] | 0.0096 | 10 / 2 |
| B_nl (mean of 3 templates) | G lineage gate vs B1 | 42 | 0.240 | 0.724 | 0.484 | [0.365, 0.604] | 1.0e-05 | 54 / 0 |
| B_nl (mean of 3 templates) | B2 historical vs B1 | 42 | 0.240 | 0.676 | 0.436 | [0.288, 0.579] | 1.0e-05 | 59 / 6 |
| B_nl (mean of 3 templates) | B3 linear fusion vs B1 | 42 | 0.240 | 0.660 | 0.420 | [0.303, 0.536] | 1.0e-05 | 61 / 2 |
| B_nl (mean of 3 templates) | B4 RRF fusion vs B1 | 42 | 0.240 | 0.548 | 0.308 | [0.211, 0.403] | 1.0e-05 | 48 / 3 |
| A | G lineage gate vs B1 | 14 | 0.651 | 0.645 | -0.006 | [-0.018, 0.000] | 1.0000 | 0 / 0 |
| A | B2 historical vs B1 | 14 | 0.651 | 0.275 | -0.376 | [-0.637, -0.088] | 0.0248 | 0 / 7 |
| A | B3 linear fusion vs B1 | 14 | 0.651 | 0.547 | -0.105 | [-0.330, 0.118] | 0.3984 | 0 / 0 |
| A | B4 RRF fusion vs B1 | 14 | 0.651 | 0.548 | -0.103 | [-0.319, 0.116] | 0.3906 | 0 / 1 |

| Language | Task | Repos | MRR B1 | MRR B2 | MRR B3 | MRR B4 | MRR G | Δ G − B1 | 95% CI |
|---|---|---|---|---|---|---|---|---|---|
| java | B_id | 12 | 0.278 | 0.368 | 0.325 | 0.240 | 0.570 | 0.292 | [0.093, 0.517] |
| java | B_nl | 12 | 0.204 | 0.382 | 0.405 | 0.299 | 0.528 | 0.324 | [0.122, 0.550] |
| python | B_id | 12 | 0.533 | 0.628 | 0.681 | 0.669 | 0.836 | 0.303 | [0.056, 0.550] |
| python | B_nl | 12 | 0.347 | 0.662 | 0.722 | 0.612 | 0.766 | 0.418 | [0.211, 0.632] |
| javascript | B_id | 7 | 0.411 | 1.000 | 0.714 | 0.751 | 1.000 | 0.589 | [0.262, 0.873] |
| javascript | B_nl | 7 | 0.270 | 1.000 | 0.845 | 0.790 | 1.000 | 0.730 | [0.508, 0.920] |
| typescript | B_id | 11 | 0.239 | 0.770 | 0.560 | 0.518 | 0.788 | 0.549 | [0.278, 0.813] |
| typescript | B_nl | 11 | 0.142 | 0.805 | 0.752 | 0.595 | 0.717 | 0.576 | [0.343, 0.802] |

| Stratum | Task | Repos | MRR B1 | MRR G | Δ G − B1 | 95% CI |
|---|---|---|---|---|---|---|
| S1+S2 | B_id | 13 | 0.334 | 0.603 | 0.269 | [0.077, 0.487] |
| S1+S2 | B_nl | 13 | 0.240 | 0.564 | 0.324 | [0.138, 0.531] |
| S3+S3b | B_id | 29 | 0.376 | 0.852 | 0.476 | [0.306, 0.641] |
| S3+S3b | B_nl | 29 | 0.240 | 0.796 | 0.556 | [0.417, 0.695] |
| B_nl template 1 | B_nl | 42 | 0.349 | 0.739 | 0.390 | [0.257, 0.524] |
| B_nl template 2 | B_nl | 42 | 0.000 | 0.659 | 0.659 | [0.516, 0.790] |
| B_nl template 3 | B_nl | 42 | 0.370 | 0.775 | 0.404 | [0.269, 0.544] |
| zero subtoken overlap | B_id | 11 | 0.052 | 0.715 | 0.663 | [0.421, 0.888] |
| some overlap | B_id | 31 | 0.473 | 0.796 | 0.323 | [0.176, 0.472] |

Identifiers were extracted from B_nl queries (per template): {'1': 39, '2': 39, '3': 42}. A template without an extracted identifier gives G = B1 by construction.

## Notes on the descriptive results

- **B_nl template 2 ("What happened to OLD after the refactor?").** B1 never ranks the target. Its non-identifier words ("happened", "refactor") match no code, which dilutes structural scores; for most repositories no candidate clears StructuralRetriever's fixed minimum-score threshold (0.08). This is B1's actual behaviour on that phrasing, not a harness fault. G is unaffected because it gates on the extracted identifier.
- **droolsjbpm/jbpm.** The target `JPAAuditLogService.queryLogs` is absent from the structural index at the pin (see *Integrity*), although the extractor found it when the case was built. Its four cases count as unranked for every system, so they contribute Δ = 0 and cannot favour G. The cause was not investigated.
- **pylint-dev/pylint.** One history extraction failure: a test fixture `.txt` file with no language adapter. The parser stayed healthy; the failure is flagged in the cost table, not dropped.

## Cost

| Repository | Clone s | Index s | History s (H400) | Profile size | Median latency B1 ms | Median latency G ms | Extraction failures (index / history) | Parser healthy |
|---|---|---|---|---|---|---|---|---|
| aio-libs/aiohttp | 13.2 | 0.9 | 128.1 | 1887 | 63.5 | 86.2 | 0 / 0 | True |
| angular/angular | 141.2 | 7.3 | 336.6 | 4811 | 135.7 | 187.0 | 0 / 0 | True |
| apache/cassandra | 144.9 | 8.8 | 403.4 | 9620 | 943.6 | 1072.1 | 0 / 0 | True |
| asyml/texar | 1.8 | 0.2 | 81.9 | 517 | 21.3 | 31.4 | 0 / 0 | True |
| babel/babel | 51.8 | 17.5 | 159.9 | 867 | 14.6 | 22.0 | 0 / 0 | True |
| bitcoinj/bitcoinj | 11.0 | 5.1 | 179.5 | 3490 | 356.8 | 431.3 | 0 / 0 | True |
| buildcraft/buildcraft | 12.0 | 2.4 | 331.8 | 3586 | 149.7 | 200.1 | 0 / 0 | True |
| celery/celery | 11.7 | 0.7 | 115.6 | 1835 | 43.5 | 64.0 | 0 / 0 | True |
| date-fns/date-fns | 12.6 | 13.3 | 324.4 | 3064 | 32.9 | 51.2 | 0 / 0 | True |
| django/django | 54.3 | 2.2 | 119.4 | 3018 | 211.3 | 265.6 | 0 / 0 | True |
| droolsjbpm/drools | 211.6 | 13.5 | 441.3 | 10190 | 1189.8 | 1389.0 | 0 / 0 | True |
| droolsjbpm/jbpm | 16.2 | 2.0 | 314.4 | 3286 | 133.4 | 176.8 | 0 / 0 | True |
| encode/starlette | 2.9 | 0.1 | 33.1 | 455 | 5.6 | 8.9 | 0 / 0 | True |
| facebook/presto | 70.7 | 6.1 | 156.6 | 3904 | 471.1 | 570.8 | 0 / 0 | True |
| gcanti/io-ts | 1.8 | 0.2 | 22.8 | 93 | 1.8 | 2.7 | 0 / 0 | True |
| google/closure-compiler | 51.6 | 16.4 | 246.8 | 5147 | 642.4 | 790.9 | 0 / 0 | True |
| gwtproject/gwt | 80.7 | 24.2 | 487.0 | 10137 | 2053.9 | 2332.2 | 0 / 0 | True |
| hazelcast/hazelcast | 127.3 | 13.3 | 299.2 | 10751 | 1873.5 | 2147.7 | 0 / 0 | True |
| ignatov/intellij-erlang | 24.5 | 1.7 | 219.2 | 3526 | 226.7 | 306.9 | 0 / 0 | True |
| infinispan/infinispan | 55.6 | 16.0 | 445.5 | 14471 | 2249.7 | 2585.4 | 0 / 0 | True |
| jashkenas/underscore | 3.2 | 0.9 | 73.5 | 268 | 9.9 | 25.4 | 0 / 0 | True |
| junit-team/junit5 | 12.6 | 1.0 | 157.2 | 1622 | 115.5 | 156.8 | 0 / 0 | True |
| mobxjs/mobx | 10.0 | 0.5 | 144.4 | 492 | 10.2 | 15.2 | 0 / 0 | True |
| nestjs/nest | 137.0 | 5.4 | 86.1 | 604 | 125.8 | 156.8 | 0 / 0 | True |
| pallets/werkzeug | 7.2 | 0.6 | 83.0 | 899 | 26.9 | 40.0 | 0 / 0 | True |
| paramiko/paramiko | 2.7 | 0.2 | 33.4 | 364 | 12.1 | 18.4 | 0 / 0 | True |
| prisma/prisma | 39.8 | 6.7 | 234.9 | 1979 | 135.1 | 192.8 | 0 / 0 | True |
| pydantic/pydantic | 11.8 | 0.9 | 161.2 | 1917 | 67.6 | 103.6 | 0 / 0 | True |
| pylint-dev/pylint | 16.3 | 0.5 | 124.1 | 860 | 42.5 | 59.3 | 0 / 1 | True |
| pypa/pip | 27.1 | 2.2 | 104.2 | 955 | 190.9 | 231.9 | 0 / 0 | True |
| python-trio/trio | 3.0 | 0.5 | 115.8 | 1015 | 36.7 | 53.5 | 0 / 0 | True |
| ramda/ramda | 4.2 | 3.7 | 76.5 | 621 | 45.7 | 59.4 | 0 / 0 | True |
| reduxjs/redux-toolkit | 11.5 | 3.1 | 85.7 | 312 | 43.3 | 54.9 | 0 / 0 | True |
| scikit-learn/scikit-learn | 48.0 | 0.8 | 64.4 | 387 | 63.2 | 76.6 | 0 / 0 | True |
| sindresorhus/ts-extras | 1.3 | 0.4 | 27.3 | 97 | 3.0 | 4.1 | 0 / 0 | True |
| storybookjs/storybook | 269.1 | 23.9 | 65.1 | 190 | 264.2 | 332.2 | 0 / 0 | True |
| tj/commander.js | 2.4 | 2.7 | 77.7 | 239 | 7.7 | 11.9 | 0 / 0 | True |
| trpc/trpc | 36.7 | 1.1 | 88.0 | 320 | 15.3 | 20.8 | 0 / 0 | True |
| typescript-eslint/typescript-eslint | 52.1 | 8.9 | 132.8 | 584 | 152.1 | 187.3 | 0 / 0 | True |
| typestrong/ts-node | 2.1 | 1.5 | 88.8 | 396 | 13.7 | 20.7 | 0 / 0 | True |
| validatorjs/validator.js | 2.7 | 4.1 | 172.8 | 117 | 6.6 | 9.0 | 0 / 0 | True |
| webpack/webpack | 53.4 | 213.3 | 1475.7 | 3915 | 469.2 | 612.1 | 0 / 0 | True |

## Integrity

- **Skipped cases:** 0.
- **Targets not indexed:** 4.
- **Parser unhealthy at H = 400:** none.
- **Events not in window or not diffed at H = 400:** none.
- **Violations of G == B1 when L is empty:** 0.

## Worked examples (rule: per language, the B_id case with the largest RR_G − RR_B1; ties by repository name)

### java: droolsjbpm/drools (S1)

- **Commit:** https://github.com/droolsjbpm/drools/commit/1bf2875e9d73e2d1cd3b58200d5300485f890ff5
- **Rename:** `isHighestSalience` → `isHigherSalience`
- **Target at pin `9acd02bacd`:** `org.drools.core.phreak.RuleExecutor.isHigherSalience` in `drools-core/src/main/java/org/drools/core/phreak/RuleExecutor.java`
- **B_id query `isHighestSalience`, ranks:** B1 37, B2 1, B3 1, B4 8, G 1 (lineage matches: 1)
- **B_nl ranks by template:** T1: B1 175, G 1; T2: B1 —, G 1; T3: B1 69, G 1

### python: pylint-dev/pylint (S3)

- **Commit:** https://github.com/pylint-dev/pylint/commit/8394e37ed45a500b5bde544859fa79568bbbb371
- **Rename:** `show_message` → `show_sourcefile`
- **Target at pin `784ddd5828`:** `LintGui.show_sourcefile` in `gui.py`
- **B_id query `show_message`, ranks:** B1 —, B2 36, B3 53, B4 74, G 1 (lineage matches: 1)
- **B_nl ranks by template:** T1: B1 —, G 1; T2: B1 —, G 1; T3: B1 —, G 1

### javascript: ramda/ramda (S3)

- **Commit:** https://github.com/ramda/ramda/commit/92c182c2d94d2cd5287f08cecb54d97b56938cb0
- **Rename:** `filterObject` → `pickWith`
- **Target at pin `0018f70176`:** `pickWith` in `ramda.js`
- **B_id query `filterObject`, ranks:** B1 —, B2 1, B3 3, B4 7, G 1 (lineage matches: 1)
- **B_nl ranks by template:** T1: B1 112, G 1; T2: B1 —, G 1; T3: B1 —, G 1

### typescript: angular/angular (S3)

- **Commit:** https://github.com/angular/angular/commit/0c600cf6e31b7f69f5a36f7dea959e4884217a4d
- **Rename:** `compileInHost` → `resolveComponent`
- **Target at pin `fad3b6434c`:** `RuntimeCompiler.resolveComponent` in `modules/angular2/src/compiler/runtime_compiler.ts`
- **B_id query `compileInHost`, ranks:** B1 —, B2 1, B3 6, B4 31, G 1 (lineage matches: 1)
- **B_nl ranks by template:** T1: B1 255, G 1; T2: B1 —, G 1; T3: B1 —, G 1

## Sensitivity (protocol §7)

Owner verdicts (`owner_review/review_sheet_owner.csv`): 26 confirmed, 3 rejected (django/django, tj/commander.js, trpc/trpc). The confirmatory statistic was recomputed on S1 + S2 + owner-confirmed S3/S3b. This is sensitivity only; the confirmatory decision (§4) is unchanged. Source: `analysis/external_v1_posthoc/results_posthoc.json`.

| Set | Repos | MRR B1 | MRR G | Δ (G − B1) | 95% CI | p (two-sided) | Rescues / harms @10 |
|---|---|---|---|---|---|---|---|
| S1 + S2 + owner-confirmed S3/S3b (B_id) | 39 | 0.386 | 0.757 | 0.372 | [0.235, 0.509] | 1.0e-05 | 12 / 0 |

## Post-hoc descriptive

**Post hoc: computed after the confirmatory result; descriptive only.**
- **B_nl rows:** template 2 excluded because B1 returns no candidates above its 0.08 threshold.
- **S1-only rows:** RefactoringMiner oracle, Java. 12 repositories, so p comes from exact sign-flip enumeration (≤ 20 units).

Source: `analysis/external_v1_posthoc/results_posthoc.json`.

| Stratum | Comparison | Repos | MRR B1 | MRR sys | Δ | 95% CI | p | Rescues / harms |
|---|---|---|---|---|---|---|---|---|
| B_nl, templates 1 and 3 | G lineage gate vs B1 | 42 | 0.360 | 0.757 | 0.397 | [0.268, 0.529] | 1.0e-05 | 24 / 0 |
| B_nl, templates 1 and 3 | B2 historical vs B1 | 42 | 0.360 | 0.668 | 0.308 | [0.133, 0.477] | 0.0014 | 25 / 6 |
| B_nl, templates 1 and 3 | B3 linear fusion vs B1 | 42 | 0.360 | 0.645 | 0.285 | [0.156, 0.413] | 0.0001 | 27 / 2 |
| B_nl, templates 1 and 3 | B4 RRF fusion vs B1 | 42 | 0.360 | 0.518 | 0.158 | [0.054, 0.263] | 0.0051 | 15 / 3 |
| S1 only (RefactoringMiner, Java), B_id | G lineage gate vs B1 | 12 | 0.278 | 0.570 | 0.292 | [0.093, 0.517] | 0.0625 | 3 / 0 |
| S1 only (RefactoringMiner, Java), B_nl | G lineage gate vs B1 | 12 | 0.204 | 0.528 | 0.324 | [0.122, 0.550] | 0.0312 | 10 / 0 |

