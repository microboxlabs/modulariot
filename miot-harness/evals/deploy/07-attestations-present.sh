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

# `gh attestation verify` filters by `--predicate-type` (default:
# https://slsa.dev/provenance/v1). A single call only ever returns one
# predicate, so we must verify provenance and SBOM independently.
# SBOM predicate types: SPDX -> https://spdx.dev/Document,
# CycloneDX -> https://cyclonedx.org/bom. We try SPDX first (what
# `anchore/sbom-action` + `actions/attest-sbom` emit by default with
# `format: spdx-json`), then fall back to CycloneDX.

if ! gh attestation verify "$REF" --owner "$OWNER" \
    --predicate-type "https://slsa.dev/provenance/v1" \
    --format=json >/tmp/${ID}-prov.json 2>/tmp/${ID}-prov.err; then
  echo "FAIL $ID — SLSA provenance attestation does not verify for $REF (owner=$OWNER)"
  echo "--- stderr ---" >&2
  tail -n 20 /tmp/${ID}-prov.err >&2 || true
  exit 1
fi

SBOM_OK=0
for PT in "https://spdx.dev/Document" "https://cyclonedx.org/bom"; do
  if gh attestation verify "$REF" --owner "$OWNER" \
      --predicate-type "$PT" \
      --format=json >/tmp/${ID}-sbom.json 2>/tmp/${ID}-sbom.err; then
    SBOM_OK=1
    break
  fi
done

if [[ "$SBOM_OK" -ne 1 ]]; then
  echo "FAIL $ID — no SBOM attestation (SPDX or CycloneDX) verifies for $REF (owner=$OWNER)"
  echo "--- stderr ---" >&2
  tail -n 20 /tmp/${ID}-sbom.err >&2 || true
  exit 1
fi

echo "PASS $ID — provenance + SBOM attestations present and verify"
