#!/usr/bin/env bash
# Bring up the local Langfuse + OTel Collector stack for miot-harness (plan 13 §B3).
#
# Run from `miot-harness/infra/observability/`. Idempotent: re-running checks state and
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

echo "==> reading project keys from running Postgres (set via LANGFUSE_INIT_PROJECT_*_KEY)"
# Langfuse v3 mints the initial API key pair from `LANGFUSE_INIT_PROJECT_*_KEY`
# envs during the org/project bootstrap. The keys are deterministic given the
# env values, so this command always prints the same pair until you rotate.
KEY_ROW="$(
  docker compose exec -T postgres psql -U postgres -d postgres -t -A -F'|' \
    -c "SELECT public_key, display_secret_key FROM api_keys WHERE project_id = 'miot-harness-local' ORDER BY created_at LIMIT 1;" 2>/dev/null || true
)"

PUBLIC_KEY="${KEY_ROW%%|*}"
DISPLAY_SECRET="${KEY_ROW##*|}"

if [[ -z "$PUBLIC_KEY" || -z "$DISPLAY_SECRET" ]]; then
  cat <<EOF >&2
WARN: could not read keys from Postgres. Either Langfuse didn't auto-bootstrap
  the project (check \`docker compose logs langfuse-web\`) or you rotated the
  init envs without nuking the volumes. Recover via:

    docker compose down -v && docker compose up -d

EOF
  exit 1
fi

# The full secret key only exists in the env vars and (hashed) in Postgres.
# We surface the env value directly so the operator gets the working secret.
SECRET_KEY="$(grep LANGFUSE_INIT_PROJECT_SECRET_KEY docker-compose.yml | head -1 | awk '{print $2}')"

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
