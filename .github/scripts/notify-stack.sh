#!/usr/bin/env bash
set -euo pipefail

: "${EXPECTED_SHA:?Source SHA is required}"
: "${GH_TOKEN:?Artifact notification token is required}"
receiver="${DEPLOY_DISPATCH_REPO:-microboxlabs/miot-deployments}"
jq -e --arg sha "$EXPECTED_SHA" '
  .event_type == "miot-stack-available" and .client_payload.git_sha == $sha and
  (.client_payload.channel == "nightly" or .client_payload.channel == "release") and
  ((.client_payload | keys) - ["release_version", "release_notes_version", "channel", "stack_tag",
    "git_sha", "short_sha", "built_at", "workflow_run_url", "manifest_version", "components"] | length == 0)
' stack-available-payload.json >/dev/null
gh api "repos/${receiver}/dispatches" --method POST --input stack-available-payload.json
echo "Artifact availability notification sent."
