# Quality audit

## Automated checks (all events)

| Check | Result |
|---|---|
| Commit and parent exist (`git cat-file`) | Required for every verified event |
| Symbol name within ±1–2 lines of the recorded start, in parent / child source | 201 candidates failed and were excluded |
| Rename sanity: old name absent from the successor file, new name absent from the predecessor file | Failing renames relabelled `ambiguous` |
| Non-production path gate | 5,677 reasons |
| Duplicate task instances (case level) | 122 removed |
| Cluster leakage across splits | None (asserted in `make_splits.py`) |
| Output files | Checksummed (`manifests/event_checksums.json`, `manifests/split_manifest.json`) |
| Harness equivalence with the earlier E2 worker | 136/136 ranks identical (Phase B data) |
| Statistics functions | Unit-tested (`tests/test_analysis_stats.py`) |
| Repository integrity | HEAD == pin and a clean worktree before and after every snapshot run |

## Pre-freeze manual spot checks (by the assistant, not the project owner)

These samples were read by the assistant against commit subjects and paths. They are **not** a substitute for the owner's review.

- **First sample, before the path gate:** 10 random rename events. 4 were minifier churn in moment `min/*.min.js` (for example `pn.eraName → i.eraName`, commit "Build 2.29.2"). 2 were sonarqube integration-test methods. This led to the non-production path gate.
- **Second sample, after the gate:** 12 random rename events whose successor is present at the pin. All 12 were plausible genuine renames or extract-to-new-name moves, for example:
  - vue `getExposeProxy → getComponentPublicInstance` ("extract getComponentPublicInstance helper");
  - jest `createToReturnMatcher → createToHaveReturnedMatcher` ("remove alias methods");
  - black `BaseStringSplitter.__validate → _validate`. This was later excluded by the leakage rule, since the old name contains the new name.

## Owner review still required

`review_queue/review_queue.csv` holds 1,005 events: all held-out B and D events, plus a seeded 20% audit sample of the others. Each row has blank verdict columns. Until it is reviewed:
- describe the ground truth as *machine-verified*;
- report the rate of confirm / relabel / reject once reviewed;
- rerun `analyze_benchmark.py` on confirmed events only, as a sensitivity analysis.

## Known threats

- Event discovery depends on Retrospect's own extractor.
- The rename similarity threshold (0.8) can accept rewrites that share most identifiers.
- Fixed and generated paths may still slip through in repositories not inspected.
- D-task negatives rely on name absence; a successor under a different, dissimilar name would be mislabelled as "no lineage".
