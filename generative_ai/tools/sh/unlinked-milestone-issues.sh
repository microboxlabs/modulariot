#!/usr/bin/env bash
# Scan all repos in a GitHub org and detect issues with a given milestone
# that are NOT linked to a GitHub Project (by number).
# Covers both open and closed issues.
#
# Requirements: gh (GitHub CLI, authenticated), jq
#
# Usage:
#   ./generative_ai/tools/sh/unlinked-milestone-issues.sh [options]
#
# Options:
#   --org ORG          GitHub org (default: GH_PROJECT_OWNER env, or microboxlabs)
#   --project NUMBER   Project number (default: GH_PROJECT_NUMBER env, or 4)
#   --milestone NAME   Milestone title to filter (default: MIOT-0.2.0)
#   --json             Output unlinked issues as JSON array
#   -h                 Show this help

set -euo pipefail

# ---------------------------------------------------------------------------
# Defaults (can be overridden by env or flags)
# ---------------------------------------------------------------------------
ORG="${GH_PROJECT_OWNER:-microboxlabs}"
PROJECT_NUMBER="${GH_PROJECT_NUMBER:-4}"
MILESTONE="MIOT-0.2.0"
OUTPUT_JSON=""

usage() {
  echo "Usage: $0 [--org ORG] [--project NUMBER] [--milestone NAME] [--json] [-h]"
  echo "  --org ORG          GitHub org (default: ${ORG})"
  echo "  --project NUMBER   Project number (default: ${PROJECT_NUMBER})"
  echo "  --milestone NAME   Milestone title (default: ${MILESTONE})"
  echo "  --json             Output unlinked issues as JSON array"
  echo "  -h                 This help"
  return 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --org)       ORG="$2";            shift 2 ;;
    --project)   PROJECT_NUMBER="$2"; shift 2 ;;
    --milestone) MILESTONE="$2";      shift 2 ;;
    --json)      OUTPUT_JSON=1;       shift   ;;
    -h)          usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

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
# Temp file for project item list (one "owner/repo#number" per line)
# ---------------------------------------------------------------------------
PROJECT_ITEMS_FILE=$(mktemp)
trap 'rm -f "$PROJECT_ITEMS_FILE"' EXIT

# ---------------------------------------------------------------------------
# Step 1 — Collect all issues linked to the project via GraphQL (paginated)
# ---------------------------------------------------------------------------
echo "=== org: ${ORG}  |  project: #${PROJECT_NUMBER}  |  milestone: ${MILESTONE} ==="
echo ""
echo "[1/3] Fetching items linked to project #${PROJECT_NUMBER}..."

# First-page query (no cursor required)
# shellcheck disable=SC2016
GQL_FIRST='
query($org: String!, $number: Int!) {
  organization(login: $org) {
    projectV2(number: $number) {
      items(first: 100) {
        pageInfo { hasNextPage endCursor }
        nodes {
          content {
            ... on Issue {
              number
              repository { nameWithOwner }
            }
          }
        }
      }
    }
  }
}'

# Subsequent-page query (cursor required)
# shellcheck disable=SC2016
GQL_NEXT='
query($org: String!, $number: Int!, $cursor: String!) {
  organization(login: $org) {
    projectV2(number: $number) {
      items(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          content {
            ... on Issue {
              number
              repository { nameWithOwner }
            }
          }
        }
      }
    }
  }
}'

_extract_items() {
  # $1 = raw GraphQL JSON; prints "owner/repo#number" lines
  echo "$1" | jq -r '
    .data.organization.projectV2.items.nodes[] |
    select(.content != null and .content.number != null) |
    .content.repository.nameWithOwner + "#" + (.content.number | tostring)
  ' 2>/dev/null || true
}

RESP=$(gh api graphql -f query="$GQL_FIRST" -f org="$ORG" -F number="$PROJECT_NUMBER")
_extract_items "$RESP" >> "$PROJECT_ITEMS_FILE"
HAS_NEXT=$(echo "$RESP" | jq -r '.data.organization.projectV2.items.pageInfo.hasNextPage')
CURSOR=$(echo "$RESP"  | jq -r '.data.organization.projectV2.items.pageInfo.endCursor')

while [[ "$HAS_NEXT" == "true" ]]; do
  RESP=$(gh api graphql -f query="$GQL_NEXT" \
    -f org="$ORG" -F number="$PROJECT_NUMBER" -f cursor="$CURSOR")
  _extract_items "$RESP" >> "$PROJECT_ITEMS_FILE"
  HAS_NEXT=$(echo "$RESP" | jq -r '.data.organization.projectV2.items.pageInfo.hasNextPage')
  CURSOR=$(echo "$RESP"  | jq -r '.data.organization.projectV2.items.pageInfo.endCursor')
done

PROJECT_ITEM_COUNT=$(wc -l < "$PROJECT_ITEMS_FILE" | tr -d ' ')
echo "    -> ${PROJECT_ITEM_COUNT} issues linked to project #${PROJECT_NUMBER}"
echo ""

# ---------------------------------------------------------------------------
# Step 2 — List all repos in the org (REST, paginated)
# ---------------------------------------------------------------------------
echo "[2/3] Fetching all repos in ${ORG}..."
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
echo "    -> ${#REPOS[@]} repos found"
echo ""

# ---------------------------------------------------------------------------
# Step 3 — Per repo: find the milestone, then compare each issue
# ---------------------------------------------------------------------------
echo "[3/3] Scanning repos for milestone '${MILESTONE}'..."
echo ""

TOTAL_MILESTONE_ISSUES=0
TOTAL_UNLINKED=0
REPOS_WITH_HITS=0

# Accumulate JSON items
JSON_ITEMS=()

for repo in "${REPOS[@]}"; do
  # Look up milestone number for this repo (title-based search).
  # NOTE: gh api --jq does not forward --arg to jq, so we pipe to jq directly.
  MILESTONE_NUM=$(gh api \
    "repos/${repo}/milestones?state=all&per_page=100" \
    2>/dev/null \
    | jq -r --arg m "$MILESTONE" '.[] | select(.title == $m) | .number' \
    2>/dev/null || echo "")

  [[ -z "$MILESTONE_NUM" ]] && continue

  echo "  Found milestone in: ${repo} (milestone #${MILESTONE_NUM})"

  # Collect unlinked issues for this repo across all pages
  REPO_LINES=()   # plain-text lines
  REPO_JSON=()    # JSON objects
  REPO_UNLINKED=0
  api_page=1

  while true; do
    ISSUES=$(gh api \
      "repos/${repo}/issues?milestone=${MILESTONE_NUM}&state=all&per_page=100&page=${api_page}" \
      --jq '[.[] | select(.pull_request == null) |
             {number: .number, title: .title, state: .state, url: .html_url}]' \
      2>/dev/null || echo "[]")

    page_count=$(echo "$ISSUES" | jq 'length')
    [[ "$page_count" -eq 0 ]] && break

    TOTAL_MILESTONE_ISSUES=$((TOTAL_MILESTONE_ISSUES + page_count))

    # Check each issue against the project item list
    while IFS=$'\t' read -r num title state url; do
      key="${repo}#${num}"
      if ! grep -qF "$key" "$PROJECT_ITEMS_FILE"; then
        REPO_UNLINKED=$((REPO_UNLINKED + 1))
        REPO_LINES+=("  [${state^^}] #${num}  ${url}")
        REPO_LINES+=("         ${title}")
        # Build JSON object (title already escaped by jq @json below, but we use printf)
        ESCAPED_TITLE=$(printf '%s' "$title" | jq -Rs '.[:-1]')
        REPO_JSON+=("{\"repo\":\"${repo}\",\"number\":${num},\"state\":\"${state}\",\"title\":${ESCAPED_TITLE},\"url\":\"${url}\"}")
      fi
    done < <(echo "$ISSUES" | jq -r '.[] | [(.number | tostring), .title, .state, .html_url] | @tsv')

    [[ "$page_count" -lt 100 ]] && break
    api_page=$((api_page + 1))
  done

  if [[ "$REPO_UNLINKED" -gt 0 ]]; then
    TOTAL_UNLINKED=$((TOTAL_UNLINKED + REPO_UNLINKED))
    REPOS_WITH_HITS=$((REPOS_WITH_HITS + 1))

    # Plain-text output: print immediately (repo header + issue lines)
    if [[ -z "$OUTPUT_JSON" ]]; then
      printf "\n%s  (%d unlinked)\n" "$repo" "$REPO_UNLINKED"
      for line in "${REPO_LINES[@]}"; do
        printf "%s\n" "$line"
      done
    fi

    # Accumulate JSON items
    for item in "${REPO_JSON[@]}"; do
      JSON_ITEMS+=("$item")
    done
  fi
done

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "=== Summary ==="
echo "  Issues with milestone '${MILESTONE}'       : ${TOTAL_MILESTONE_ISSUES}"
echo "  NOT linked to project #${PROJECT_NUMBER}   : ${TOTAL_UNLINKED}"
echo "  Repos with unlinked issues                 : ${REPOS_WITH_HITS}"
echo ""

if [[ "$TOTAL_UNLINKED" -eq 0 ]]; then
  echo "All milestone issues are already linked to project #${PROJECT_NUMBER}."
  exit 0
fi

# ---------------------------------------------------------------------------
# JSON output
# ---------------------------------------------------------------------------
if [[ -n "$OUTPUT_JSON" ]]; then
  # Join array with commas and wrap in []
  printf '[\n'
  first=1
  for item in "${JSON_ITEMS[@]}"; do
    if [[ "$first" -eq 1 ]]; then
      first=0
    else
      printf ',\n'
    fi
    printf '  %s' "$item"
  done
  printf '\n]\n'
fi
