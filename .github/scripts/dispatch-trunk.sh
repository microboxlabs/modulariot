#!/usr/bin/env bash
set -euo pipefail

: "${EXPECTED_SHA:?Selected trunk SHA is required}"
: "${DEPLOYMENT_PROVIDER:?Select azure or gke}"
DEPLOY_DISPATCH_REPO="${DEPLOY_DISPATCH_REPO:-microboxlabs/miot-deployments}"
if [[ -z "${GH_TOKEN:-}" ]]; then
  echo "DEPLOY_DISPATCH_TOKEN is required to dispatch the private deployment repository." >&2
  exit 1
fi
jq -e --arg sha "$EXPECTED_SHA" --arg provider "$DEPLOYMENT_PROVIDER" '
  ($provider == "azure" or $provider == "gke") and
  .event_type == "miot-stack-trunk" and .client_payload.deploy_kind == "trunk" and
  .client_payload.git_sha == $sha and .client_payload.deployment_provider == $provider
' nightly-dispatch-payload.json >/dev/null
gh api "repos/${DEPLOY_DISPATCH_REPO}/dispatches" --method POST --input nightly-dispatch-payload.json
echo "Dispatched trunk commit $EXPECTED_SHA to $DEPLOYMENT_PROVIDER via $DEPLOY_DISPATCH_REPO."
