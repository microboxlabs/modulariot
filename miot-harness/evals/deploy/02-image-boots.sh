#!/usr/bin/env bash
# 02-image-boots.sh — Category A.2
# Asserts: a freshly-started container responds 200 on /health within
# BOOT_TIMEOUT_S, and the response payload has the deploy-readable
# shape ({status, env, nexo:{enabled, tools[], snapshot_age_minutes}}).
#
# Race-condition note: `docker run -d` returns BEFORE uvicorn binds the
# port. We poll `curl` in a bounded loop instead of `sleep N + curl` so
# slow CI runners don't FAIL spuriously and a hanging container doesn't
# loop forever. `pgrep`-style shell checks would miss the
# already-bound-but-not-responding case.
set -euo pipefail

ID="02-image-boots"
TAG="${HARNESS_EVAL_TAG:-miot-harness:eval}"
NAME="${HARNESS_EVAL_NAME:-miot-harness-eval}"
PORT="${HARNESS_EVAL_PORT:-18765}"
BOOT_TIMEOUT_S="${HARNESS_EVAL_BOOT_TIMEOUT_S:-15}"

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

# Pre-clean: stale container from a previous run blocks port reuse.
docker rm -f "$NAME" >/dev/null 2>&1 || true

if ! docker image inspect "$TAG" >/dev/null 2>&1; then
  fail "image $TAG not found — run 01-image-builds.sh first"
fi

# Start with a minimal env so Nexo is disabled (no DB tunnel needed).
docker run -d --name "$NAME" \
  -e MIOT_HARNESS_ENV=eval \
  -p "${PORT}:8000" \
  "$TAG" >/dev/null

# Poll /health up to BOOT_TIMEOUT_S seconds.
DEADLINE=$(( $(date +%s) + BOOT_TIMEOUT_S ))
RESPONSE=""
while [[ $(date +%s) -lt $DEADLINE ]]; do
  if RESPONSE=$(curl -fs --max-time 2 "http://localhost:${PORT}/health" 2>/dev/null); then
    break
  fi
  # Container exited? short-circuit instead of grinding through the timeout.
  if ! docker ps --format '{{.Names}}' | grep -qx "$NAME"; then
    fail "container exited before /health responded"
  fi
  sleep 0.5
done

if [[ -z "$RESPONSE" ]]; then
  fail "/health did not respond within ${BOOT_TIMEOUT_S}s"
fi

# Shape check: tolerate missing jq by using grep fallbacks. We don't
# parse fully — just confirm the deploy-readable keys are present.
required_keys=("status" "env" "enabled" "tools" "snapshot_age_minutes")
for key in "${required_keys[@]}"; do
  if ! echo "$RESPONSE" | grep -q "\"$key\""; then
    fail "/health payload missing key \"$key\" — got: $RESPONSE"
  fi
done

echo "PASS $ID — container booted, /health 200 with expected shape"
