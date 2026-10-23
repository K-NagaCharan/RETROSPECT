# Documentation audit (2026-10-23)

**Scope:**

| Scope | Location |
|---|---|
| A | Retrospect repository |
| B | `Test creation\` (top-level files) |
| C | `retrospect_evaluation_2026-10-21\` (`README.md`, `PROGRESS_MANIFEST.md`) |
| D | `retrospect_external_4lang\` (`STATUS.md`, new `README.md`) |

The full classification of every document is in [docs/DOCS_INDEX.md](docs/DOCS_INDEX.md).

**Rules followed:**
- No code, test, data, result, manifest, protocol, frozen case set or dated report was edited. The three dated specs got the one-line applicability note asked for in step 3, and their content is otherwise unchanged.
- Every number written comes from the source cited in *Number sources* below.

## Summary

| Doc | Scope | Action | What was wrong |
|---|---|---|---|
| `README.md` | A | **updated** (rewritten as the canonical entry point) | Wrong architecture tree (listed files that do not exist: `StructuralDiscovery.js`, `StructuralIndex.js` at the wrong path, `StructuralQueryUnderstanding.js`, `SymbolContextBuilder.js`, `CodeSearchEngine.js`; missing `cli/`, `llm/`, `LineageGate.js`, `RRFv2.js`, `historyWindow.js`). API example used fields that do not exist (`hit.kind`, `hit.startLine`, `hit.historicalProfile`, a numeric `timingMs`) and the package name `retrospect`. Stale test count. Benchmark tables (Phase 1, structural mini-benchmark, Phase B) were not from current authoritative sources and presented RRF as superior; the current evidence shows fusion harms on all-indexed queries. No lineage gate, external confirmation, limitations or reproducibility tags. Kept: language table, FunctionMatcher tiers and thresholds (re-verified in `src/matcher/FunctionMatcher.js`), CLI usage section (flags re-verified with `rtro <cmd> --help`) |
| `STRUCTURAL_RETRIEVAL.md` | A | **updated** (inaccuracies only) | Exact-name weight 0.40 → 0.35. Graph term was "up to +0.08 boost" → weight 0.05 × graph score 0.8/0.6. Minimum threshold 0.12 → 0.08. Symbol ID format. `index.updateFiles(...)` → `updateIncremental(repoPath)`. Adapter registration (`src/languages/index.js` does not exist → `LanguageAdapterRegistry.js`). Adapter method signatures. API example (`cacheDir` → `persistPath`; `res.rank`/`res.startLine`/`res.code` → index, `range.startLine`, `source`; `getSymbol`/`getRelatedSymbols` take `repoPath` and are async). Added a note that the §6 figures are the original mini-benchmark, not re-measured |
| `docs/benchmark_schema_specification.md` | A | **note added** (one line) | Dated 2026-10-19 spec for the Category-B evaluator; added "Applies to" note |
| `docs/per_case_result_schema.md` | A | **note added** (one line) | Same; applies to `RetrospectEvaluator.js` output |
| `docs/latency_measurement_boundary.md` | A | **note added** (one line) | Same; the note also corrects "BM25" (structural scoring is a multi-signal weighted scorer) |
| `docs/DOCS_INDEX.md` | A | **created** | — |
| `DOC_AUDIT.md` | A | **created** | — |
| `docs/demo/*.txt`, `LICENSE` | A | unchanged | — |
| `Report_change.md`, `docs/RETROSPECT_PROJECT_PROGRESS_REPORT.md`, `docs/phase_d/*.md` (5), `reports/**/*.md` (28), `research/*.md` (11), `research_corrected_2026-10-21/*.md` (7), `research_execution_2026-10-21/**/*.md` (8), `research_execution_2026-10-21/**/*.txt` (48), `exported_packs/phase_c_author_pack/INSTRUCTIONS_FOR_AUTHORS.md` | A | **classified only** (HISTORICAL; superseded-by recorded in DOCS_INDEX) | — (dated records; not edited) |
| `Test creation\README.md` | B | **banner added** | Described the original plan (three configurations, custom datasets); not the current evaluation |
| `Test creation\DATASET_CATALOG.md` | B | **banner added** | Legacy custom datasets and the recycled-SHA finding are superseded by the 2026-10-21 benchmark |
| `Test creation\DATASET_RESEARCH_REPORT.md` | B | **banner added** | Justified the superseded custom datasets |
| `Test creation\Report_dataset.md` | B | **banner added** | Pre-2026-10-21 dataset dossier |
| `Test creation\debug_out.txt` | B | **classified only** | — |
| `retrospect_evaluation_2026-10-21\README.md` | C | **updated** (Status 2026-10-23 section) | No mention of the v4 parser-fix re-measurement, the authoritative analysis folder or the pending owner review. Its "LLM layer not implemented" line is now out of date; the status section notes `rtro ask` (not evaluated) |
| `retrospect_evaluation_2026-10-21\PROGRESS_MANIFEST.md` | C | **updated** (row 13b; note on step 14) | v4 re-measurement missing |
| `retrospect_external_4lang\STATUS.md` | D | **updated** (rewritten: COMPLETE) | Said "STOPPED at Phase 2" |
| `retrospect_external_4lang\README.md` | D | **created** | — |
| `retrospect_external_4lang\{protocol.md, REPORT.md, paper_tables.md, VERSION.md}` | D | **classified only** | — (pre-registered or generated; not edited) |

## Number sources

| Number(s) written | Where | Source |
|---|---|---|
| External confirmatory: 42 repos; MRR 0.3628 / 0.7747; R@1 0.2619 / 0.7143; R@10 0.5238 / 0.8571; Δ 0.4119; CI [0.279, 0.5489]; p 9.99990000099999e-06, written "< 0.0001 (minimum attainable with 100,000 Monte Carlo assignments)" in README and 9.9999e-06 in external STATUS.md; 14 / 0; SUPPORTED | README §4, external STATUS.md | `evaluation-artifacts/retrospect_external_4lang/analysis/external_v1/results.json` → `confirmatory` |
| Harm check: 14 repos; 0.6512 / 0.6452; Δ −0.006; CI [−0.0179, 0.0]; harms 0; PASS | README §4, external STATUS.md | same file → `harm_check` |
| Funnel: Java 12, Python 12, JavaScript 7, TypeScript 11; total 42 | README §4, external STATUS.md | same file → `funnel.selected_per_language` |
| Integrity: 4 not-indexed cases (jbpm), 0 parser-unhealthy, 0 out-of-window, 0 G≠B1 violations; pylint 1 history extraction failure | README §5, external STATUS.md | same file → `integrity`, `descriptive.cost_per_repository["pylint-dev/pylint"]` |
| Sensitivity: 29 reviewed, 26 confirmed, 3 rejected; 39 repos; 0.3856 / 0.7574; Δ 0.3718; CI [0.2348, 0.5091]; p 9.99990000099999e-06 (README: "< 0.0001 (minimum attainable with 100,000 Monte Carlo assignments)"; STATUS.md: 9.9999e-06); 12 / 0 | README §4, external STATUS.md | `evaluation-artifacts/retrospect_external_4lang/analysis/external_v1_posthoc/results_posthoc.json` → `sensitivity_owner_confirmed` |
| Post-hoc B_nl templates 1 and 3: 42; 0.3597 / 0.7569; Δ 0.3972; CI [0.2681, 0.529]; p 9.9999e-06; 24 / 0. S1-only B_id: 12; 0.278 / 0.5697; 0.2917; [0.0932, 0.5174]; 0.0625; 3 / 0. S1-only B_nl: 12; 0.2044 / 0.5281; 0.3237; [0.1218, 0.5496]; 0.03125; 10 / 0 | external STATUS.md | same file → `posthoc_bnl_without_template2`, `posthoc_s1_only` |
| Main benchmark in window H=400: 14 / 12; MRR 0.4069 / 0.6496 / 0.528 / 0.491; +0.0914; 3 / 0 | README §4 | `retrospect_evaluation_2026-10-21/evaluation/analysis/v4_parserfix/BCA/analysis_results.json` → `secondary["H400/held_out_test/pooled/B_identifier/in_window"]` (identical in `reports/parserfix_remeasurement.md`) |
| Main benchmark all indexed H=400: 63 / 49; 0.4329 / 0.2486 / 0.3464 / 0.2695; −0.0837; 4 / 23 | README §4 | same file → `secondary["H400/held_out_test/pooled/B_identifier/all_indexed"]` |
| Main benchmark all indexed H=50: 63 / 49; 0.4329 / 0.0883 / 0.3047 / 0.1699; −0.2141; 3 / 17 | README §4 | same file → `secondary["H50/held_out_test/pooled/B_identifier/all_indexed"]` |
| Reachability 20 of 91 | README §4, §5 | same file → `diagnostics.reach_by_language` (IN_WINDOW summed over languages; all statuses summed) |
| Per-language primary: Java 6 clusters INCONCLUSIVE; others not testable | README §4 | same file → `primary` |
| E3-Reach: 18 cases; MRR 0.1623 / 0.2825; Δ +0.1068; p 0.06641; 4 / 2; INCONCLUSIVE; unchanged with fixed code | README §4 | `retrospect_evaluation_2026-10-21/reports/parserfix_remeasurement.md` (E3-Reach section) |
| 1,005-event review queue | README §4, eval README, DOCS_INDEX | `retrospect_evaluation_2026-10-21/PROGRESS_MANIFEST.md` step 14 (count of `review_queue/review_queue.csv`), as stated in the audit instructions |
| H = 400; `--history` default 400; `--k` 10 (search) / 5 (ask); token budget 4000; `rtro` / `retrospect` commands; version 1.0.0 | README §1 | `node bin/rtro.js <cmd> --help`, `src/cli/config.js` (`PROJECT_DEFAULTS`), `package.json` |
| FunctionMatcher weights 0.35 / 0.25 / 0.15 / 0.15 / 0.10; thresholds 0.70 / 0.50; ambiguity 0.08 | README §2 | `src/matcher/FunctionMatcher.js` |
| B1 minimum-score threshold 0.08; StructuralRetriever weights 0.35 / 0.25 / 0.15 / 0.10 / 0.05 / 0.05 / 0.05; graph score 0.8 / 0.6 | README §5, STRUCTURAL_RETRIEVAL.md, external STATUS.md | `src/structural/retrieval/StructuralRetriever.js` |
| B3 0.6 / 0.4; B4 k = 60, 0.5 / 0.5 | README §2 | the harness copies (`run_benchmark.js`), `protocol.md` §3 |
| Tags: `eval-v1` = `1ac3b358…`; `cli-v1.0.0` = `13cdb3a0…`; commits `9d112fa`, `03f89e9`, `ed02019`, `1ac3b35` | README §6, eval README, external STATUS.md | `git rev-parse` in the Retrospect repository |
| Phase 0 gates: jest 195/195; G2 136/136; E1 116/116 | external STATUS.md | `retrospect_external_4lang/phase0/jest.log`, `phase0/g2_compare.txt`, `phase0/e1_compare.txt` |
| File counts in DOCS_INDEX (12 run logs, 36 worker logs, and the per-folder counts above) | DOCS_INDEX, this file | `ls` / `git ls-files` of the repository |
| Clone limits (10 minutes, 1.5 GB) | README §5 | `retrospect_external_4lang/scripts/build_external_cases.js` (`CLONE_TIMEOUT_MS`, `MAX_CLONE_BYTES`) |
| Monte Carlo 100,000 assignments, seed 20261023; bootstrap 10,000 | README §4, external STATUS.md | `retrospect_external_4lang/protocol.md` §4/§6; `results.json` → `confirmatory.test`, `seed` |

## Verification

The four checks below were run before committing. Their outcomes are in the commit message.

- **Links:** every relative Markdown link and in-page anchor in `README.md`, `STRUCTURAL_RETRIEVAL.md`, `DOC_AUDIT.md` and `docs/*.md` resolves. Result: 98 relative links in 8 files, 0 problems. 52 absolute `file:///` links in the historical `docs/RETROSPECT_PROJECT_PROGRESS_REPORT.md` were skipped and left unedited, per the rule on dated records. Many of them point to a `.gemini` folder outside the repository.
- **CLI help:** `node bin/rtro.js --help` was re-run, and so was `--help` for each command.
- **Tests:** jest suite, excluding `author_pack_blinding`.
- **Changes:** `git status` shows only `.md` changes, plus the new `docs/DOCS_INDEX.md` and `DOC_AUDIT.md`.

## Follow-up (2026-10-23): relicensing and published artifacts

| Item | Action |
|---|---|
| `LICENSE` | ISC → MIT ("Copyright (c) 2026 K-NagaCharan"). `package.json` `"license": "MIT"`. README §7 updated |
| `evaluation-artifacts/` | **Created.** Verbatim copies of both evaluation workspaces, all files including superseded runs, excluding only `node_modules/` and `__pycache__/`. Every file was checksum-verified against its original (0 mismatches), and the originals are unchanged. `.gitattributes` marks the folder `-text` so the bytes, and the checksums inside, are kept exactly |
| `evaluation-artifacts/README.md` | **Created.** What each workspace is, its ground truth, its authoritative files, and the verbatim-copy and local-path note |
| `README.md` §4, §6, §7 | p-values below 0.0001 written as "< 0.0001 (minimum attainable with 100,000 Monte Carlo assignments)". The local `D:\` workspace paths are replaced with repo-relative `evaluation-artifacts/` links. Citation author set to K-NagaCharan. The `cli-v1.0.0` hash is updated in a follow-up commit |
| `docs/DOCS_INDEX.md` | Scopes C and D and *Where results live* now point to `evaluation-artifacts/`. Rows added for `LICENSE` (now MIT) and `evaluation-artifacts/README.md` |
| `npm pack` | Still 47 files, with no `evaluation-artifacts/` entries (the `files` whitelist is unchanged) |

**Copied artifacts** (sizes measured with `os.walk`, excluding `node_modules`, `__pycache__` and `.git`):

| Workspace | Files | Size |
|---|---|---|
| `retrospect_evaluation_2026-10-21` | 571 | 83.02 MB |
| `retrospect_external_4lang` | 331 | 2.57 MB |
| **Combined** | | **85.59 MB** (limit raised to 90 MB by the owner) |

**Scan of the copies:**
- **Secrets:** 0 secret-pattern matches and 0 credential-like file names. The patterns covered Anthropic/OpenAI/GitHub/AWS/Slack keys, private keys and `api_key`/`secret`/`password`/`token` assignments.
- **Absolute local paths:** 694 occurrences in 320 files (381 in the main workspace, 313 in the external workspace). These are mostly `D:\base papers considered\…` and `D:\clones\…`. As instructed, they are left unedited.
