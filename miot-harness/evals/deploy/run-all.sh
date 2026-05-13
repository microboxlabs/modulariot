#!/usr/bin/env bash
# run-all.sh — Orchestrator for Category A deploy evals (image builds,
# boots, demo). Each script's first stdout line is a PASS|FAIL <ID>
# token; we capture them all so a single failing eval doesn't hide
# later ones.
#
# Category C scripts (05-pulls-from-ghcr, 06-pulls-from-dockerhub,
# 07-attestations-present) take registry-derived args (digest, run-id)
# only available after publish-image. CI's distribution-evals job
# invokes them directly with the real values; local invocation is
# `bash 0X-foo.sh <arg>` after a real push.
#
# Usage: bash evals/deploy/run-all.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if (( $# > 0 )); then
  echo "unknown arg: $1 — run-all.sh takes no flags" >&2
  exit 2
fi

declare -a SCRIPTS=(
  "01-image-builds.sh"
  "02-image-boots.sh"
  "03-image-runs-demo.sh"
)

PASS=0
FAIL=0
SKIP=0
declare -a SUMMARY=()

for script in "${SCRIPTS[@]}"; do
  echo "==================================================================="
  echo "▶  $script"
  echo "==================================================================="
  if FIRST=$(bash "$HERE/$script" 2>&1 | tee /dev/stderr | head -n 1); then
    case "$FIRST" in
      "PASS"*"SKIPPED"*) SKIP=$((SKIP+1)); SUMMARY+=("⏭  $FIRST") ;;
      "PASS"*)           PASS=$((PASS+1)); SUMMARY+=("✅ $FIRST") ;;
      *)                 FAIL=$((FAIL+1)); SUMMARY+=("❓ $FIRST") ;;
    esac
  else
    FAIL=$((FAIL+1))
    SUMMARY+=("❌ $script (exit non-zero)")
  fi
  echo
done

# Final image cleanup. 01 leaves the image so 02/03 can use it; the
# orchestrator owns the end-of-suite teardown so a manual single-script
# run keeps the artifact around for iteration but a full run cleans up.
docker image rm -f "${HARNESS_EVAL_TAG:-miot-harness:eval}" >/dev/null 2>&1 || true

echo "==================================================================="
echo "Summary"
echo "==================================================================="
for line in "${SUMMARY[@]}"; do echo "  $line"; done
echo
echo "  pass: $PASS   fail: $FAIL   skipped: $SKIP"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
exit 0
