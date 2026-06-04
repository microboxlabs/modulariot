#!/usr/bin/env bash
# Close matching release milestones across all repositories in a GitHub org.
#
# Requirements: gh (GitHub CLI, authenticated), jq
#
# Usage:
#   ./close-release-milestones.sh --release 1.31.2 --oss MIOT-0.5.5
#
# Options:
#   --org ORG         GitHub org (default: GH_PROJECT_OWNER env, or microboxlabs)
#   --release NAME    Private release milestone title (e.g. 1.31.2) [required]
#   --oss NAME        OSS milestone title (e.g. MIOT-0.5.5)         [optional]
#   -h                Show this help

set -euo pipefail

ORG="${GH_PROJECT_OWNER:-microboxlabs}"
RELEASE_MILESTONE=""
OSS_MILESTONE=""

usage() {
  echo "Usage: $0 --release VERSION [--oss OSS_MILESTONE] [--org ORG] [-h]"
  echo "  --release NAME    Private release milestone title (e.g. 1.31.2) [required]"
  echo "  --oss NAME        OSS milestone title (e.g. MIOT-0.5.5)         [optional]"
  echo "  --org ORG         GitHub org (default: ${ORG})"
  echo "  -h                This help"
  return 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --release) RELEASE_MILESTONE="$2"; shift 2 ;;
    --oss)     OSS_MILESTONE="$2";     shift 2 ;;
    --org)     ORG="$2";               shift 2 ;;
    -h) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ -z "$RELEASE_MILESTONE" ]]; then
  echo "Error: --release is required." >&2
  usage; exit 1
fi

for cmd in gh jq; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "Error: '$cmd' is required but not installed." >&2
    exit 1
  fi
done

MILESTONE_ENTRIES=("${RELEASE_MILESTONE}:private")
[[ -n "$OSS_MILESTONE" ]] && MILESTONE_ENTRIES+=("${OSS_MILESTONE}:oss")

echo "Fetching repos for org: ${ORG}..." >&2
REPOS=()
api_page=1
while true; do
  PAGE=$(gh api "orgs/${ORG}/repos?per_page=100&page=${api_page}&type=all" \
    --jq '.[].full_name' 2>/dev/null || echo "")
  [[ -z "$PAGE" ]] && break
  while IFS= read -r repo; do REPOS+=("$repo"); done <<< "$PAGE"
  page_count=$(echo "$PAGE" | wc -l | tr -d ' ')
  [[ "$page_count" -lt 100 ]] && break
  api_page=$((api_page + 1))
done

echo "  -> ${#REPOS[@]} repos" >&2

closed_count=0
already_closed_count=0
missing_count=0

for repo in "${REPOS[@]}"; do
  milestones_json="$(gh api "repos/${repo}/milestones?state=all&per_page=100" 2>/dev/null || echo "[]")"

  for entry in "${MILESTONE_ENTRIES[@]}"; do
    milestone_title="${entry%%:*}"
    milestone_source="${entry##*:}"

    milestone="$(echo "$milestones_json" | jq -c --arg title "$milestone_title" '.[] | select(.title == $title)' | head -1)"

    if [[ -z "$milestone" ]]; then
      missing_count=$((missing_count + 1))
      continue
    fi

    milestone_number="$(echo "$milestone" | jq -r '.number')"
    milestone_state="$(echo "$milestone" | jq -r '.state')"

    if [[ "$milestone_state" == "closed" ]]; then
      echo "Already closed: [$milestone_source] $repo milestone '$milestone_title' (#$milestone_number)" >&2
      already_closed_count=$((already_closed_count + 1))
      continue
    fi

    echo "Closing: [$milestone_source] $repo milestone '$milestone_title' (#$milestone_number)" >&2
    gh api \
      --method PATCH \
      "repos/${repo}/milestones/${milestone_number}" \
      -f state=closed >/dev/null
    closed_count=$((closed_count + 1))
  done
done

echo "" >&2
echo "Milestones closed: ${closed_count}" >&2
echo "Already closed: ${already_closed_count}" >&2
echo "Missing repo/milestone pairs skipped: ${missing_count}" >&2
