#!/usr/bin/env bash
set -euo pipefail

: "${SHA_IMAGE:?SHA_IMAGE is required}"
: "${LATEST_IMAGE:?LATEST_IMAGE is required}"
: "${SHORT_SHA:?SHORT_SHA is required}"
: "${EXPECT_SHA:?EXPECT_SHA is required}"
: "${NIGHTLY_IMAGE_TAG:?NIGHTLY_IMAGE_TAG is required}"
: "${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"

max_attempts=30
delay=10
source_image=""
source_tag=""
for attempt in $(seq 1 "$max_attempts"); do
  if docker buildx imagetools inspect "$SHA_IMAGE" >/dev/null 2>&1; then
    source_image="$SHA_IMAGE"
    source_tag="sha-${SHORT_SHA}"
    break
  fi
  if [[ "$EXPECT_SHA" != "true" ]]; then
    break
  fi
  echo "Attempt ${attempt}/${max_attempts}: ${SHA_IMAGE} not in registry yet; retrying in ${delay}s..."
  sleep "$delay"
done

if [[ -z "$source_image" ]]; then
  if [[ "$EXPECT_SHA" == "true" ]]; then
    echo "::error::${SHA_IMAGE} never became available; refusing to use :latest." >&2
    exit 1
  fi
  echo "::notice::${SHA_IMAGE} not found (component unchanged this build); falling back to ${LATEST_IMAGE}."
  source_image="$LATEST_IMAGE"
  source_tag="latest"
fi

docker buildx imagetools inspect "$source_image" >/dev/null
{
  echo "source_image=$source_image"
  echo "source_tag=$source_tag"
  echo "image_tag=$NIGHTLY_IMAGE_TAG"
} >> "$GITHUB_OUTPUT"
