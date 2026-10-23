# Pre-registered protocol: external 4-language rename benchmark

Written before any benchmark run on this case set; it must not be edited after the first run. Deviations are appended in §9 with a date.

## 1. Code version

Every run loads Retrospect at tag **`eval-v1` = `1ac3b358c248fab5db2d7618de4cc057a856c9d4`** (see `VERSION.md`). Each run manifest records the HEAD it loaded.

## 2. Case set

- **Location:** `cases/cases.jsonl`, frozen. Checksums are in `cases/MANIFEST.sha256.json`, and construction is in `scripts/build_external_cases.js`.
- **Unit:** one rename event per repository; the repository is the independence unit. Target = the successor callable at the pin.
- **Sources:**

  | Source | Language | Origin |
  |---|---|---|
  | S1 | Java | RefactoringMiner oracle, TP "Rename Method" / "Move And Rename Method" |
  | S2 | Python | PyRef oracle, TP "Rename Method" |
  | S3 | Python / JavaScript / TypeScript | Developer-attested renames: the commit message names OLD and NEW, and Retrospect's extractor confirms the rename with body similarity ≥ 0.5 |
  | S3b | Python / JavaScript / TypeScript | Fallback, used only if a language misses the minimum |

  S3/S3b labels are listed in `cases/review_sheet.csv` for owner review.

- **Queries:**

  | Task | Query |
  |---|---|
  | `B_id` | OLD (bare identifier) |
  | `B_nl` | Three fixed templates: "Where is the function OLD now?", "What happened to OLD after the refactor?", "Show me the current code for \`OLD\`." |
  | `A` | First sentence of the successor's doc comment at the pin, where it exists and mentions neither OLD nor NEW |

## 3. Systems (H = 400, no tuning)

| System | Definition |
|---|---|
| B1 | Structural |
| B2 | Historical only |
| B3 | Linear fusion 0.6 / 0.4 |
| B4 | RRF v2, k = 60, 0.5 / 0.5 |
| G | Lineage-match gate (`src/retrieval/LineageGate.js`): B2 candidates whose inherited historical names contain an identifier extracted from the query come first, then B1 without them. With no match, G = B1. |

No parameter of any system is changed. Seed 20261023 throughout.

## 4. Confirmatory test (the single test)

- **Population:** Task `B_id`, all cases, pooled across languages.
- **Statistic:** Δ = mean over repositories of (RR_G − RR_B1), where RR = 1/rank and unranked = 0.
- **Test:** two-sided Monte Carlo sign-flip over repositories, 100,000 random sign assignments, seed 20261023, p = (count + 1)/(N + 1), α = 0.05. These are the `sign_flip` and `bootstrap_ci` functions of `analyze_benchmark.py`, copied unchanged with SEED set to 20261023. Exact enumeration is used only if there are ≤ 20 repositories.
- **Decision:**
  - **SUPPORTED:** Δ > 0, p < 0.05 and rescues@10 > harms@10.
  - **NOT SUPPORTED:** Δ ≤ 0, or harms@10 > rescues@10.
  - **INCONCLUSIVE:** otherwise.
- **Definitions:**
  - **rescue@10:** B1 rank > 10 or unranked, and G rank ≤ 10.
  - **harm@10:** B1 rank ≤ 10, and G rank > 10 or unranked.

## 5. Harm check (non-inferiority)

Task `A`, G vs B1. **PASS** if harms@10 = 0 and ΔMRR (repository mean) ≥ −0.01; otherwise **FAIL**.

## 6. Descriptive analyses (no confirmatory claims; 95% repository-bootstrap CIs, 10,000 resamples)

- `B_nl`: per-repository mean RR over the three templates, G vs B1.
- B2, B3 and B4 vs B1 on `B_id` and `B_nl`.
- Per language.
- By source stratum: S1 + S2 vs S3/S3b.
- Per template.
- By name overlap: zero vs some subtoken overlap between OLD and NEW.
- Cost per repository:
  - clone, index and history wall time;
  - history-profile size (symbols with history at H = 400);
  - median query latency, B1 vs G.

## 7. Sensitivity

The confirmatory statistic is recomputed on S1 + S2 + owner-confirmed S3/S3b cases, once `review_sheet.csv` has been filled in. It is reported as sensitivity only; the confirmatory decision is §4.

## 8. Integrity rules

- **Repository state:** each clone must be clean at its pin before and after its run, and the harness never checks out.
- **Empty index:** a repository is aborted on an empty index.
- **Flagging:** parser health and `extractionFailures` are recorded and flagged, never silently dropped.
- **Development data:** G was run only on the development split of the earlier dataset (correctness assertion only; its MRR was not computed). It was never run on that dataset's validation or held-out splits.
- **Analysis code:** `scripts/analyze_external.py`.

## 9. Deviations

**Deviation 1 (2026-10-23, before freeze and before any run).** JavaScript reached 7 repositories after exhausting its catalog in S3 and S3b; the per-language minimum of 8 is relaxed to 7 for JavaScript only. The confirmatory test is pooled (42 repositories ≥ 36) and is unaffected; per-language results remain descriptive.

**Deviation 2 (2026-10-23, before freeze and before any run): clone with long paths.** The clone step now runs `git -c core.longpaths=true clone ...`. Three repositories (apache/drill, droolsjbpm/drools, elastic/elasticsearch) had failed to clone because of Windows path-length limits, an environment artifact that would have changed which repositories were selected. Their results were moved aside as `*.superseded-pathlength-*` and the three were re-processed in the same alphabetical order. elasticsearch was then skipped under the existing 1.5 GB rule.

**Deviation 3 (2026-10-23, before freeze and before any run): demo and build-tooling paths excluded.** The production-path filter now also excludes `*.stories.*` files and `tooling/`, `stories/` and `storybook/` paths. Two selected events were found in non-production files: storybookjs/storybook (`lib/components/src/controls/Range.stories.tsx`) and webpack/webpack (`tooling/generate-css-data.js`). The filter was applied to all repositories. Only those two selections were affected; their results were moved aside as `*.superseded-demo-tooling-*` and both repositories were re-processed, each selecting a production event.

**2026-10-23 (after the confirmatory result).** Sensitivity run with owner verdicts (26/29 confirmed); post-hoc descriptive rows added after the confirmatory result, clearly labelled.

- **Sensitivity:** owner verdicts from `owner_review/review_sheet_owner.csv`. Rejected: tj/commander.js, django/django, trpc/trpc.
- **Post-hoc descriptive rows:** B_nl without template 2, and S1 only.
- **Output:** `analysis/external_v1_posthoc/results_posthoc.json`, written by `scripts/analyze_posthoc.py`.
- **Unchanged:** the confirmatory result, §4/§5, and all frozen files.
