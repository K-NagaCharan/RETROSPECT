# Documentation index

This index covers every Markdown and text document in four places:

| Scope | Location | What is covered |
|---|---|---|
| A | The Retrospect repository | Every Markdown and text document |
| B | `D:\base papers considered\Test creation\` | Top-level files only |
| C | `evaluation-artifacts/retrospect_evaluation_2026-10-21/` (verbatim copy of `…\Test creation\retrospect_evaluation_2026-10-21\`) | `README.md` and `PROGRESS_MANIFEST.md` |
| D | `evaluation-artifacts/retrospect_external_4lang/` (verbatim copy of `…\Test creation\retrospect_external_4lang\`) | Its top-level documents |

Paths in A, C and D are relative to the repository root. C and D are published as verbatim copies under [evaluation-artifacts/](../evaluation-artifacts/), and their originals are unchanged. B is outside the repository, so its paths are given as plain text.

**Classification:**
- **LIVING:** describes the current system or state, and is kept up to date.
- **HISTORICAL:** a dated record. It is kept as written; when a later document replaces it, the last column names that document.

## A. Retrospect repository

| Path | Class | Purpose | Superseded by |
|---|---|---|---|
| [README.md](../README.md) | LIVING | Project entry point: CLI, how it works, architecture, key results, limitations, reproducibility | — |
| [STRUCTURAL_RETRIEVAL.md](../STRUCTURAL_RETRIEVAL.md) | LIVING | Structural (B1) pipeline: discovery, index, scoring, API. Its §6 figures are from the original mini-benchmark (noted in the file) | — |
| [docs/DOCS_INDEX.md](DOCS_INDEX.md) | LIVING | This index | — |
| [DOC_AUDIT.md](../DOC_AUDIT.md) | LIVING | 2026-10-23 documentation audit: actions and number sources | — |
| [LICENSE](../LICENSE) | LIVING | MIT license | — |
| [evaluation-artifacts/README.md](../evaluation-artifacts/README.md) | LIVING | What the two published evaluation workspaces are, which files are authoritative, and the verbatim-copy note | — |
| [docs/demo/ramda_transcript.txt](demo/ramda_transcript.txt) | LIVING | `rtro` demo transcript (ramda, benchmark pin) | — |
| [docs/demo/pylint_transcript.txt](demo/pylint_transcript.txt) | LIVING | `rtro` demo transcript (pylint, benchmark pin) | — |
| [docs/benchmark_schema_specification.md](benchmark_schema_specification.md) | HISTORICAL (2026-10-19 spec; one-line applicability note added) | Case schema for the Category-B evaluator (`BenchmarkCaseLoader.js`) | Case files of the 2026-10-21 benchmark and the external benchmark (see *Where results live*) |
| [docs/per_case_result_schema.md](per_case_result_schema.md) | HISTORICAL (2026-10-19 spec; note added) | Per-case output schema of `RetrospectEvaluator.js` | Harness outputs (`case_results.jsonl`) of the 2026-10-21 and external workspaces |
| [docs/latency_measurement_boundary.md](latency_measurement_boundary.md) | HISTORICAL (2026-10-19 spec; note added) | Latency phases of `RetrospectEvaluator.js` | External benchmark cost table (`results.json` → `descriptive.cost_per_repository`) |
| [docs/RETROSPECT_PROJECT_PROGRESS_REPORT.md](RETROSPECT_PROJECT_PROGRESS_REPORT.md) | HISTORICAL | Earlier project progress report | README.md and this index |
| [docs/phase_d/annotation_guidelines.md](phase_d/annotation_guidelines.md) | HISTORICAL | Phase D annotation and sourcing guidelines | 2026-10-21 ground-truth protocol (eval workspace `reports/ground_truth_protocol.md`) |
| [docs/phase_d/benchmark_protocol.md](phase_d/benchmark_protocol.md) | HISTORICAL | Phase D benchmark protocol | 2026-10-21 evaluation protocol (eval workspace `reports/evaluation_protocol.md`) |
| [docs/phase_d/phase_d_v3_5_correction_report.md](phase_d/phase_d_v3_5_correction_report.md) | HISTORICAL | Phase D v3.4 → v3.5 correction | Same as above |
| [docs/phase_d/phase_d_v3_5_exploratory_protocol.md](phase_d/phase_d_v3_5_exploratory_protocol.md) | HISTORICAL | Phase D v3.5 exploratory protocol | Same as above |
| [docs/phase_d/phase_d_v3_5_supervisor_review_brief.md](phase_d/phase_d_v3_5_supervisor_review_brief.md) | HISTORICAL | Phase D v3.5 review brief | Same as above |
| [Report_change.md](../Report_change.md) | HISTORICAL (2026-10-21) | Project handover report | README.md and this index |
| [exported_packs/phase_c_author_pack/INSTRUCTIONS_FOR_AUTHORS.md](../exported_packs/phase_c_author_pack/INSTRUCTIONS_FOR_AUTHORS.md) | HISTORICAL (generated Phase C pack) | Instructions for blinded query authors | — (Phase C pack not used by later benchmarks) |
| [reports/LEGACY_RESULTS_NOTICE.md](../reports/LEGACY_RESULTS_NOTICE.md) | HISTORICAL (2026-10-19) | Legacy-results status notice | research_corrected_2026-10-21/ |
| [reports/RETROSPECT_DIAGNOSTIC_FAILURE_AUDIT_AND_DECISION.md](../reports/RETROSPECT_DIAGNOSTIC_FAILURE_AUDIT_AND_DECISION.md) | HISTORICAL (2026-10-19) | Diagnostic failure audit and decision | research_corrected_2026-10-21/ |
| [reports/RETROSPECT_EXPERIMENTAL_RESULTS.md](../reports/RETROSPECT_EXPERIMENTAL_RESULTS.md) | HISTORICAL (2026-10-19) | Diagnostic evaluation report | research_corrected_2026-10-21/corrected_experiment_report.md |
| reports/bounded_consistency_audit_2026-10-19/ ([report](../reports/bounded_consistency_audit_2026-10-19/bounded_consistency_audit_report.md), [execution_log](../reports/bounded_consistency_audit_2026-10-19/execution_log.md)) | HISTORICAL | Category-B consistency and lineage audit | research_corrected_2026-10-21/ |
| reports/bounded_evidence_audit_2026-10-19/ ([audit_execution_log](../reports/bounded_evidence_audit_2026-10-19/audit_execution_log.md), [diagnostic_results_reassessment](../reports/bounded_evidence_audit_2026-10-19/diagnostic_results_reassessment.md), [evidence_inventory](../reports/bounded_evidence_audit_2026-10-19/evidence_inventory.md), [final_evidence_decision](../reports/bounded_evidence_audit_2026-10-19/final_evidence_decision.md), [ground_truth_verification_rubric](../reports/bounded_evidence_audit_2026-10-19/ground_truth_verification_rubric.md), [guava_case_reconciliation](../reports/bounded_evidence_audit_2026-10-19/guava_case_reconciliation.md)) | HISTORICAL | Evidence verification audit | research_corrected_2026-10-21/ |
| reports/category_b_benchmark_repair_2026-10-19/ ([benchmark_repair_report](../reports/category_b_benchmark_repair_2026-10-19/benchmark_repair_report.md), [execution_log](../reports/category_b_benchmark_repair_2026-10-19/execution_log.md), [history_lookback_experiment_plan](../reports/category_b_benchmark_repair_2026-10-19/history_lookback_experiment_plan.md), [schema_validation_report](../reports/category_b_benchmark_repair_2026-10-19/schema_validation_report.md), [unresolved_cases](../reports/category_b_benchmark_repair_2026-10-19/unresolved_cases.md)) | HISTORICAL | Category-B benchmark repair (source of `category_b_repaired.json` used by E1/E3) | — (still the E1/E3 dataset record) |
| reports/evaluator_preparation_2026-10-19/ (11 files: [LEGACY_RESULTS_NOTICE](../reports/evaluator_preparation_2026-10-19/LEGACY_RESULTS_NOTICE.md), [benchmark_schema_specification](../reports/evaluator_preparation_2026-10-19/benchmark_schema_specification.md), [dataset_readiness_report](../reports/evaluator_preparation_2026-10-19/dataset_readiness_report.md), [diagnostic_and_improvement_plan](../reports/evaluator_preparation_2026-10-19/diagnostic_and_improvement_plan.md), [engineering_diagnostic_final_report](../reports/evaluator_preparation_2026-10-19/engineering_diagnostic_final_report.md), [engineering_next_steps](../reports/evaluator_preparation_2026-10-19/engineering_next_steps.md), [evaluator_readiness_report](../reports/evaluator_preparation_2026-10-19/evaluator_readiness_report.md), [latency_measurement_boundary](../reports/evaluator_preparation_2026-10-19/latency_measurement_boundary.md), [loader_validation_report](../reports/evaluator_preparation_2026-10-19/loader_validation_report.md), [per_case_result_schema](../reports/evaluator_preparation_2026-10-19/per_case_result_schema.md), [reproducibility_record](../reports/evaluator_preparation_2026-10-19/reproducibility_record.md)) | HISTORICAL | Evaluator preparation (archive copies of the three docs/ specs, plus readiness and diagnostic reports) | research_corrected_2026-10-21/, research_execution_2026-10-21/ |
| [reports/query_processing_verification_2026-10-20/verification_report.md](../reports/query_processing_verification_2026-10-20/verification_report.md) | HISTORICAL (2026-10-20) | Query-processing verification | — |
| research/ ([evaluation_results_report](../research/evaluation_results_report.md), [evidence_inventory](../research/evidence_inventory.md), [expansion_decision](../research/expansion_decision.md), [failure_analysis_report](../research/failure_analysis_report.md), [harness_validation_report](../research/harness_validation_report.md), [implementation_inventory](../research/implementation_inventory.md), [limitations](../research/limitations.md), [paper_outline](../research/paper_outline.md), [reproducibility_record](../research/reproducibility_record.md), [research_question_and_methodology](../research/research_question_and_methodology.md), [research_question_assessment](../research/research_question_assessment.md)) | HISTORICAL (2026-10-20) | 45-case census reports | research_corrected_2026-10-21/ (corrected reporting) |
| research_corrected_2026-10-21/ ([README](../research_corrected_2026-10-21/README.md), [corrected_experiment_report](../research_corrected_2026-10-21/corrected_experiment_report.md), [discrepancy_log](../research_corrected_2026-10-21/discrepancy_log.md), [CHANGE_NOTE_stage_a_horizon_fix](../research_corrected_2026-10-21/CHANGE_NOTE_stage_a_horizon_fix.md), [ground_truth_adjudication_evidence](../research_corrected_2026-10-21/ground_truth_adjudication_evidence.md)) | HISTORICAL (2026-10-21) | Corrected reporting of the 45-case census; E1 reference ranks | — (authoritative for the census and the E1 reference) |
| [research_corrected_2026-10-21/FINALIZATION_PLAN.md](../research_corrected_2026-10-21/FINALIZATION_PLAN.md) | HISTORICAL (2026-10-21) | Paper finalization plan | research_execution_2026-10-21/ and the two evaluation workspaces |
| [research_corrected_2026-10-21/FOUR_LANGUAGE_REASSESSMENT.md](../research_corrected_2026-10-21/FOUR_LANGUAGE_REASSESSMENT.md) | HISTORICAL (2026-10-21) | Four-language evaluation plan | The 2026-10-21 main benchmark workspace |
| [research_execution_2026-10-21/EXPERIMENT_REPORT.md](../research_execution_2026-10-21/EXPERIMENT_REPORT.md) | HISTORICAL (2026-10-21) | E1/E2 execution-sprint report | — (E1/E2 record) |
| [research_execution_2026-10-21/NEXT_ACTION_REPORT.md](../research_execution_2026-10-21/NEXT_ACTION_REPORT.md) | HISTORICAL (2026-10-21) | Extraction fixes and next actions | RESEARCH_READINESS_DECISION.md |
| [research_execution_2026-10-21/RESEARCH_READINESS_DECISION.md](../research_execution_2026-10-21/RESEARCH_READINESS_DECISION.md) | HISTORICAL (2026-10-21) | Readiness decision before E3-Reach | E3_REACH_REPORT.md |
| [research_execution_2026-10-21/ADJUDICATION_DECISION_TABLE.md](../research_execution_2026-10-21/ADJUDICATION_DECISION_TABLE.md) | HISTORICAL (2026-10-21) | Ground-truth adjudication decisions | — |
| [research_execution_2026-10-21/E3_REACH_PREREGISTRATION.md](../research_execution_2026-10-21/E3_REACH_PREREGISTRATION.md) | HISTORICAL (pre-registered) | E3-Reach pre-registration | — |
| [research_execution_2026-10-21/E3_reach_analysis/E3_REACH_REPORT.md](../research_execution_2026-10-21/E3_reach_analysis/E3_REACH_REPORT.md) | HISTORICAL (2026-10-21) | E3-Reach result | — (confirmed unchanged with fixed code; see the parser-fix re-measurement) |
| [research_execution_2026-10-21/E_lineage/E_LINEAGE_REPORT.md](../research_execution_2026-10-21/E_lineage/E_LINEAGE_REPORT.md) | HISTORICAL | Per-language lineage attribution (Phase B) | — |
| [research_execution_2026-10-21/diagnosis_zod/DIAGNOSIS.md](../research_execution_2026-10-21/diagnosis_zod/DIAGNOSIS.md) | HISTORICAL (2026-10-22) | Why B2 scored near zero on zod | — |
| research_execution_2026-10-21/*_stdout.txt, *_comparison.txt (12 files) | HISTORICAL | Run logs and E1 comparisons | — |
| research_execution_2026-10-21/*/worker_log__*.txt (36 files) | HISTORICAL | Per-snapshot worker logs (E1, E2, E3-Reach runs, including the parser-fix re-runs) | — |

## B. `Test creation\` (top level)

| Path | Class | Purpose | Superseded by |
|---|---|---|---|
| `Test creation\README.md` | HISTORICAL (2026-10-16; banner added) | Dataset repository overview | `retrospect_evaluation_2026-10-21\` and `retrospect_external_4lang\` |
| `Test creation\DATASET_CATALOG.md` | HISTORICAL (2026-10-19; banner added) | Catalog of acquired and custom datasets. Its legacy custom datasets and recycled-SHA finding are superseded | The 2026-10-21 benchmark (`retrospect_evaluation_2026-10-21\`) |
| `Test creation\DATASET_RESEARCH_REPORT.md` | HISTORICAL (2026-10-16; banner added) | Benchmark-landscape synthesis | Same two workspaces |
| `Test creation\Report_dataset.md` | HISTORICAL (2026-10-19; banner added) | Dataset architecture dossier | Same two workspaces |
| `Test creation\debug_out.txt` | HISTORICAL | Debug output | — |

## C. [`evaluation-artifacts/retrospect_evaluation_2026-10-21/`](../evaluation-artifacts/retrospect_evaluation_2026-10-21/) (main four-language benchmark)

| Path | Class | Purpose | Superseded by |
|---|---|---|---|
| [README.md](../evaluation-artifacts/retrospect_evaluation_2026-10-21/README.md) | LIVING (Status 2026-10-23 added) | Workspace entry point | — |
| [PROGRESS_MANIFEST.md](../evaluation-artifacts/retrospect_evaluation_2026-10-21/PROGRESS_MANIFEST.md) | LIVING (v4 row added) | Steps and resume commands | — |

## D. [`evaluation-artifacts/retrospect_external_4lang/`](../evaluation-artifacts/retrospect_external_4lang/) (external confirmation)

| Path | Class | Purpose | Superseded by |
|---|---|---|---|
| [README.md](../evaluation-artifacts/retrospect_external_4lang/README.md) | LIVING (new) | Workspace entry point: layout, reproduction, authoritative files | — |
| [STATUS.md](../evaluation-artifacts/retrospect_external_4lang/STATUS.md) | LIVING (rewritten: COMPLETE) | Final status of Phases 0–5 | — |
| [VERSION.md](../evaluation-artifacts/retrospect_external_4lang/VERSION.md) | LIVING | Code version (`eval-v1`) and gates | — |
| [protocol.md](../evaluation-artifacts/retrospect_external_4lang/protocol.md) | HISTORICAL (pre-registered; §9 deviations appended at the time) | Pre-registration | — |
| [REPORT.md](../evaluation-artifacts/retrospect_external_4lang/REPORT.md) | HISTORICAL (generated from `results.json`; sensitivity and post-hoc sections appended) | Results report | — |
| [paper_tables.md](../evaluation-artifacts/retrospect_external_4lang/paper_tables.md) | HISTORICAL (generated) | Paper tables (Markdown + LaTeX) | — |

## Where results live

Paths below are relative to the repository root. `EA/` stands for `evaluation-artifacts/`.

| Experiment | Authoritative files | Notes |
|---|---|---|
| **E1** (Java rename case study, reproduction) | `research_execution_2026-10-21/E1_after_fix2/per_case_results.csv`, with the reference `research_corrected_2026-10-21/per_case_results_corrected.csv` | 116/116 ranks reproduced (`E1_after_fix2_comparison.txt`). Re-checked at `eval-v1`: `EA/retrospect_external_4lang/phase0/e1_compare.txt` |
| **E2** (Phase B, four languages) | `research_execution_2026-10-21/E2_after_fix2/per_case_results.csv` | Harness equivalence (G2, 136/136): `EA/retrospect_external_4lang/phase0/g2_compare.txt` and `EA/retrospect_external_4lang/cli_verify/g2_compare.txt` |
| **E3-Reach** (pre-registered, Java, H = 400) | `research_execution_2026-10-21/E3_reach_analysis/e3_reach_results.json` (original). Fixed code: `research_execution_2026-10-21/E3_reach_parserfix_analysis/e3_reach_results.json` | Comparison: [EA/retrospect_evaluation_2026-10-21/reports/parserfix_remeasurement.md](../evaluation-artifacts/retrospect_evaluation_2026-10-21/reports/parserfix_remeasurement.md) (0 of 72 ranks changed) |
| **E-Lineage** | `research_execution_2026-10-21/E_lineage/e_lineage_results.json` | — |
| **Main four-language benchmark, v3** (as run) | `EA/retrospect_evaluation_2026-10-21/evaluation/analysis/BCA_v3/`, `…/D_v3/` (and `reports/final_results.md`) | Superseded for the snapshots that hit the parser abort |
| **Main four-language benchmark, v4** (parser fix): **authoritative** | `EA/retrospect_evaluation_2026-10-21/evaluation/analysis/v4_parserfix/BCA/analysis_results.json`, `…/v4_parserfix/D/analysis_results.json` | Re-measurement report: `reports/parserfix_remeasurement.md`. Labels are machine-verified; the review queue is not done |
| **External confirmation** (pre-registered) | [EA/retrospect_external_4lang/analysis/external_v1/results.json](../evaluation-artifacts/retrospect_external_4lang/analysis/external_v1/results.json), `per_case.csv` | Report: `REPORT.md`. Pre-registration: `protocol.md` |
| **Sensitivity and post-hoc rows** | [EA/retrospect_external_4lang/analysis/external_v1_posthoc/results_posthoc.json](../evaluation-artifacts/retrospect_external_4lang/analysis/external_v1_posthoc/results_posthoc.json) | Owner verdicts: `EA/retrospect_external_4lang/owner_review/review_sheet_owner.csv` (26/29 confirmed) |
