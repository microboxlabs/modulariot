#!/usr/bin/env bash
# Diagnose the harness handshake the TUI relies on. Mirrors what
# useSession.submit() does:
#   1. POST /runs:start                  → returns run_id
#   2. GET  /runs/{id}/stream            → SSE event stream until run.completed
#   3. GET  /runs/{id}                   → final HarnessRunRecord with .answer
#
# Use this to confirm the harness side is healthy when the TUI shows
# a stuck "… miot" row. If steps 2 or 3 misbehave, the TUI bug is
# upstream of miot-chat.
#
# Usage:
#   BASE_URL=http://localhost:8000 ./diagnose-harness.sh "your prompt" [tenant] [user]
#
# Env vars:
#   BASE_URL  default http://localhost:8000
#   TOKEN     optional Bearer token
#
# Prints each step with elapsed seconds, so you can spot exactly which
# call hangs.

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8000}"
PROMPT="${1:-cuales son las alertas para hoy?}"
TENANT="${2:-mintral}"
USER_ID="${3:-demo-user}"
CONV_ID="${CONV_ID:-conv-diag-$(date +%s)}"

AUTH=()
if [[ -n "${TOKEN:-}" ]]; then
  AUTH=(-H "Authorization: Bearer ${TOKEN}")
fi

trap 'echo "--- aborted ---" >&2' INT

echo "BASE_URL  : ${BASE_URL}"
echo "PROMPT    : ${PROMPT}"
echo "TENANT    : ${TENANT}"
echo "USER      : ${USER_ID}"
echo "CONV_ID   : ${CONV_ID}"
echo

t0=$(date +%s)

echo "=== step 1 — POST /runs:start ==="
RESP=$(curl -sS -X POST "${BASE_URL}/runs:start" \
  -H 'Content-Type: application/json' \
  "${AUTH[@]}" \
  -d "$(jq -nc \
    --arg msg "$PROMPT" \
    --arg tenant "$TENANT" \
    --arg user "$USER_ID" \
    --arg conv "$CONV_ID" \
    '{message:$msg, tenant_id:$tenant, user_id:$user, conversation_id:$conv, mode:"auto"}')")
RUN_ID=$(jq -r '.run_id // empty' <<<"$RESP")
if [[ -z "$RUN_ID" ]]; then
  echo "FAIL: no run_id in response"
  echo "$RESP"
  exit 1
fi
echo "+${SECONDS}s  run_id=${RUN_ID}"
echo

echo "=== step 2 — GET /runs/{id}/stream (SSE, until terminal event) ==="
# Stream events; print event/seq/type and stop at run.completed / run.failed.
# We give it a generous 30s ceiling so a runaway stream doesn't hang forever.
curl -sS -N --max-time 30 "${BASE_URL}/runs/${RUN_ID}/stream" "${AUTH[@]}" \
  | awk -v t0="$t0" '
    /^event: / { ev = substr($0, 8) }
    /^data: { / {
      # extract seq and type from the data JSON via a coarse regex
      data = substr($0, 7)
      seq = "?"; type = "?"
      if (match(data, /"seq":[0-9]+/))  seq  = substr(data, RSTART+6, RLENGTH-6)
      if (match(data, /"type":"[^"]+"/))type = substr(data, RSTART+8, RLENGTH-9)
      elapsed = systime() - t0
      printf "+%ds  seq=%-3s type=%-20s event=%s\n", elapsed, seq, type, ev
      fflush()
      if (type == "run.completed" || type == "run.failed") exit 0
    }
  '
echo "+${SECONDS}s  stream loop ended"
echo

echo "=== step 3 — GET /runs/{id} (final record) ==="
echo "+${SECONDS}s  fetching record..."
RECORD=$(curl -sS --max-time 10 "${BASE_URL}/runs/${RUN_ID}" "${AUTH[@]}")
echo "+${SECONDS}s  record received"

STATUS=$(jq -r '.status // empty' <<<"$RECORD")
ANSWER_LEN=$(jq -r '.answer | if . then length else 0 end' <<<"$RECORD")
EVENT_COUNT=$(jq -r '.events | length' <<<"$RECORD")
echo "status      : ${STATUS}"
echo "events      : ${EVENT_COUNT}"
echo "answer.len  : ${ANSWER_LEN}"
echo

if [[ "$ANSWER_LEN" == "0" || -z "$ANSWER_LEN" ]]; then
  echo "⚠ answer is empty in the record. The TUI cannot recover the assistant body from this."
fi

echo "=== answer preview ==="
jq -r '.answer // "(no answer)"' <<<"$RECORD" | head -20
echo
echo "DONE. Total elapsed: ${SECONDS}s"
