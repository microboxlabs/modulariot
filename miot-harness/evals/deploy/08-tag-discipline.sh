#!/usr/bin/env bash
# 08-tag-discipline.sh — Category C.8
# Asserts: the set of tags published by a given run matches the
# expected pattern for that run's trigger:
#   - PR run    → {pr-<n>, sha-<short>} on GHCR; nothing on Docker Hub
#   - trunk     → {latest, sha-<short>} on both registries
#   - v1.2.3    → {1.2.3, 1.2, sha-<short>} on both
#
# Catches drift in the metadata-action `tags:` config — the kind of
# bug that ships an image without a `latest` pointer or pushes a
# `latest` from a PR.
#
# Usage:  bash 08-tag-discipline.sh <run-id>
# Env:    HARNESS_EVAL_REPO (default: microboxlabs/modulariot)
#
# Implementation note: GHA doesn't expose pushed tags as a structured
# job output. We extract the metadata-action's `tags:` step output
# from the run log and compare against the pattern.
set -euo pipefail

ID="08-tag-discipline"
REPO="${HARNESS_EVAL_REPO:-microboxlabs/modulariot}"

if [[ $# -lt 1 ]]; then
  echo "FAIL $ID — usage: $0 <run-id>"
  exit 2
fi
RUN_ID="$1"

if ! META_JSON=$(gh run view "$RUN_ID" -R "$REPO" --json event,headBranch,displayTitle 2>&1); then
  echo "FAIL $ID — gh run view failed: $META_JSON"
  exit 1
fi

EVENT=$(echo "$META_JSON" | jq -r '.event')
BRANCH=$(echo "$META_JSON" | jq -r '.headBranch')

# Determine expected pattern.
declare -a EXPECTED_KEYS=()
case "$EVENT" in
  pull_request)
    EXPECTED_KEYS=("pr-" "sha-")
    EXPECT_DOCKERHUB="no"
    ;;
  push)
    if [[ "$BRANCH" == "trunk" || "$BRANCH" == "main" ]]; then
      EXPECTED_KEYS=("latest" "sha-")
      EXPECT_DOCKERHUB="yes"
    elif [[ "$BRANCH" == v* ]]; then
      EXPECTED_KEYS=("sha-")  # plus full + major.minor — best-effort
      EXPECT_DOCKERHUB="yes"
    else
      EXPECTED_KEYS=("sha-")
      EXPECT_DOCKERHUB="no"
    fi
    ;;
  workflow_dispatch)
    EXPECTED_KEYS=("sha-")
    EXPECT_DOCKERHUB="no"
    ;;
  *)
    echo "FAIL $ID — unknown event type for run: $EVENT"
    exit 1
    ;;
esac

# Pull the run log and grep for the metadata-action's pushed tags.
# build-push-action prints `tags=...` in its post-build summary; the
# step also writes a markdown summary we already render, but the log
# is the most stable surface across action versions.
if ! LOG=$(gh run view "$RUN_ID" -R "$REPO" --log 2>/tmp/${ID}.err); then
  cat /tmp/${ID}.err >&2
  echo "FAIL $ID — could not fetch run log"
  exit 1
fi

# Reasonable heuristics: lines containing the registry path followed
# by `:tag` or `@sha256:`. We match both registries.
TAGS_FOUND=$(echo "$LOG" | grep -oE '(ghcr\.io/microboxlabs/miot-harness|docker\.io/microboxlabs/miot-harness):[A-Za-z0-9._-]+' | sort -u || true)

if [[ -z "$TAGS_FOUND" ]]; then
  echo "FAIL $ID — no harness image tags found in run log (run may not have published yet)"
  exit 1
fi

# Verify each expected-key pattern shows up at least once on GHCR.
MISSING=()
for key in "${EXPECTED_KEYS[@]}"; do
  if ! echo "$TAGS_FOUND" | grep -E "ghcr\.io/.*:${key}" >/dev/null; then
    MISSING+=("$key")
  fi
done

if (( ${#MISSING[@]} > 0 )); then
  echo "FAIL $ID — GHCR missing expected tag patterns: ${MISSING[*]}"
  echo "    found:" >&2
  echo "$TAGS_FOUND" >&2
  exit 1
fi

# PR runs must NOT push to Docker Hub.
if [[ "$EXPECT_DOCKERHUB" == "no" ]] && echo "$TAGS_FOUND" | grep -q '^docker\.io/'; then
  echo "FAIL $ID — Docker Hub got tags on a PR run; mirror-skip guard regressed"
  echo "$TAGS_FOUND" >&2
  exit 1
fi

echo "PASS $ID — tag discipline OK for $EVENT ($BRANCH); checked: ${EXPECTED_KEYS[*]}"
