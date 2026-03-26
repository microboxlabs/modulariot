#!/usr/bin/env bash
# Collect all issues across org repos that belong to a release milestone
# and/or an OSS tracking milestone, then output them as a JSON array.
# Designed to feed the gh-release-writer skill.
#
# Requirements: gh (GitHub CLI, authenticated), jq
#
# Usage:
#   ./fetch-release-issues.sh --release 1.27.0
#   ./fetch-release-issues.sh --release 1.27.0 --oss MIOT-0.2.0
#   ./fetch-release-issues.sh --release 1.27.0 --oss MIOT-0.2.0 --state closed
#
# Options:
#   --org ORG         GitHub org (default: GH_PROJECT_OWNER env, or microboxlabs)
#   --release NAME    Release milestone title (e.g. 1.27.0)  [required]
#   --oss NAME        OSS milestone title (e.g. MIOT-0.2.0)  [optional]
#   --state STATE     Issue state: open|closed|all            (default: all)
#   -h                Show this help

set -euo pipefail

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
ORG="${GH_PROJECT_OWNER:-microboxlabs}"
RELEASE_MILESTONE=""
OSS_MILESTONE=""
STATE="all"

usage() {
  echo "Usage: $0 --release VERSION [--oss OSS_MILESTONE] [--org ORG] [--state STATE] [-h]"
  echo "  --release NAME    Release milestone title (e.g. 1.27.0)  [required]"
  echo "  --oss NAME        OSS milestone title (e.g. MIOT-0.2.0)  [optional]"
  echo "  --org ORG         GitHub org (default: ${ORG})"
  echo "  --state STATE     open|closed|all (default: all)"
  echo "  -h                This help"
  return 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --release) RELEASE_MILESTONE="$2"; shift 2 ;;
    --oss)     OSS_MILESTONE="$2";     shift 2 ;;
    --org)     ORG="$2";               shift 2 ;;
    --state)   STATE="$2";             shift 2 ;;
    -h) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ -z "$RELEASE_MILESTONE" ]]; then
  echo "Error: --release is required." >&2
  usage; exit 1
fi

# ---------------------------------------------------------------------------
# Dependency check
# ---------------------------------------------------------------------------
for cmd in gh jq; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "Error: '$cmd' is required but not installed." >&2
    exit 1
  fi
done

# ---------------------------------------------------------------------------
# Milestone list: "title:source" pairs
# source = "release" (versioned) | "oss" (OSS integration)
# ---------------------------------------------------------------------------
MILESTONE_ENTRIES=()
MILESTONE_ENTRIES+=("${RELEASE_MILESTONE}:release")
[[ -n "$OSS_MILESTONE" ]] && MILESTONE_ENTRIES+=("${OSS_MILESTONE}:oss")

# ---------------------------------------------------------------------------
# Temp file — one compact JSON object per line (NDJSON), wrapped at the end
# ---------------------------------------------------------------------------
ISSUES_FILE=$(mktemp)
trap 'rm -f "$ISSUES_FILE"' EXIT

# ---------------------------------------------------------------------------
# Step 1 — list all repos in the org (paginated)
# ---------------------------------------------------------------------------
echo "Fetching repos for org: ${ORG}..." >&2
REPOS=()
api_page=1
while true; do
  PAGE=$(gh api "orgs/${ORG}/repos?per_page=100&page=${api_page}&type=all" \
    --jq '.[].full_name' 2>/dev/null || echo "")
  [[ -z "$PAGE" ]] && break
  while IFS= read -r r; do REPOS+=("$r"); done <<< "$PAGE"
  page_count=$(echo "$PAGE" | wc -l | tr -d ' ')
  [[ "$page_count" -lt 100 ]] && break
  api_page=$((api_page + 1))
done
echo "  -> ${#REPOS[@]} repos" >&2
echo "" >&2

# ---------------------------------------------------------------------------
# Step 2 — for each repo × milestone, collect matching issues
# ---------------------------------------------------------------------------
TOTAL_FOUND=0

for repo in "${REPOS[@]}"; do
  for entry in "${MILESTONE_ENTRIES[@]}"; do
    milestone_title="${entry%%:*}"
    milestone_source="${entry##*:}"

    # NOTE: gh api --jq does not forward --arg to jq; always pipe to jq directly.
    MILESTONE_NUM=$(gh api \
      "repos/${repo}/milestones?state=all&per_page=100" 2>/dev/null \
      | jq -r --arg m "$milestone_title" \
          '.[] | select(.title == $m) | .number' 2>/dev/null \
      || echo "")

    [[ -z "$MILESTONE_NUM" ]] && continue

    echo "  [${milestone_source}] ${repo}  milestone '${milestone_title}' -> #${MILESTONE_NUM}" >&2

    # Paginate issues for this milestone
    api_page=1
    while true; do
      # Fetch page into a variable so we can count and emit without a double API call
      PAGE_JSON=$(gh api \
        "repos/${repo}/issues?milestone=${MILESTONE_NUM}&state=${STATE}&per_page=100&page=${api_page}" \
        2>/dev/null || echo "[]")

      # Count non-PR issues on this page
      page_count=$(echo "$PAGE_JSON" \
        | jq '[.[] | select(.pull_request == null)] | length')

      # Emit each issue as a compact JSON object (NDJSON line) into the accumulator
      echo "$PAGE_JSON" \
        | jq -c --arg repo "$repo" \
               --arg ms   "$milestone_title" \
               --arg src  "$milestone_source" \
          '.[] | select(.pull_request == null) | {
              repo:      $repo,
              number:    .number,
              title:     .title,
              body:      (.body // ""),
              labels:    [.labels[].name],
              state:     .state,
              url:       .html_url,
              milestone: $ms,
              source:    $src
            }' >> "$ISSUES_FILE"

      TOTAL_FOUND=$((TOTAL_FOUND + page_count))
      [[ "$page_count" -lt 100 ]] && break
      api_page=$((api_page + 1))
    done
  done
done

echo "" >&2
echo "Total issues collected: ${TOTAL_FOUND}" >&2

# ---------------------------------------------------------------------------
# Step 3 — wrap NDJSON accumulator into a proper JSON array
# ---------------------------------------------------------------------------
if [[ ! -s "$ISSUES_FILE" ]]; then
  echo "[]"
  exit 0
fi

jq -s '.' "$ISSUES_FILE"
