# Evaluation artifacts

This folder holds **verbatim copies** of Retrospect's two evaluation workspaces, published for the audit trail. It contains every file, including superseded and interrupted runs; only `node_modules/` and `__pycache__/` were left out.

- **Originals unchanged.** The originals under `D:\base papers considered\Test creation\` were not modified, and every copied file was checksum-verified against its original when it was copied.
- **Stored byte for byte.** `.gitattributes` marks this folder `-text`, so git stores the bytes as they are and the checksums inside the workspaces (for example `cases/MANIFEST.sha256.json`, `manifests/`) stay valid.
- **Not in the npm package.** The `files` whitelist in `package.json` excludes this folder, so `retrospect-cli` does not ship it.

**Local paths.** Because the copies are verbatim, they still contain absolute paths from the machine they were produced on. These are clone locations such as `D:\clones\…` and `D:\clones_external\…`, and workspace paths such as `D:\base papers considered\…`. Read those paths as provenance; the files are not edited to remove them. Re-running anything requires your own clones and paths.

## The two workspaces

| Folder | What it is | Ground truth |
|---|---|---|
| [`retrospect_evaluation_2026-10-21/`](retrospect_evaluation_2026-10-21/) | Main four-language benchmark: mined and verified evolution events, cluster-grouped splits, B1–B4 at H = 50/400; v3 runs plus the v4 parser-fix re-measurement | **Machine-verified.** The owner review queue (`review_queue/review_queue.csv`) has not been done |
| [`retrospect_external_4lang/`](retrospect_external_4lang/) | External confirmation: one pre-registered test of the lineage gate G vs B1 on 42 repositories (one rename event each) | Three sources: the RefactoringMiner oracle (Java), the PyRef oracle (Python), and developer-attested renames. The owner reviewed the developer-attested events (`owner_review/review_sheet_owner.csv`) |

## Authoritative files

### Main benchmark: `retrospect_evaluation_2026-10-21/`

| What | File |
|---|---|
| Analysis (authoritative, v4) | `evaluation/analysis/v4_parserfix/BCA/analysis_results.json`, `evaluation/analysis/v4_parserfix/D/analysis_results.json` |
| Re-measurement and E3-Reach comparison | `reports/parserfix_remeasurement.md` |
| As-run v3 analysis (superseded for aborted snapshots) | `evaluation/analysis/BCA_v3/`, `evaluation/analysis/D_v3/`, `reports/final_results.md` |
| Protocols | `reports/evaluation_protocol.md`, `reports/ground_truth_protocol.md`, `reports/deviations_log.md` |
| Frozen cases and splits | `retrieval_cases/`, `ground_truth/`, `manifests/` |
| Status | `README.md`, `PROGRESS_MANIFEST.md`, `DATASET_STATUS.md` |

### External confirmation: `retrospect_external_4lang/`

| What | File |
|---|---|
| Confirmatory test, harm check, descriptive results | `analysis/external_v1/results.json`, `analysis/external_v1/per_case.csv` |
| Sensitivity and post-hoc rows | `analysis/external_v1_posthoc/results_posthoc.json` |
| Pre-registration (deviations in §9) | `protocol.md` |
| Code version | `VERSION.md` (Retrospect tag `eval-v1`) |
| Frozen case set | `cases/cases.jsonl`, `cases/MANIFEST.sha256.json` |
| Reports generated from the files above | `REPORT.md`, `paper_tables.md` |
| Status and layout | `STATUS.md`, `README.md` |

Each workspace's own `README.md` explains how to reproduce it. The repository-wide map of documents and results is in [../docs/DOCS_INDEX.md](../docs/DOCS_INDEX.md).
