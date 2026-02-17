#!/usr/bin/env bash
# Fetch open SonarCloud issues for this project and print them in the CLI.
# Requires: curl, jq. Set SONAR_TOKEN (or pass -t TOKEN).
#
# Usage:
#   SONAR_TOKEN=your_token ./tools/scripts/sonarcloud-issues.sh
#   ./tools/scripts/sonarcloud-issues.sh -t your_token
#   # Current branch (e.g. PR branch) – issues for the branch SonarCloud analyzed:
#   ./tools/scripts/sonarcloud-issues.sh --branch
#   ./tools/scripts/sonarcloud-issues.sh -b feature/my-pr
#   # Current pull request – issues reported for the PR (SonarCloud PR decoration):
#   ./tools/scripts/sonarcloud-issues.sh --pr
#   ./tools/scripts/sonarcloud-issues.sh -p 42
#   ./tools/scripts/sonarcloud-issues.sh -t your_token -s CRITICAL,BLOCKER

set -e

PROJECT_KEY="${SONAR_PROJECT_KEY:-microboxlabs_modulariot}"
BASE_URL="https://sonarcloud.io/api/issues/search"
RESOLVED="false"
SEVERITIES=""
PAGESIZE=500
BRANCH=""
PULL_REQUEST=""
OUTPUT_FORMAT="list"
WITH_DOCS=""

usage() {
  echo "Usage: $0 [-t TOKEN] [-k PROJECT_KEY] [-b BRANCH|--branch] [-p PR|--pr|--pr-current] [-s SEVERITIES] [-h]"
  echo "  -t TOKEN       SonarCloud token (default: SONAR_TOKEN env)"
  echo "  -k PROJECT_KEY Project key (default: microboxlabs_modulariot)"
  echo "  -b BRANCH      Branch to filter. Omit for main branch issues."
  echo "  --branch       Use current git branch"
  echo "  -p PR          Pull request key (e.g. 42) – issues for that PR"
  echo "  --pr           Same as -p, with PR number detected (gh, GITHUB_REF, or CI env)"
  echo "  -s SEVERITIES  Comma-separated: BLOCKER,CRITICAL,MAJOR,MINOR,INFO (default: all)"
  echo "  -o FORMAT      list (default) | context (LLM-friendly: file, line, rule key, message)"
  echo "  --with-docs    With -o context: fetch and append rule documentation for each rule (extra API calls)"
  echo "  -h             This help"
  exit 0
}

# Detect current PR number (GitHub, GitLab, Azure DevOps, Bitbucket)
detect_pr() {
  if command -v gh &>/dev/null; then
    gh pr view --json number -q .number 2>/dev/null && return 0
  fi
  if [[ -n "${GITHUB_REF}" ]]; then
    # e.g. refs/pull/123/merge -> 123
    local n="${GITHUB_REF#refs/pull/}"
    [[ "$n" != "$GITHUB_REF" ]] && echo "${n%/merge}" && return 0
  fi
  if [[ -n "${CI_MERGE_REQUEST_IID}" ]]; then
    echo "${CI_MERGE_REQUEST_IID}" && return 0
  fi
  if [[ -n "${SYSTEM_PULLREQUEST_PULLREQUESTID}" ]]; then
    echo "${SYSTEM_PULLREQUEST_PULLREQUESTID}" && return 0
  fi
  if [[ -n "${BITBUCKET_PR_ID}" ]]; then
    echo "${BITBUCKET_PR_ID}" && return 0
  fi
  return 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -t) SONAR_TOKEN="$2"; shift 2 ;;
    -k) PROJECT_KEY="$2"; shift 2 ;;
    -b) BRANCH="$2"; shift 2 ;;
    --branch)
      BRANCH=$(git branch --show-current 2>/dev/null || git rev-parse --abbrev-ref HEAD 2>/dev/null)
      if [[ -z "$BRANCH" ]]; then
        echo "Error: Could not detect git branch (not a repo or detached HEAD)" >&2
        exit 1
      fi
      shift
      ;;
    -p) PULL_REQUEST="$2"; shift 2 ;;
    --pr)
      PULL_REQUEST=$(detect_pr) || {
        echo "Error: Could not detect PR (install gh, or run from CI, or use -p PR_NUMBER)" >&2
        exit 1
      }
      shift
      ;;
    -s) SEVERITIES="$2"; shift 2 ;;
    -o) OUTPUT_FORMAT="$2"; shift 2 ;;
    --with-docs) WITH_DOCS=1; shift ;;
    -h) usage ;;
    *) usage ;;
  esac
done

if [[ -z "${SONAR_TOKEN}" ]]; then
  echo "Error: Set SONAR_TOKEN or pass -t TOKEN" >&2
  exit 1
fi

# Build query params (curl -G encodes branch name safely)
PARAMS=(
  --data-urlencode "projectKeys=${PROJECT_KEY}"
  --data-urlencode "resolved=${RESOLVED}"
  --data-urlencode "ps=${PAGESIZE}"
)
[[ -n "${SEVERITIES}" ]]   && PARAMS+=(--data-urlencode "severities=${SEVERITIES}")
[[ -n "${BRANCH}" ]]       && PARAMS+=(--data-urlencode "branch=${BRANCH}")
[[ -n "${PULL_REQUEST}" ]] && PARAMS+=(--data-urlencode "pullRequest=${PULL_REQUEST}")

# Fetch and pretty-print issues
RESP=$(curl -sS -u "${SONAR_TOKEN}:" -G "${PARAMS[@]}" "${BASE_URL}")
if echo "$RESP" | jq -e '.errors' >/dev/null 2>&1; then
  echo "$RESP" | jq -r '.errors[].msg' >&2
  exit 1
fi

TOTAL=$(echo "$RESP" | jq -r '.total')
SCOPE_LABEL=""
[[ -n "${PULL_REQUEST}" ]] && SCOPE_LABEL=" pullRequest: ${PULL_REQUEST}"
[[ -n "${BRANCH}" ]]       && SCOPE_LABEL="${SCOPE_LABEL} branch: ${BRANCH}"
echo "=== SonarCloud issues (open): ${TOTAL} === project: ${PROJECT_KEY}${SCOPE_LABEL}"
echo ""

if [[ "${TOTAL}" -eq 0 ]]; then
  echo "(no open issues)"
  exit 0
fi

case "$OUTPUT_FORMAT" in
  context)
    # LLM-friendly: one block per issue with file, line, rule key, message (good context for fixes)
    echo "$RESP" | jq -r '
      .issues[] |
      "---\nFile: \(.component | split(":")[-1])\nLine: \(.line // "?")\nRule: \(.rule)\nSeverity: \(.severity)\nMessage: \(.message)\n"
    '
    if [[ -n "$WITH_DOCS" ]]; then
      SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
      RULES=$(echo "$RESP" | jq -r '.issues[].rule' | sort -u)
      echo ""
      echo "=== Rule documentation ==="
      while IFS= read -r r; do
        [[ -z "$r" ]] && continue
        echo ""
        echo "--- Rule: $r ---"
        "$SCRIPT_DIR/sonarcloud-rule-doc.sh" -t "${SONAR_TOKEN}" -o text "$r" 2>/dev/null || true
      done <<< "$RULES"
    else
      echo "Tip: fetch rule docs with ./generative_ai/tools/sh/sonarcloud-rule-doc.sh <Rule> or use --with-docs"
    fi
    ;;
  list|*)
    # Table with full rule key (so you can run sonarcloud-rule-doc.sh <rule> for docs)
    echo "$RESP" | jq -r '
      .issues[] |
      "\(.severity)\t\(.rule)\t\(.component | split(":")[-1]):\(.line // "?")\t\(.message)"
    ' 2>/dev/null || {
      echo "$RESP" | jq -r '.issues[] | "\(.severity) \(.rule) \(.component | split(":")[-1]):\(.line // "?") \(.message)"'
    }
    ;;
esac
