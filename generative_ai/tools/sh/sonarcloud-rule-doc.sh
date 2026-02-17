#!/usr/bin/env bash
# Fetch SonarCloud rule documentation by rule key (e.g. java:S1144).
# Requires: curl, jq. Set SONAR_TOKEN (or pass -t TOKEN).
#
# Usage:
#   sonarcloud-rule-doc.sh java:S1144
#   sonarcloud-rule-doc.sh -r java:S1144
#   SONAR_TOKEN=xxx sonarcloud-rule-doc.sh java:S1144
#   sonarcloud-rule-doc.sh -t xxx java:S1144 -o md   # prefer markdown if available

set -e

BASE_URL="https://sonarcloud.io/api/rules/show"
OUTPUT="text"   # text | md | json | url
ORG="${SONAR_ORGANIZATION:-microboxlabs}"

usage() {
  echo "Usage: $0 [-t TOKEN] [-r] RULE_KEY [-o text|md|json|url] [-g ORG]"
  echo "  -t TOKEN   SonarCloud token (default: SONAR_TOKEN env)"
  echo "  -g ORG     SonarCloud organization (default: microboxlabs or SONAR_ORGANIZATION)"
  echo "  -r         Optional, next arg is RULE_KEY"
  echo "  RULE_KEY   Rule key (e.g. java:S1144, java:S1192)"
  echo "  -o FORMAT  text (default): name + description, strip HTML"
  echo "             md: raw description (HTML or MD)"
  echo "             json: full API response"
  echo "             url: print rule URL only"
  exit 0
}

RULE_KEY=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -t) SONAR_TOKEN="$2"; shift 2 ;;
    -g) ORG="$2"; shift 2 ;;
    -r) RULE_KEY="$2"; shift 2 ;;
    -o) OUTPUT="$2"; shift 2 ;;
    -h) usage ;;
    -*) shift ;;
    *)  [[ -z "$RULE_KEY" ]] && RULE_KEY="$1"; shift ;;
  esac
done

if [[ -z "${RULE_KEY}" ]]; then
  echo "Error: RULE_KEY required (e.g. java:S1144)" >&2
  usage
fi

if [[ -z "${SONAR_TOKEN}" ]]; then
  echo "Error: Set SONAR_TOKEN or pass -t TOKEN" >&2
  exit 1
fi

RESP=$(curl -sS -u "${SONAR_TOKEN}:" -G \
  --data-urlencode "key=${RULE_KEY}" \
  --data-urlencode "organization=${ORG}" \
  "${BASE_URL}")

if echo "$RESP" | jq -e '.errors' >/dev/null 2>&1; then
  echo "$RESP" | jq -r '.errors[].msg' >&2
  exit 1
fi

# Rule URL on SonarCloud (coding rules page with rule opened)
RULE_ENC=$(echo -n "$RULE_KEY" | jq -sRr @uri)
RULE_URL="https://sonarcloud.io/coding_rules?open=${RULE_ENC}"

case "$OUTPUT" in
  url)
    echo "$RULE_URL"
    exit 0
    ;;
  json)
    echo "$RESP"
    exit 0
    ;;
  *)
    # fall through to text/md handling below
    ;;
esac

# Extract rule fields
NAME=$(echo "$RESP" | jq -r '.rule.name')
SEV=$(echo "$RESP" | jq -r '.rule.severity // "N/A"')
TYPE=$(echo "$RESP" | jq -r '.rule.type // "N/A"')
# Prefer mdDesc if present, else htmlDesc
DESC=$(echo "$RESP" | jq -r 'if .rule.mdDesc then .rule.mdDesc else .rule.htmlDesc // .rule.description // "" end')

if [[ "$OUTPUT" = "md" ]]; then
  echo "# ${RULE_KEY}: ${NAME}"
  echo "Severity: ${SEV} | Type: ${TYPE}"
  echo "URL: ${RULE_URL}"
  echo ""
  echo "$DESC"
  exit 0
fi

# text: strip basic HTML for terminal readability
echo "Rule: ${RULE_KEY}"
echo "Name: ${NAME}"
echo "Severity: ${SEV} | Type: ${TYPE}"
echo "URL: ${RULE_URL}"
echo "---"
# Strip HTML tags and collapse newlines for readability
echo "$DESC" | sed 's/<[^>]*>//g' | sed 's/&nbsp;/ /g; s/&lt;/</g; s/&gt;/>/g; s/&amp;/\&/g' | fold -s -w 80
echo ""
