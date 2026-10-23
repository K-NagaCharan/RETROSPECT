# Results on the 2026-10-22 four-language dataset

## Sources and scope

**Sources:**
- `evaluation/analysis/BCA_v3/analysis_results.json`: tasks B, C and A.
- `evaluation/runs/*_BCA_v3/`: the runs those tasks were analysed from.
- `evaluation/analysis/D_v3/`: task D (see §6).

**Protocol:** `reports/evaluation_protocol.md`, fixed before the runs. Its deviation (§8) is a parser-abort guard and sensitivity analysis added before any result was read.

**What this measures:** Retrospect's retrieval layer (configurations B1–B4) on machine-verified evolution events. Labels are not yet human-reviewed. The LLM response-generation layer is not implemented and is not evaluated.

**Integrity:**
- Every repository was clean at its pin before and after each run.
- No parameter was tuned.
- Superseded runs are listed in `evaluation/runs/SUPERSEDED.md` and were not analysed.

## 1. Primary analysis (pre-registered)

Population: held-out B_identifier cases, with the target indexed and the origin commit inside the H = 400 window and diffed. Comparison: B4 vs B1, cluster-mean ΔMRR.

| Language | Cases | Clusters | MRR B1 | MRR B4 | ΔMRR | p (exact) | p (Holm) | Rescues / harms @10 | Decision |
|---|---|---|---|---|---|---|---|---|---|
| Java | 6 | 6 | 0.085 | 0.233 | +0.148 | 0.031 | 0.125 | 2 / 0 | **INCONCLUSIVE** |
| Python | 2 | 2 | 0.667 | 0.667 | 0.000 | 1.0 | 1.0 | 0 / 0 | NOT TESTABLE (< 6 clusters) |
| JavaScript | 1 | 1 | 0.333 | 0.500 | +0.167 | 1.0 | 1.0 | 0 / 0 | NOT TESTABLE |
| TypeScript | 5 | 3 | 0.704 | 0.729 | +0.014 | 1.0 | 1.0 | 1 / 0 | NOT TESTABLE |

- **Sensitivity** (parser stayed healthy through the H = 400 pass): the same for Java, Python and JavaScript. TypeScript drops to 4 cases with ΔMRR +0.020; its typeorm case was in an aborted pass.
- **No language reaches a supported conclusion.** Java repeats the direction and rough size of E3-Reach (+0.107, p = 0.066). However, 6 clusters cannot survive the Holm correction even with every cluster positive: the minimum attainable exact p is 0.031, and 4 × 0.031 = 0.125.
- **The binding limit is reachability, not mining volume.** Of 91 B_identifier cases across all splits, only 20 have their evolution commit within the last 400 commits:

  | Language | In window | Total |
  |---|---|---|
  | Java | 9 | 27 |
  | Python | 3 | 24 |
  | JavaScript | 1 | 14 |
  | TypeScript | 7 | 26 |

## 2. Secondary: where history helps and where fusion hurts (held-out, descriptive)

| Stratum (task B) | Cases / clusters | MRR B1 | B2 | B3 | B4 | R@10 B1 → B4 | B4 − B1 (cluster) | Rescues / harms |
|---|---|---|---|---|---|---|---|---|
| Pooled, in window, H = 400 | 14 / 12 | 0.407 | **0.650** | 0.528 | 0.491 | 0.57 → 0.79 | +0.091 (p = 0.008, descriptive) | 3 / 0 |
| Pooled, all indexed, H = 400 | 63 / 49 | 0.433 | 0.249 | 0.357 | 0.271 | 0.70 → 0.41 | −0.082 (p = 0.15) | 4 / 22 |
| Pooled, all indexed, H = 50 (default) | 63 / 49 | 0.433 | 0.088 | 0.305 | 0.170 | 0.70 → 0.48 | −0.214 (p < 0.001) | 3 / 17 |

**Readings:**

1. **The historical channel works when the evolution commit is in its window.** B2 alone gets MRR 0.65 vs B1 0.41 in window. On in-window cases that B1 misses (6 cases), B2 reaches MRR 0.59, but B4 only 0.09 and B3 0.15: **fusion discards most of the historical gain.** On cases with zero name-subtoken overlap (3 cases), B1 scores 0.002 and B2 0.67.
2. **Out of window, fusion actively harms.** When history has no signal for the target, it still promotes other candidates. On all held-out B cases at the default H = 50, B4 loses 17 top-10 hits and gains 3.
3. **The same harm appears on tasks where structural retrieval is already right** (pooled, held-out, all indexed):

   | Task | H | B1 MRR | B4 MRR | Harms @10 |
   |---|---|---|---|---|
   | A (current docstring) | 400 | 0.804 | 0.415 | 8 |
   | A (current docstring) | 50 | 0.804 | 0.345 | 12 |
   | C (old docstring) | 400 | 0.687 | 0.320 | 8 |

   The historical-only channel scores these queries poorly (B2 0.22–0.24), and RRF's equal weighting lets it pull correct structural hits down.

**Per language** (held-out, task B, all indexed, H = 400; B4 − B1 cluster ΔMRR):

| Language | ΔMRR | Rescues / harms |
|---|---|---|
| Java | −0.067 | 2 / 6 |
| Python | +0.033 | 1 / 0 |
| JavaScript | −0.105 | 0 / 4 |
| TypeScript | −0.256 | 1 / 12 |

None is significant.

## 3. Diagnostics

- **Indexing:** 4 Python B targets are not indexed at the pin, a parser or extraction gap. They are reported separately and are not in the rank metrics. All other targets are indexed.
- **Parser aborts during the H = 400 history pass** (Tree-sitter WASM `exit(1)`): guava (development only), lodash, typeorm and zod (development only). Their H = 400 history profiles are truncated. This is Retrospect as it actually runs; the reliability defect is reported separately.
- **Breakdowns** (held-out, in window):
  - **By label:** strict_rename has B1 0.32 vs B2 0.72, so history gains most. rename_move has B1 0.46 vs B4 0.49.
  - **By repository:** the clearest gains are quasar, spring-boot and svelte (B2 = 1.0, B1 ≤ 0.33). sonarqube is near zero for every configuration: 66k symbols, with test-like method names.

## 4. Development and validation splits

These are descriptive and were not used for any decision. They are small: 6 validation B cases and 18 development B cases. Their direction agrees with held-out:

| Split / stratum (task B) | Cases | B1 MRR | B4 MRR |
|---|---|---|---|
| Validation, pooled, H = 50 | 6 | 0.20 | 0.04 |
| Development, pooled, H = 50 | 18 | 0.38 | 0.20 |
| Development, pooled, H = 400 | 18 | 0.38 | 0.31 |
| Development, in window, H = 400 | 5 | 0.46 | 0.50 |

## 5. What these results support and do not support

**Supported** (machine-verified labels, held-out, descriptive unless marked):
- When the evolution commit is within the window, Retrospect's historical channel finds renamed callables that structural retrieval misses (B2 vs B1).
- The current fusion configurations (B3 linear 0.6/0.4 and B4 RRF 0.5/0.5) lose much of that gain in window. Overall, on held-out data, they are worse than structural-only retrieval.

**Not supported:**
- A confirmatory claim that B4 improves on B1 in any single language. Java is INCONCLUSIVE at 6 clusters; Python, JavaScript and TypeScript are not testable.
- Any claim of generalisation beyond these 26 repository snapshots. Held-out B clusters per language are 7–18, and 1–6 once restricted to the window.

**Implications** (not acted on: no tuning was done on this test set):
- Gating or weighting fusion by whether history has any signal for the query looks like the most direct lever.
- Larger horizons, or reach beyond the window, would enlarge the population.

Either would need a new pre-registration and a fresh held-out set, because this one has now been looked at.

## 6. Task D (negative / false-lineage)

**Sources:** `evaluation/analysis/D_v3/`. Runs: `evaluation/runs/*_D_v3`.

**Method:** the query is the name of a callable deleted with no detected successor and absent from the repository at the pin. A *false lineage claim* means a B2 top-10 candidate lists that deleted name among its inherited historical names.

| Split | Cases / clusters | False-claim rate, H = 50 | False-claim rate, H = 400 |
|---|---|---|---|
| Held-out, pooled | 903 / 180 | 0.11% (1 case, JavaScript) | 0.0% |
| Validation, pooled | 151 / 41 | 0.0% | 0.0% |
| Development, pooled | 93 / 60 | 1.1% (1 TypeScript case) | 1.1% |

**Per language, held-out** (cluster-mean rate):

| Language | Clusters | H = 50 | H = 400 |
|---|---|---|---|
| Java | 34 | 0 | 0 |
| Python | 70 | 0 | 0 |
| JavaScript | 40 | 0.025 | 0 |
| TypeScript | 36 | 0 | 0 |

**Reading:** Retrospect's historical channel almost never attaches a deleted name to an unrelated surviving symbol. Two caveats:

1. **This is partly by construction.** D negatives were selected so that no similar body survived in the commit.
2. **Retrospect has no abstention mechanism.** For these queries B1–B4 still return ranked candidates, so "correctly reports no current successor" cannot be measured.

**Parser aborts during H = 400 history passes:**

| Split | Repositories |
|---|---|
| Held-out | lodash, moment, typeorm |
| Validation | moment |
| Development | typeorm, guava, zod |

Truncated history can only lower the claim rate for those repositories.

**Integrity:** every repository was clean at its pin before and after every D run.
