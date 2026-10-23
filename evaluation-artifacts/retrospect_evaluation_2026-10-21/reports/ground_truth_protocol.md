# Ground-truth protocol (fixed before any retrieval result on this dataset)

## Layer 1: evolution events

### Mining (`scripts/event_mining/mine_events.js`)

The miner works read-only on each repository, using `git log/show/diff-tree/grep` only.

- **Commits:** for each repository, the non-merge commits among the first 1,500 commits of `git log --topo-order <pin>`, where the pin is the clone HEAD recorded in `REPOSITORY_INVENTORY.csv`.
- **Files:** production files of the repository's language. Tests, docs, examples, benchmarks, vendored, build and `.d.ts` files are excluded by a fixed path regex.
- **Symbols:** callables (functions, methods, arrow functions; no signature-only overloads, no `anonymous`) parsed in the parent and child versions of each changed file with Retrospect's Tree-sitter adapters. This is the one dependency on the system under test: a symbol the parser cannot extract cannot be a target.
- **Identity:** file + qualified name + parameter signature, so overloads and property accessors stay distinct. File renames are followed (`-M`).
- **Similarity:** multiset Jaccard over identifier and number tokens, excluding the symbol's own name and language keywords. Containment is the fraction of one token bag present in another.
- **Pairing thresholds** (constants, never tuned on retrieval results): pair ≥ 0.5; strong ≥ 0.8 with margin ≥ 0.1 over the second-best; containment ≥ 0.6; split part ≥ 0.5 with joint coverage ≥ 0.6; bodies must have ≥ 12 tokens.

### Candidate types

| Type | Meaning |
|---|---|
| rename / move / rename_move / scope_change | 1:1 removed→added pair |
| ambiguous_pairing | Pair below the strong threshold |
| signature_change | Unique same-name pair with different parameters |
| extraction | New callable whose tokens come from code removed from a kept callable that now calls it |
| inlining | Removed callable whose tokens appear in code added to a kept callable that called it |
| split_part | Removed callable covered by ≥ 2 new callables |
| deletion_no_successor | Removed callable with none of the above |

### Verification (`scripts/event_validation/verify_events.py`): machine-verified, not human-adjudicated

**Gates:**
1. Commit and parent exist.
2. Before and after sources are retrievable.
3. Each symbol's name occurs within ±2 lines of its recorded start line.
4. For renames: the old name no longer occurs in the successor file, and the new name did not occur in the predecessor file. Otherwise the event is relabelled `ambiguous`.
5. Non-production paths missed by the miner's filter are excluded (`non_production_path`): minified or generated builds (`min/`, `*.min.js`, lodash `npm-package/`), documentation sources (`docs_src/`), integration tests (`src/it/`, `*IT.java`, `integration-test(s)/`), and build or tool scripts (`tasks/`, `bin/`, `gallery/`).

   *Revision made 2026-10-22, before any retrieval run.* A pre-freeze sample of rename events showed that about 370 of 602 rename events were minifier identifier churn in moment's `min/*.min.js`, and that sonarqube integration tests were present.
6. Duplicates are excluded. For identity-changing labels (renames, moves, extraction, inlining, split), the same before→after symbol pair in another commit is the same task (for example, a re-applied rename). For same-identity edits it is a distinct event only if the commit differs.

*Revision made 2026-10-22, before any retrieval run.* The first smoke test of the verifier keyed duplicates without the commit, which wrongly dropped repeated signature changes. Chain links also ran through same-identity edits, which produced giant clusters: 28 clusters for 470 Python events. Both were corrected, and the old behaviour is not used anywhere.

**Labels:**

| Label | Rule |
|---|---|
| `strict_rename` | Strong rename, same parameters |
| `rename_signature_change` | Strong rename, parameters changed |
| `rename_move` | Strong pair, different name and file |
| `move` | Strong pair, same name, different file or scope |
| `signature_change` | Similarity ≥ 0.5 |
| `rewrite_same_name` | Similarity < 0.5 |
| `extraction`, `inlining`, `split` | As mined |
| `ambiguous` | Weak or contested pairing |
| `no_valid_lineage` | Strong negative: best containment of the old body in any code added by the commit < 0.3, **and** the old name absent from the repository after the commit |
| `unresolved_deletion` | Other deletions |

**Other rules:**
- **Clusters:** events of the same commit are one cluster. Clusters are merged with union-find along evolution chains (A→B, B→C), but only through identity-changing events: `strict_rename`, `rename_signature_change`, `rename_move`, `move`, `extraction`, `inlining`, `split`.
- **Human review:** every event carries `human_review: not_reviewed`. A review queue is produced for the held-out test events.
- **Recorded but not represented as labels:** generalisation, specialisation and framework migration are not automatically separable from these rules, so they fall under `rename_signature_change`, `signature_change`, `rewrite_same_name` or `ambiguous`. This is a documented limitation.

## Layer 2: retrieval cases (`scripts/query_validation/build_cases.js`)

See `reports/evaluation_protocol.md` §2.

**Exclusions (ledger: `ground_truth/case_exclusions.jsonl`):**
- the successor is not uniquely present at the pin (absent, or only a name-only match);
- the old name contains the new name;
- the old docstring mentions the new name;
- a negative's name still occurs at the pin.

**Accepted targets:** one per case (the successor). Multiple accepted targets are supported by the harness but not produced by these rules.
