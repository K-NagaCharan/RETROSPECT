#!/usr/bin/env bash
# Resumable mining batch for one language. Skips repositories whose summary already exists.
# Usage: bash run_mining_batch.sh <language> <window> <name=path> [<name=path> ...]
set -u
W="$(cd "$(dirname "$0")/../.." && pwd)"
LANG_ID="$1"; WINDOW="$2"; shift 2
OUT="$W/candidate_events/$LANG_ID"
mkdir -p "$OUT"
LOG="$OUT/mining_progress.log"
for spec in "$@"; do
  NAME="${spec%%=*}"; REPO="${spec#*=}"
  if [ -f "$OUT/$NAME.summary.json" ]; then echo "$(date -u +%FT%TZ) skip $NAME (done)" >> "$LOG"; continue; fi
  if [ -f "$OUT/$NAME.jsonl" ]; then echo "$(date -u +%FT%TZ) incomplete $NAME (jsonl without summary) - left for manual review" >> "$LOG"; continue; fi
  echo "$(date -u +%FT%TZ) start $NAME $REPO window=$WINDOW" >> "$LOG"
  START=$(date +%s)
  if node "$W/scripts/event_mining/mine_events.js" --repo "$REPO" --name "$NAME" --lang "$LANG_ID" --window "$WINDOW" --out "$OUT/$NAME.jsonl" >> "$LOG" 2>&1; then
    echo "$(date -u +%FT%TZ) done $NAME in $(( $(date +%s) - START ))s" >> "$LOG"
  else
    echo "$(date -u +%FT%TZ) FAILED $NAME" >> "$LOG"
  fi
done
echo "$(date -u +%FT%TZ) batch complete" >> "$LOG"
