# Dataset status (frozen 2026-10-22, before any benchmark run)

## Collection funnel

| Stage | Java | Python | JavaScript | TypeScript | Total |
|---|---|---|---|---|---|
| Repositories mined (window 1,500 topo-ordered commits) | 5 | 8 | 7 | 6 | 26 |
| Candidate events (unverified miner output) | 3,581 | 6,075 | 5,842 | 1,986 | 17,484 |
| Excluded by verification gates (events; one event can fail several gates) | 472 | 466 | 4,846 | 22 | 5,806 |
| **Machine-verified evolution events** | 3,109 | 5,609 | 996 | 1,964 | 11,678 |
| — of which rename-type (B-eligible labels) | 65 | 92 | 23 | 42 | 222 |
| — of which strong negatives (`no_valid_lineage`) | 766 | 265 | 99 | 211 | 1,341 |

**Excluded by verification gates:**
- Non-production path: 5,677 reasons. Mostly moment's minified `min/` builds (JavaScript), sonarqube integration tests, and fastapi `docs_src`.
- Symbol not at its recorded line: 201.
- Duplicate: 41.

**Verified events are not all retrieval cases.** Most verified events are same-name edits, moves and deletions, which have no current-vs-historical query gap. They are kept as ground truth but do not become task-B cases.

## Retrieval cases (frozen; one case per distinct task instance)

| Language / task | Cases | Clusters | Held-out cases (clusters) |
|---|---|---|---|
| Java B_identifier (primary) | 27 | 24 | 19 (18) |
| Python B_identifier | 24 | 18 | 17 (13) |
| JavaScript B_identifier | 14 | 14 | 13 (13) |
| TypeScript B_identifier | 26 | 13 | 18 (7) |
| C_docstring (Java / Python / JavaScript / TypeScript) | 2 / 43 / 7 / 9 | 2 / 22 / 7 / 3 | 2 / 36 / 6 / 7 |
| A_current_doc | 2 / 45 / 6 / 6 | 2 / 24 / 6 / 3 | 2 / 36 / 5 / 5 |
| D_negative | 665 / 220 / 91 / 171 | 57 / 103 / 57 / 64 | 567 / 155 / 61 / 120 |

**Splits** (cases / clusters):

| Split | Cases | Clusters |
|---|---|---|
| Development | 129 | 73 |
| Validation | 160 | 46 |
| Held-out test | 1,069 | 230 |

The cluster-leakage check passed. Checksums are in `manifests/split_manifest.json`.

**Java D_negative is dominated by sonarqube's large module deletions:** 567 held-out cases in only 34 clusters. Only cluster-level statistics should be read for D.

## Against the collection targets (targets, not quotas)

The target was ~200 verified events with ≥ 40 per language. **Met for verified events** (11,678; ≥ 996 per language). **Not met for the primary task:** after pin-uniqueness, leakage and duplicate rules, only 13–24 B_identifier clusters per language exist, and 7–18 of them are held out.

- **The binding constraint is real rename frequency:** about 0–30 genuine callable renames per 1,500 commits per repository.
- **What would change it:**
  - mining deeper histories (more cost; rule 13 required a feasibility bound first);
  - adding repositories.

  Neither changes the primary analysis, which also requires the event to fall within the H = 400 window.

## Power (held-out B clusters before the reachability filter)

| Language | Held-out B clusters | MDE (α = 0.05) | MDE (Holm-adjusted) |
|---|---|---|---|
| Java | 18 | 0.125 | 0.149 |
| Python | 13 | 0.148 | 0.176 |
| JavaScript | 13 | 0.148 | 0.176 |
| TypeScript | 7 | 0.201 | 0.240 |

MDE is the minimum detectable ΔMRR at 80% power. E3's observed effect was 0.107, so **no language is powered to confirm an E3-sized effect.**

## Verification status

All events are `machine_verified`, with `human_review: not_reviewed`. `review_queue/review_queue.csv` holds 1,005 events: every held-out B/D event, plus a 20% audit sample of the rest. Until it is reviewed, results should be described as *machine-verified ground truth*.
