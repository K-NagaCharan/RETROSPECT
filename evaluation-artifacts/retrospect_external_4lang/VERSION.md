# Code version

| Item | Value |
|---|---|
| Repository | `D:\base papers considered\Retrospect` (local only, never pushed) |
| Tag | `eval-v1` |

## History

| Step | Commit | Contents | Checks |
|---|---|---|---|
| Phase 0 | `03f89e9b83b61e9c0c8abbbf1d00d084ebcf46eb` | Merge of `fix/wasm-leak` (`ed02019`) into `main` after the snapshot commit `9d112fa` ("chore: snapshot working state used for v3/v4 evaluation") | jest 23 suites, 195/195 tests (author_pack_blinding excluded); G2 136/136 E2 ranks (`phase0/g2_compare.txt`); E1 116/116 ranks (`phase0/e1_compare.txt`) |
| Phase 1 (**current `eval-v1`**) | `1ac3b358c248fab5db2d7618de4cc057a856c9d4` | "feat: lineage-match gate (G) and identifier extraction" (`src/retrieval/LineageGate.js`, `tests/unit/lineage_gate.test.js`; B1–B4 unchanged) | G unit tests 8/8; development-split check (Tasks B and A, H = 400): 27 cases, L empty in 22, G == B1 in all 22, 0 violations (`phase1/dev_check_result.json`); G's MRR on development data was not computed |

**All runs from Phase 2 on load `eval-v1` = `1ac3b358c248fab5db2d7618de4cc057a856c9d4`.** The extractor and B1–B4 code are identical at both commits; Phase 1 only added a new module.
