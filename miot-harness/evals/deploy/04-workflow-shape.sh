#!/usr/bin/env bash
# 04-workflow-shape.sh — Category B (optional)
# Asserts: a given GHA run for harness.yaml ran the expected job set in
# the expected order. Catches workflow-drift over time (e.g. someone
# silently removes the `distribution-evals` job and CI keeps passing).
#
# Usage:  bash 04-workflow-shape.sh <run-id>
# Env:    HARNESS_EVAL_REPO (default: microboxlabs/modulariot)
set -euo pipefail

ID="04-workflow-shape"
REPO="${HARNESS_EVAL_REPO:-microboxlabs/modulariot}"

if [[ $# -lt 1 ]]; then
  echo "FAIL $ID — usage: $0 <run-id>"
  exit 2
fi
RUN_ID="$1"

# These names must match harness.yaml's jobs. Update both together.
EXPECTED_JOBS=(
  "Lint & Test"
  "Image Evals (pre-publish)"
  "Build & Publish Image"
  "Distribution Evals"
  "Security Scan"
  "Build Summary"
)

if ! JOBS_JSON=$(gh run view "$RUN_ID" -R "$REPO" --json jobs 2>&1); then
  echo "FAIL $ID — gh run view failed: $JOBS_JSON"
  exit 1
fi

ACTUAL=$(echo "$JOBS_JSON" | jq -r '.jobs[].name')

MISSING=()
for want in "${EXPECTED_JOBS[@]}"; do
  if ! echo "$ACTUAL" | grep -qxF "$want"; then
    MISSING+=("$want")
  fi
done

if (( ${#MISSING[@]} > 0 )); then
  echo "FAIL $ID — missing jobs: ${MISSING[*]}"
  exit 1
fi

echo "PASS $ID — all ${#EXPECTED_JOBS[@]} expected jobs present in run $RUN_ID"
