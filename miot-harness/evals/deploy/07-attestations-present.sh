#!/usr/bin/env bash
# 07-attestations-present.sh — Category C.7
# Asserts: the published image has both a SLSA provenance attestation
# and an SBOM attestation, signed by GitHub's OIDC identity. Catches
# the silent-regression case where someone removes `provenance: true`
# or `sbom: true` from the build-push-action call (image still
# functional, but supply-chain audit story collapses).
#
# Negative-control proof: invoke this against an image built without
# `provenance: true, sbom: true` — it must FAIL loudly. Verify
# manually as part of T10b.
#
# Usage:  bash 07-attestations-present.sh <digest>     (digest with sha256: prefix)
# Env:    HARNESS_EVAL_OWNER (default: microboxlabs)
#         HARNESS_EVAL_GHCR  (default: ghcr.io/microboxlabs/miot-harness)
#
# `gh attestation verify` flag surface has been moving. The current
# robust pattern (gh ≥ 2.78) is:
#   gh attestation verify oci://<image>@<digest> --owner <org>
# which exits 0 when ANY signed in-toto attestation matches the owner.
# To disambiguate provenance vs SBOM we use --predicate-type when the
# CLI supports it; otherwise fall back to JSON parsing.
set -euo pipefail

ID="07-attestations-present"
OWNER="${HARNESS_EVAL_OWNER:-microboxlabs}"
REGISTRY="${HARNESS_EVAL_GHCR:-ghcr.io/microboxlabs/miot-harness}"

if [[ $# -lt 1 ]]; then
  echo "FAIL $ID — usage: $0 <digest sha256:...>"
  exit 2
fi
DIGEST="$1"

if [[ "$DIGEST" != sha256:* ]]; then
  echo "FAIL $ID — digest must start with 'sha256:' (got: $DIGEST)"
  exit 1
fi

REF="oci://$REGISTRY@$DIGEST"

# Smoke test that any attestation verifies first — clearer error
# distinction than failing inside a predicate-specific call.
if ! gh attestation verify "$REF" --owner "$OWNER" --format=json >/tmp/${ID}.json 2>/tmp/${ID}.err; then
  echo "FAIL $ID — no attestation verifies for $REF (owner=$OWNER)"
  echo "--- stderr ---" >&2
  tail -n 20 /tmp/${ID}.err >&2 || true
  exit 1
fi

# Parse predicate types out of the JSON. Different gh versions emit
# different shapes; we look at all string values containing
# 'predicateType' to be liberal.
PREDICATES=$(grep -oE '"predicateType"[[:space:]]*:[[:space:]]*"[^"]+"' /tmp/${ID}.json | sed 's/.*"\([^"]\+\)"$/\1/' | sort -u)

HAS_PROVENANCE=$(echo "$PREDICATES" | grep -i 'provenance' || true)
HAS_SBOM=$(echo "$PREDICATES" | grep -iE 'spdx|cyclonedx|sbom' || true)

if [[ -z "$HAS_PROVENANCE" ]]; then
  echo "FAIL $ID — no SLSA provenance predicate in attestations"
  echo "    predicate types found: ${PREDICATES:-<none>}" >&2
  exit 1
fi

if [[ -z "$HAS_SBOM" ]]; then
  echo "FAIL $ID — no SBOM predicate (SPDX/CycloneDX) in attestations"
  echo "    predicate types found: ${PREDICATES:-<none>}" >&2
  exit 1
fi

echo "PASS $ID — provenance + SBOM attestations present and verify"
