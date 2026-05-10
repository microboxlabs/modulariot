#!/usr/bin/env bash
# 03-image-runs-demo.sh — Category A.3
# Asserts: `miot-harness demo "..."` runs to completion inside the
# image and produces a non-empty answer. Smoke test that the wires
# (registry → supervisor → synthesizer) are connected end-to-end.
#
# Skips gracefully if no model API key is in the environment — this
# eval consumes API credit, so we don't run it on PRs by default.
# Enable explicitly with HARNESS_EVAL_DEMO=1 (CI workflow_dispatch).
set -euo pipefail

ID="03-image-runs-demo"
TAG="${HARNESS_EVAL_TAG:-miot-harness:eval}"
NAME="${HARNESS_EVAL_NAME:-miot-harness-eval}"
PORT="${HARNESS_EVAL_PORT:-18765}"
DEMO_TIMEOUT_S="${HARNESS_EVAL_DEMO_TIMEOUT_S:-60}"

cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

fail() {
  echo "FAIL $ID — $1"
  echo "--- last 30 lines of container logs ---" >&2
  docker logs "$NAME" 2>&1 | tail -n 30 >&2 || true
  exit 1
}

skip() {
  # Treat as PASS with a SKIPPED tag — the orchestrator counts skips
  # separately in run-all.sh.
  echo "PASS $ID — SKIPPED ($1)"
  exit 0
}

# Gating: only run when explicitly enabled or when at least one model
# key is in scope. The demo CLI uses langchain_anthropic by default;
# if there's no key, the agent will raise RuntimeError on first turn.
if [[ "${HARNESS_EVAL_DEMO:-0}" != "1" ]] && [[ -z "${ANTHROPIC_API_KEY:-}" ]] && [[ -z "${OPENAI_API_KEY:-}" ]]; then
  skip "no model API key in env, and HARNESS_EVAL_DEMO!=1"
fi

if ! docker image inspect "$TAG" >/dev/null 2>&1; then
  fail "image $TAG not found — run 01-image-builds.sh first"
fi

# Pre-clean
docker rm -f "$NAME" >/dev/null 2>&1 || true

# Run the container with whichever keys are in env. We deliberately
# don't put the keys in the image; they come in via -e at runtime.
docker run -d --name "$NAME" \
  -e MIOT_HARNESS_ENV=eval \
  ${ANTHROPIC_API_KEY:+-e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"} \
  ${OPENAI_API_KEY:+-e OPENAI_API_KEY="$OPENAI_API_KEY"} \
  -p "${PORT}:8000" \
  "$TAG" >/dev/null

# Wait for boot before invoking the demo. Reuses the polling pattern
# from 02-image-boots.sh — keep them in sync if you change either.
# Fail-fast on timeout so a never-ready container surfaces here with a
# clear message instead of a confusing "demo command exited 1" later.
DEADLINE=$(( $(date +%s) + 15 ))
READY=0
while [[ $(date +%s) -lt $DEADLINE ]]; do
  if curl -fs --max-time 2 "http://localhost:${PORT}/health" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 0.5
done

if [[ "$READY" != "1" ]]; then
  fail "/health on port ${PORT} did not respond within 15s"
fi

# The demo CLI is a console-script entrypoint. We pass a benign
# storytelling prompt that exercises the supervisor + a tool call,
# bounded by a wall-clock timeout so a hung agent fails loudly.
OUTPUT_FILE=$(mktemp)
if ! timeout "$DEMO_TIMEOUT_S" docker exec "$NAME" miot-harness demo \
     "Tell me the story of delivery compliance this month." > "$OUTPUT_FILE" 2>&1; then
  echo "--- last 30 lines of demo output ---" >&2
  tail -n 30 "$OUTPUT_FILE" >&2 || true
  rm -f "$OUTPUT_FILE"
  fail "demo command did not complete within ${DEMO_TIMEOUT_S}s"
fi

# Loose answer presence check — if the supervisor produced anything
# resembling text we count it as a wires-connected success. Strict
# quality assertions belong in the agent-quality eval suite.
if [[ ! -s "$OUTPUT_FILE" ]]; then
  rm -f "$OUTPUT_FILE"
  fail "demo produced empty output"
fi

LINES=$(wc -l < "$OUTPUT_FILE" | tr -d ' ')
rm -f "$OUTPUT_FILE"

echo "PASS $ID — demo completed (~${LINES} lines of output)"
