#!/usr/bin/env bash
# 01-image-builds.sh — Category A.1
# Asserts:
#   1) `docker build` succeeds for the harness Dockerfile.
#   2) The resulting image's COMPRESSED size is ≤ MAX_COMPRESSED_MB.
#      Compressed size is what registry push and k8s pull actually
#      transfer; uncompressed (`docker images`) is misleading.
#
# First stdout line: `PASS|FAIL <ID>` — easy to grep from CI logs.
# Self-cleans the test image on exit (pass or fail).
set -euo pipefail

ID="01-image-builds"
TAG="${HARNESS_EVAL_TAG:-miot-harness:eval}"
HARNESS_VERSION="${HARNESS_VERSION:-0.0.0-eval}"
MAX_COMPRESSED_MB="${HARNESS_EVAL_MAX_COMPRESSED_MB:-250}"

# Resolve script dir → repo root → miot-harness/ as build context.
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HARNESS_DIR="$(cd "$HERE/../.." && pwd)"

# On failure, remove the partial/bad image so the next run starts
# clean. On success, leave the image — 02-image-boots.sh and
# 03-image-runs-demo.sh consume it; final cleanup is run-all.sh's job.
cleanup_on_failure() {
  if [[ "$?" -ne 0 ]]; then
    docker image rm -f "$TAG" >/dev/null 2>&1 || true
  fi
}
trap cleanup_on_failure EXIT

fail() {
  echo "FAIL $ID — $1"
  exit 1
}

# 1) build
if ! docker build -t "$TAG" --build-arg "HARNESS_VERSION=$HARNESS_VERSION" "$HARNESS_DIR" >/tmp/${ID}.build.log 2>&1; then
  echo "--- last 30 lines of build log ---"
  tail -n 30 /tmp/${ID}.build.log || true
  fail "docker build failed; see /tmp/${ID}.build.log"
fi

# 2) compressed size
COMPRESSED_BYTES=$(docker save "$TAG" 2>/dev/null | gzip -1 | wc -c | tr -d ' ')
COMPRESSED_MB=$(( COMPRESSED_BYTES / 1024 / 1024 ))

if [[ "$COMPRESSED_MB" -gt "$MAX_COMPRESSED_MB" ]]; then
  fail "compressed image $COMPRESSED_MB MB > budget $MAX_COMPRESSED_MB MB"
fi

echo "PASS $ID — built $TAG, compressed=${COMPRESSED_MB}MB (budget ${MAX_COMPRESSED_MB}MB)"
