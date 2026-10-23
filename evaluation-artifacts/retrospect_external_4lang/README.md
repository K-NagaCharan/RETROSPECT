# External four-language rename benchmark

**Purpose.** This is the confirmatory, pre-registered evaluation of Retrospect's lineage gate **G** against structural retrieval **B1**. It uses externally grounded rename events from repositories never used during development:
- **S1:** the RefactoringMiner oracle (Java);
- **S2:** the PyRef oracle (Python);
- **S3/S3b:** developer-attested renames (Python, JavaScript, TypeScript). The owner reviewed these 29 events and confirmed 26.

The independence unit is the repository (one event per repository). Only retrieval is evaluated, not LLM answers.

**Status:** complete. See [STATUS.md](STATUS.md). The code version is Retrospect tag `eval-v1` (see [VERSION.md](VERSION.md)).

## Layout

| Path | Contents |
|---|---|
| `protocol.md` | Pre-registration, with deviations in §9 |
| `VERSION.md` | Retrospect commit (`eval-v1`) and gate results |
| `STATUS.md` | Final status |
| `REPORT.md`, `paper_tables.md` | Results report and paper tables (Markdown + LaTeX), generated from the analysis files |
| `cases/` | Frozen case set: `cases.jsonl`, `MANIFEST.sha256.json`, `funnel.json`, `exclusion_log.csv`, `review_sheet.csv`, `excluded_repositories.json`; per-repository build results in `work/` |
| `owner_review/review_sheet_owner.csv` | Owner verdicts on the S3/S3b events |
| `runs/external_v1/` | Benchmark output (`case_results.jsonl`, `run_manifest.json`, per-repository `snapshots/`) |
| `analysis/external_v1/` | `results.json`, `per_case.csv` (confirmatory, harm check, descriptive) |
| `analysis/external_v1_posthoc/` | `results_posthoc.json` (sensitivity and post-hoc rows) |
| `phase0/`, `phase1/`, `cli_verify/` | Gate evidence: jest logs, G2/E1 rank comparisons, the G correctness check on the development split |
| `REPOSITORY_INVENTORY.csv` | Clone paths of the 42 repositories (under `D:\clones_external\`) |
| `scripts/` | Everything used to build, run and analyse (below) |
| `logs/` | Build and run logs |

## Authoritative files

- **Confirmatory and harm check:** `analysis/external_v1/results.json`.
- **Sensitivity and post-hoc rows:** `analysis/external_v1_posthoc/results_posthoc.json`.
- **Case set:** `cases/cases.jsonl`, checksummed in `cases/MANIFEST.sha256.json`.
- **Pre-registration:** `protocol.md`.

`REPORT.md` and `paper_tables.md` are generated from these files.

## Reproduce

Retrospect must be checked out at `eval-v1`. Run every command from this folder; outputs refuse to overwrite.

1. **Build the case set** (clones into `D:\clones_external\`, resumable). Freezing writes the case files and checks out each clone at its pin.

   ```bash
   node scripts/build_external_cases.js collect
   node scripts/build_external_cases.js s3b
   node scripts/build_external_cases.js freeze
   ```

2. **Run the benchmark** (B1–B4 and G, H = 400, two repositories in parallel):

   ```bash
   node scripts/run_benchmark_resumable.js --cases cases/cases.jsonl --out runs/<new> --horizons 400 --parallel 2
   ```

3. **Analyse:**

   ```bash
   python -I scripts/analyze_external.py --run runs/<new> --out analysis/<new>
   python -I scripts/analyze_posthoc.py --run runs/<new> --owner owner_review/review_sheet_owner.csv --out analysis/<new>_posthoc
   ```

4. **Write the reports.** `REPORT.md` and `paper_tables.md` already exist, and both scripts refuse to overwrite them.

   ```bash
   python -I scripts/make_report.py --results analysis/<new>/results.json
   python -I scripts/append_posthoc_report.py
   ```

5. **Gate checks:**
   - Rank comparison against a reference:

     ```bash
     python -I scripts/compare_ranks.py --ref <reference CSV> --run <run>
     ```

   - G correctness on the development split:

     ```bash
     node scripts/run_dev_g_check.js
     ```

   - G2 with the unmodified harness: `scripts/run_benchmark_g2_pristine.js`.

`scripts/analyze_benchmark.py`, `mine_events.js`, `verify_events.py`, `run_benchmark.js` and `run_benchmark_resumable.js` are copies of the main benchmark's scripts. Only their paths were changed, except that `run_benchmark.js` and `run_benchmark_resumable.js` also gained G, the B_nl task and parallel runs.
