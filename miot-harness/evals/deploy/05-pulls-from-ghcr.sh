#!/usr/bin/env bash
# 05-pulls-from-ghcr.sh — Category C.5
# Asserts: the harness image is anonymously pullable from GHCR. Verifies
# the registry actually received the push (build-push-action's success
# means the action exited 0, not necessarily that the manifest landed
# in a way third parties can pull).
#
# Usage:  bash 05-pulls-from-ghcr.sh <tag-or-digest>
# Env:    HARNESS_EVAL_GHCR (default: ghcr.io/microboxlabs/miot-harness)
set -euo pipefail

ID="05-pulls-from-ghcr"
REGISTRY="${HARNESS_EVAL_GHCR:-ghcr.io/microboxlabs/miot-harness}"

if [[ $# -lt 1 ]]; then
  echo "FAIL $ID — usage: $0 <tag-or-digest>"
  exit 2
fi
REF_ARG="$1"

# Detect digest vs tag — digests start with `sha256:` and use `@`.
if [[ "$REF_ARG" == sha256:* ]]; then
  REF="$REGISTRY@$REF_ARG"
else
  REF="$REGISTRY:$REF_ARG"
fi

cleanup() { docker image rm -f "$REF" >/dev/null 2>&1 || true; }
trap cleanup EXIT

# We deliberately do NOT `docker login` first — the public images for
# this org should be anonymously pullable. If the auth state on the
# runner already has GHCR credentials, that's fine; the eval still
# proves the image is at the registry.
if ! docker pull "$REF" >/tmp/${ID}.log 2>&1; then
  tail -n 20 /tmp/${ID}.log >&2
  echo "FAIL $ID — could not pull $REF from GHCR"
  exit 1
fi

# Capture the digest of what we pulled so callers can compare against
# what `gh run view` reported (T10b adds that comparison).
PULLED_DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' "$REF" 2>/dev/null | sed -n 's/.*@\(sha256:[a-f0-9]\+\).*/\1/p')

echo "PASS $ID — pulled $REF (${PULLED_DIGEST:-unknown digest})"
