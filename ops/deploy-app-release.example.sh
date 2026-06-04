#!/usr/bin/env bash
set -euo pipefail

# Contract used by .github/workflows/app-release-train.yml.
# Copy this file to ops/deploy-app-release.sh and replace the echo blocks with
# your provider-specific commands.
#
# Required environment:
#   APP_VERSION         App semver, for example 0.5.5
#   APP_TAG             Scoped git tag, for example app@v0.5.5
#   IMAGE_REF           Immutable image digest, for example ghcr.io/...@sha256:...
#   DEPLOY_ENVIRONMENTS Comma-separated environment names, for example staging,production
#
# Workflow setup note:
#   The release workflow expects a repository or environment secret named
#   COPILOT_PAT with the "Copilot Requests" permission enabled.
#   RELEASE_BOT_TOKEN is used to collect release issues across org repos and
#   create the release PR. It needs repo read access plus contents/pull-request
#   write access on this repository.

: "${APP_VERSION:?APP_VERSION is required}"
: "${APP_TAG:?APP_TAG is required}"
: "${IMAGE_REF:?IMAGE_REF is required}"
: "${DEPLOY_ENVIRONMENTS:?DEPLOY_ENVIRONMENTS is required}"

IFS=, read -ra environments <<< "$DEPLOY_ENVIRONMENTS"

for environment in "${environments[@]}"; do
  environment="$(echo "$environment" | xargs)"
  [[ -z "$environment" ]] && continue

  echo "Deploying $APP_TAG ($IMAGE_REF) to $environment"

  # Examples of the work this hook should perform:
  # - update APP_VERSION / RELEASE_VERSION in the target environment
  # - update the app image to IMAGE_REF
  # - run the platform rollout command
  # - wait for rollout health checks
  #
  # Kubernetes example:
  # kubectl --context "$environment" \
  #   set image deployment/miot-app miot-app="$IMAGE_REF" \
  #   --namespace modulariot
  # kubectl --context "$environment" \
  #   set env deployment/miot-app APP_VERSION="$APP_VERSION" \
  #   --namespace modulariot
  # kubectl --context "$environment" \
  #   rollout status deployment/miot-app \
  #   --namespace modulariot
done
