# Current evidence inventory (2026-10-21)

**How this was built.**
- Dates are file modification times read from disk; row counts are read from the files themselves.
- `R` = `D:\base papers considered\Retrospect`; `T` = `D:\base papers considered\Test creation`.
- All Retrospect code that produced these results is **uncommitted** (HEAD `17ea399`) and identified by SHA-256 fingerprints in each run manifest.

**Kind of content:**

| Code | Meaning |
|---|---|
| RAW | Case-level observations (ranks) |
| GT | Ground truth or labels |
| DER | Derived metrics |
| DOC | Report describing other files |

**Independence.** Each row of a results file is one query (case). Several cases can share one evolution commit (a *cluster*), so clusters are the independent unit. The four configurations for one case are not four observations.

## A. Experiment outputs

| Artifact | Kind | Experiment | Date | Pins / commits | Cases (clusters) | Languages | Status |
|---|---|---|---|---|---|---|---|
| `R\research_execution_2026-10-21\E1_java_reproduction\per_case_results.csv` | RAW | E1 Java at H = 50, code before fixes | 2026-10-21 21:35 | checkstyle `10a3a07`, graphhopper `c7497d1`, undertow `cf3abec`, java-driver `f424026` | 29 (18) | Java | **Usable**: 116/116 ranks identical to the reference (`E1_comparison.txt`) |
| `…\E1_after_fix\…`, `…\E1_after_fix2\per_case_results.csv` | RAW | E1 reruns after the extraction fixes | 22:09 (fix2) | same | 29 (18) | Java | **Usable**: identical ranks; fix2 is the current code |
| `R\research_corrected_2026-10-21\per_case_results_corrected.csv` | RAW + GT roles | 2026-10-20 census, relabelled | 20:05 | 14 repositories | 45 (+1 excluded) | 4 languages | **Reference** for E1. Its 11 cross-language cases include 8 with missing origin commits. |
| `R\research_execution_2026-10-21\E2_phase_b_four_language\per_case_results.csv` | RAW | E2 Phase B, code before fixes | 21:34 | bottle `8ec5fe2`, express `a419aa7`, gson `845664b`, zod `284243f` (shallow clones) | 34 | 4 languages | **Superseded** by `E2_after_fix2` for TypeScript; identical for Java, Python and JavaScript |
| `…\E2_after_fix\per_case_results.csv` | RAW | E2, first fix | 21:54 | same | 34 | 4 | **Superseded**: the factory rule was too broad (8 false-positive symbols in express) |
| `…\E2_after_fix2\per_case_results.csv` | RAW | E2, current code | 22:07 | same | 34 (32 clusters) | 4 | **Usable, development data only** |
| `…\E3_reach\per_case_results.csv` (+ `run_manifest.json`) | RAW | E3-Reach Java at H = 400, pre-registered | 23:25 | as E1 | 29 run; **18 primary (13 clusters)** | Java | **Usable**: valid (B1 identical to H = 50) |
| `…\E3_reach_analysis\e3_reach_results.json` | DER | E3-Reach pre-registered analysis | — | — | — | Java | **Authoritative** primary outcome; re-verified (§`CURRENT_PROJECT_RESULTS`) |
| `…\E_lineage\e_lineage_results.json/.csv` | RAW | E-Lineage, commit→symbol attachment | 22:22 | Phase B pins | 21 (20 clusters) | 4 | **Usable**, development data |
| `…\E_lineage_v1_superseded_matcher_bug\` | RAW | E-Lineage first attempt | 22:19 | — | 21 | 4 | **Invalid**: the target matcher lacked the `qualifiedName` rule |
| `T\experiments\final_multirepo_evaluation_merge_aware_2026-10-20\per_case_results.csv` | RAW | Original 2026-10-20 census | 2026-10-20 20:25 | 14 repositories | 45 | 4 | **Superseded labels**: `rev-list`-based horizon status; its ranks are identical to the reference |
| `T\experiments\final_multirepo_evaluation_audit_2026-10-20\corrected_per_case_results.csv` | RAW + DER | Audit of the census | 20:47 | — | 45 | 4 | Usable as the source for the reference file |
| `R\research\per_case_empirical_results.csv` and the rest of `R\research\*` | DER + DOC | Oct 20 paper-facing tables | 2026-10-20 21:16 | — | 45 | 4 | **Defective**: empty distance/stage columns; B3 = B4 copy error in the report (see `R\research_corrected_2026-10-21\discrepancy_log.md`) |
| `T\results\current_version_diagnostic_2026-10-19\case_results.csv` | RAW | Oct 19 diagnostic, older code | 2026-10-19 19:33 | Category A + B | 34 | 4 | **Superseded** (different code version; e.g. 0049 history-only abstained there) |
| `R\data\phase_b_evaluation_results.json` / `…_stitched.json` | RAW + DER | Phase B (Oct 13–14), RRF-v1, history depth 80–140 | 2026-10-14 | shallow clones | 40 queries | 4 | **Superseded protocol**; its "0% false positive" figure is invalid (0.20 threshold artefact) |

## B. Datasets and ground truth

| Artifact | Kind | Cases | Languages | Ground-truth status | Status |
|---|---|---|---|---|---|
| `T\results\category_b_benchmark_repair_2026-10-19\category_b_repaired.json` | GT | 29 (18 commits) | Java | RefactoringMiner renames + automated audit: 5 verified / 20 needs_review / 4 rejected | **Primary Java set** (not pristine held-out) |
| `R\research_corrected_2026-10-21\ground_truth_adjudication.csv` | GT | 11 | Java | **Owner adjudication complete** (2026-10-21) | Authoritative for the in-window cases |
| `R\research_execution_2026-10-21\e3_reach_case_sets.json` + `E3_REACH_PREREGISTRATION.md` | GT + DOC | 25 eligible → 18 primary | Java | Owner-approved policy; the outside-window 11 are classified by automated audit + diff checks (not human) | Authoritative |
| `R\data\benchmark_lineage_audited_v3.json` + `evaluation_lineage_queries_v4.json` | GT | 40 (34 with a target) | 4 | "manually_verified" / "verified_with_corrections" (reported). **py_bot_01 label inconsistent** (retarget decided), ts_zod_04 chain policy, ts_zod_08 factory-only. | **Development data** |
| `T\datasets\historical_pilot_v1_2026-10-20\` | GT | 12 | Python, JS, TS | 8 of 11 evaluated cases cite origin commits **absent** from the clones | **Invalid** for history claims |
| `T\benchmarks\splits\*.json` | GT | 436 | 4 | Legacy catalog; synthetic and recycled SHAs found by audits | **Superseded** |
| `T\datasets\retrospect_historical_rescue_v1\` | GT | 14 | 4 | Relabelled census cases; never evaluated | Not independent; do not reuse as new data |

## C. Documentation (DOC only, no observations)

`R\Report_change.md`; `R\research_corrected_2026-10-21\*.md`; `R\research_execution_2026-10-21\{EXPERIMENT_REPORT, NEXT_ACTION_REPORT, RESEARCH_READINESS_DECISION, ADJUDICATION_DECISION_TABLE, E3_REACH_PREREGISTRATION}.md`; `…\E3_reach_analysis\E3_REACH_REPORT.md`; `…\E_lineage\E_LINEAGE_REPORT.md`; `…\diagnosis_zod\DIAGNOSIS.md`.

The observations in these reports trace back to the RAW files above. `CURRENT_PROJECT_RESULTS.*` recomputes everything from RAW.

## D. Unresolved provenance problems

1. **Uncommitted code.** Every run is tied to SHA-256 fingerprints, not a git revision.
2. **Shallow clones for Phase B.** `data/external_repos/*` hold 148–1,675 commits, which limits history depth beyond the window.
3. **No pristine held-out data.** Category B appeared in diagnostics; Phase B was used to choose fusion.
4. **Outside-window Java cases** are classified by the automated audit plus diff checks, not by human adjudication.
