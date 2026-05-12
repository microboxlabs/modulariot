#!/usr/bin/env bash
# Bring up the local Langfuse + OTel Collector stack for miot-harness (plan 13 §B3).
#
# Run from `infra/observability/`. Idempotent: re-running checks state and
# only does what's missing.
#
# Steps:
#   1. docker compose up -d (postgres / clickhouse / redis / minio / langfuse / collector)
#   2. Wait for langfuse-web /api/public/health → 200
#   3. Provision the `miot-harness-local` project + API keys via the Langfuse
#      bootstrap API (uses LANGFUSE_INIT_* envs declared in docker-compose.yml)
#   4. Print the keys for the operator to paste into the harness `.env`.
#
# The Langfuse v3 project keys are deterministic given the LANGFUSE_INIT_*
# envs, so re-runs are safe and produce the same keys.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

LANGFUSE_URL="${LANGFUSE_URL:-http://localhost:3000}"
LANGFUSE_USER="${LANGFUSE_INIT_USER_EMAIL:-dev@modulariot.local}"
LANGFUSE_PASS="${LANGFUSE_INIT_USER_PASSWORD:-please-change-this}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"  # seconds

require() {
  command -v "$1" >/dev/null 2>&1 || { echo "missing dep: $1" >&2; exit 1; }
}
require docker
require curl

echo "==> docker compose up -d"
docker compose up -d

echo "==> waiting for langfuse-web health (up to ${HEALTH_TIMEOUT}s)"
elapsed=0
until curl -fsS "${LANGFUSE_URL}/api/public/health" >/dev/null 2>&1; do
  if (( elapsed >= HEALTH_TIMEOUT )); then
    echo "FAIL: langfuse-web did not become healthy in ${HEALTH_TIMEOUT}s" >&2
    docker compose logs --tail 50 langfuse-web
    exit 1
  fi
  printf '.'
  sleep 3
  elapsed=$(( elapsed + 3 ))
done
echo
echo "ok: langfuse-web healthy at ${LANGFUSE_URL}"

echo "==> resolving project keys"
# Langfuse v3 returns a single { publicKey, secretKey } pair per project
# via the /api/public/projects/{id}/api-keys endpoint, gated by HTTP Basic
# auth (the org owner credentials we set via LANGFUSE_INIT_USER_*).
KEYS_PAYLOAD="$(
  curl -fsS \
    -u "${LANGFUSE_USER}:${LANGFUSE_PASS}" \
    -H 'Content-Type: application/json' \
    -X POST "${LANGFUSE_URL}/api/public/projects/miot-harness-local/api-keys" \
    -d '{"note":"miot-harness bootstrap key"}' \
    2>/dev/null || true
)"

if [[ -z "$KEYS_PAYLOAD" || "$KEYS_PAYLOAD" == "null" ]]; then
  cat <<'EOF' >&2
WARN: could not auto-provision API keys.
  Visit ${LANGFUSE_URL} → log in as the dev user → Project Settings → API Keys.
  Create a new key pair and paste the values into miot-harness/.env:

    MIOT_HARNESS_LANGFUSE_PUBLIC_KEY=pk-lf-...
    MIOT_HARNESS_LANGFUSE_SECRET_KEY=sk-lf-...
EOF
  exit 0
fi

PUBLIC_KEY="$(printf '%s' "$KEYS_PAYLOAD" | python3 -c "import sys,json;print(json.load(sys.stdin).get('publicKey',''))")"
SECRET_KEY="$(printf '%s' "$KEYS_PAYLOAD" | python3 -c "import sys,json;print(json.load(sys.stdin).get('secretKey',''))")"

if [[ -z "$PUBLIC_KEY" || -z "$SECRET_KEY" ]]; then
  echo "WARN: bootstrap API responded but did not return both keys; check Langfuse UI." >&2
  echo "$KEYS_PAYLOAD" >&2
  exit 0
fi

cat <<EOF

================================================================================
Langfuse local stack is up.

  UI:        ${LANGFUSE_URL}
  User:      ${LANGFUSE_USER}
  Password:  (set via LANGFUSE_INIT_USER_PASSWORD in docker-compose.yml)
  Project:   miot-harness-local

Paste these into miot-harness/.env (they are gitignored):

  MIOT_HARNESS_LANGFUSE_PUBLIC_KEY=${PUBLIC_KEY}
  MIOT_HARNESS_LANGFUSE_SECRET_KEY=${SECRET_KEY}

And toggle telemetry on:

  MIOT_HARNESS_OTEL_ENABLED=true
  MIOT_HARNESS_OTEL_ENDPOINT=http://localhost:4317

The OTel Collector at :4317 fans out to Langfuse on the docker network.
================================================================================
EOF
