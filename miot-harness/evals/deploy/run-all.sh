#!/usr/bin/env bash
# run-all.sh — Orchestrator for deploy evals (plan 13/10-deploy-evals.md).
# Runs Category A scripts (image builds, boots, demo) sequentially.
# Each script's first stdout line is a PASS|FAIL <ID> token; we capture
# them all so a single failing eval doesn't hide later ones.
#
# Usage:
#   bash evals/deploy/run-all.sh                 # category A only
#   bash evals/deploy/run-all.sh --with-distribution
#                                                # add Category C scripts
#                                                # (registry pulls + attestations);
#                                                # 04-08 land in T10a.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

WITH_DISTRIBUTION=0
for arg in "$@"; do
  case "$arg" in
    --with-distribution) WITH_DISTRIBUTION=1 ;;
    *) echo "unknown arg: $arg" >&2; exit 2 ;;
  esac
done

declare -a CATEGORY_A=(
  "01-image-builds.sh"
  "02-image-boots.sh"
  "03-image-runs-demo.sh"
)

declare -a SCRIPTS=("${CATEGORY_A[@]}")

if [[ "$WITH_DISTRIBUTION" == "1" ]]; then
  echo "(--with-distribution) Category C scripts not yet implemented; T10a." >&2
  echo "Continuing with Category A only." >&2
fi

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
