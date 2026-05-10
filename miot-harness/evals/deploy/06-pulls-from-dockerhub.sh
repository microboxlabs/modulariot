#!/usr/bin/env bash
# 06-pulls-from-dockerhub.sh — Category C.6
# Asserts: the harness image is pullable from the Docker Hub mirror.
# Catches silent push failures (DOCKERHUB_TOKEN rotated, the
# `if: github.event_name != 'pull_request'` guard misfires, etc.).
#
# This script is meaningless on PR runs (Docker Hub mirror is non-PR
# only). The CI workflow only runs it when the event is not a PR.
#
# Usage:  bash 06-pulls-from-dockerhub.sh <tag-or-digest>
# Env:    HARNESS_EVAL_DOCKERHUB (default: docker.io/microboxlabs/miot-harness)
set -euo pipefail

ID="06-pulls-from-dockerhub"
REGISTRY="${HARNESS_EVAL_DOCKERHUB:-docker.io/microboxlabs/miot-harness}"

if [[ $# -lt 1 ]]; then
  echo "FAIL $ID — usage: $0 <tag-or-digest>"
  exit 2
fi
REF_ARG="$1"

if [[ "$REF_ARG" == sha256:* ]]; then
  REF="$REGISTRY@$REF_ARG"
else
  REF="$REGISTRY:$REF_ARG"
fi

cleanup() { docker image rm -f "$REF" >/dev/null 2>&1 || true; }
trap cleanup EXIT

if ! docker pull "$REF" >/tmp/${ID}.log 2>&1; then
  tail -n 20 /tmp/${ID}.log >&2
  echo "FAIL $ID — could not pull $REF from Docker Hub"
  exit 1
fi

PULLED_DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' "$REF" 2>/dev/null | sed -n 's/.*@\(sha256:[a-f0-9]\+\).*/\1/p')

echo "PASS $ID — pulled $REF (${PULLED_DIGEST:-unknown digest})"
