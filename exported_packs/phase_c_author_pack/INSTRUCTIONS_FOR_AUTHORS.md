# Retrospect Phase C — Instructions for Query Authors

## Objective
You are investigating a software codebase where you need to locate the code responsible for a specific software behavior, bug fix, or capability.

Your task is to write the natural language search query you would enter into a code search tool to find the relevant function or implementation in the codebase.

---

## Instructions

1. **Review Context Cards**:
   Open each card in the `cards/` directory (e.g. `CARD-1C1090.json`).
   Each card describes:
   - **Problem Scenario**: The engineering context.
   - **Observable Behavior**: What happens currently.
   - **Expected Outcome**: What the behavior should be once addressed.
   - **Environmental Context**: The runtime subsystem.

2. **Formulate a Search Query**:
   Write a query representing how a developer would search for the code handling this behavior.
   - Write realistic queries (natural language phrases, functional descriptions, or technical terms).
   - Queries must be at least 15 characters long.
   - Do not guess internal symbol names or filenames.

3. **Fill the Submission Template**:
   For each card, copy `submission_template.json` to `submissions/<submission_id>.json`:
   - Set `submission_id` to `SUB-<card_hash>` (matching the card's ID token).
   - Set `card_id` to the corresponding card ID (e.g. `CARD-1C1090`).
   - Set `query_text` to your query.
   - Select `intent_category` from: `BUG_FIX`, `FEATURE_ADDITION`, `REFACTORING`, `SECURITY_HARDENING`, `API_EVOLUTION`.
   - Complete `author_metadata`.

---

## Strict Blinding Guidelines

- **DO NOT** inspect the target open-source repository source code, commit history, pull requests, or issue trackers.
- **DO NOT** attempt to guess exact internal file paths or internal symbol names.
- Attest that you remained blinded by setting `blinded_attestation: true`.
