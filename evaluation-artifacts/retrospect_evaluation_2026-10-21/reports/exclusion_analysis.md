# Exclusion analysis

Ledgers:
- `ground_truth/exclusions.jsonl`: event-level exclusions, one row per candidate with its reasons.
- `ground_truth/case_exclusions.jsonl`: case-level exclusions.
- `ground_truth/superseded_v1_before_dedup/`: the first case build, before deduplication. Kept for audit and never evaluated.

## Event level (5,806 events excluded of 17,484 candidates; 5,919 reasons, since one event can fail several gates)

| Reason | Java | Python | JavaScript | TypeScript |
|---|---|---|---|---|
| `non_production_path` | 408 | 462 | 4,807 | 0 |
| `before_symbol_not_at_recorded_line` | 24 | 0 | 75 | 21 |
| `after_symbol_not_at_recorded_line` | 17 | 0 | 62 | 2 |
| `duplicate_of` (same rename pair re-applied) | 37 | 4 | 0 | 0 |

**Non-production paths:**
- **JavaScript:** almost entirely moment's minified `min/*.min.js` build outputs. Minifier identifier churn produced about 370 fake "renames". This was found in a pre-freeze audit sample and is the reason the path gate was added.
- **Python:** fastapi `docs_src` tutorial code.
- **Java:** sonarqube `src/it` integration tests and spring-boot `integration-test`.

**Symbol-line mismatches** come mostly from JavaScript and TypeScript, where parser line numbers and decorators or multi-line declarations differ. They are excluded rather than repaired.

## Case level (325)

| Reason | Java | Python | JavaScript | TypeScript |
|---|---|---|---|---|
| Duplicate task instance (same pin, query, target) | 88 | 24 | 1 | 9 |
| Successor not uniquely present at the pin | 25 | 30 | 9 | 5 |
| Old name contains the new name (leakage) | 13 | 38 | 0 | 11 |
| Deleted name still in the repository at the pin (D) | 13 | 21 | 7 | 31 |

## Bias this introduces

- **Pin-uniqueness** removes renames whose successor was later renamed or deleted again. The dataset therefore under-represents long chains, which are the hardest cases for history.
- **The leakage rule** removes "easy" cases such as `foo` → `foo_v2`. The remaining B cases are, by construction, harder for structural (name-based) retrieval.
- **Path gates and parser-based discovery** mean only callables that Retrospect's own extractor can parse are represented.
