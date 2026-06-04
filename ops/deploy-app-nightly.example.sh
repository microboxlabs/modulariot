#!/usr/bin/env bash
set -euo pipefail

# Copy this file to ops/deploy-app-nightly.sh and replace the echo blocks with
# the real development environment deployment commands.
#
# Required environment:
#   IMAGE_REF           Immutable image digest, for example ghcr.io/...@sha256:...
#   IMAGE_TAG           Moving tag, normally nightly
#   GIT_SHA             Source commit SHA
#   SHORT_SHA           Short source commit SHA
#   NIGHTLY_DATE        UTC build date in YYYYMMDD format
#   DEPLOY_ENVIRONMENTS Comma-separated environment names, for example dev,qa

: "${IMAGE_REF:?IMAGE_REF is required}"
: "${IMAGE_TAG:?IMAGE_TAG is required}"
: "${GIT_SHA:?GIT_SHA is required}"
: "${SHORT_SHA:?SHORT_SHA is required}"
: "${NIGHTLY_DATE:?NIGHTLY_DATE is required}"
: "${DEPLOY_ENVIRONMENTS:?DEPLOY_ENVIRONMENTS is required}"

IFS=, read -ra environments <<< "$DEPLOY_ENVIRONMENTS"

for environment in "${environments[@]}"; do
  environment="$(echo "$environment" | xargs)"
  [[ -z "$environment" ]] && continue

  echo "Deploying $IMAGE_TAG ($IMAGE_REF) to $environment"

  # Replace this section with the real deployment mechanism. Common examples:
  # - update the app image reference in Helm/Kubernetes
  # - update APP_VERSION / RELEASE_VERSION / BUILD_SHA in the target environment
  # - restart or roll out the workload
  #
  # kubectl --context "$environment" \
  #   set image deployment/miot-app miot-app="$IMAGE_REF" \
  #   --namespace modulariot
  #
  # kubectl --context "$environment" \
  #   set env deployment/miot-app \
  #   APP_VERSION="$IMAGE_TAG" \
  #   RELEASE_VERSION="$IMAGE_TAG" \
  #   BUILD_SHA="$GIT_SHA" \
  #   NIGHTLY_DATE="$NIGHTLY_DATE" \
  #   --namespace modulariot
  #
  # kubectl --context "$environment" \
  #   rollout status deployment/miot-app \
  #   --namespace modulariot
done
