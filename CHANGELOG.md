# Changelog

All notable changes to the `retrospect-cli` package.

## 1.0.1 (2026-10-29)

- `rtro ask`: when retrieval finds no matching code, no LLM request is sent. A hint is printed instead, explaining that only functions, classes and methods are indexed and suggesting naming a symbol or using `rtro search`. Previously the model was called with an empty context and an empty `Sources:` list was printed.
- Retrieval, ranking, parser and gate code are unchanged.

## 1.0.0 (2026-10-23)

- First release: `rtro init`, `status`, `search`, `ask` and `config`, with the lineage gate (configuration G) for search and ask.
