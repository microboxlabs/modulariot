#!/usr/bin/env bash
# Simulate a Meta WhatsApp Cloud API inbound webhook against a running modulith, signed exactly
# like Meta signs it (X-Hub-Signature-256 = HMAC-SHA256(app_secret, rawBody)), so the POST
# round-trips through the real WhatsAppSignatureVerifier + ingestion — no real device needed.
#
# Usage:
#   CONNECTION_ID=<id> APP_SECRET=<secret> PHONE_NUMBER_ID=<id> ./simulate-meta-inbound.sh [message|status]
#
# Env (all overridable):
#   BASE_URL          modulith root (default http://localhost:8180)
#   CONNECTION_ID     the WHATSAPP connection the webhook URL names (REQUIRED)
#   APP_SECRET        Meta App secret used to sign the body (REQUIRED — must match the connection's)
#   PHONE_NUMBER_ID   the receiving number's id; must match the org's WHATSAPP connection metadata
#   FROM              the driver's number in international digits (default a placeholder)
#   WAMID             the message/status id (default time-stamped so reruns aren't deduped)
#
# Numbers here are placeholders — pass a real test number via FROM only at runtime, never commit it.
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8180}"
PHONE_NUMBER_ID="${PHONE_NUMBER_ID:-PNID_REPLACE_ME}"
FROM="${FROM:-56900000001}"
KIND="${1:-message}"
TS="$(date +%s)"
WAMID="${WAMID:-wamid.sim.${TS}}"

if [[ -z "${APP_SECRET:-}" || -z "${CONNECTION_ID:-}" ]]; then
  echo "ERROR: CONNECTION_ID and APP_SECRET are required (the App secret stored on that connection)." >&2
  exit 2
fi

case "$KIND" in
  message)
    PAYLOAD=$(cat <<JSON
{"object":"whatsapp_business_account","entry":[{"id":"WABA_SIM","changes":[{"field":"messages","value":{"messaging_product":"whatsapp","metadata":{"display_phone_number":"15550000000","phone_number_id":"${PHONE_NUMBER_ID}"},"contacts":[{"profile":{"name":"Sim Driver"},"wa_id":"${FROM}"}],"messages":[{"from":"${FROM}","id":"${WAMID}","timestamp":"${TS}","type":"text","text":{"body":"Mensaje de prueba ${TS}"}}]}}]}]}
JSON
)
    ;;
  status)
    # Mirrors a delivered callback for an outbound message. Set WAMID to a real outbound wamid to
    # see it advance in the inbox; otherwise it is ignored as an unknown wamid (by design).
    PAYLOAD=$(cat <<JSON
{"object":"whatsapp_business_account","entry":[{"id":"WABA_SIM","changes":[{"field":"messages","value":{"messaging_product":"whatsapp","metadata":{"display_phone_number":"15550000000","phone_number_id":"${PHONE_NUMBER_ID}"},"statuses":[{"id":"${WAMID}","status":"delivered","timestamp":"${TS}","recipient_id":"${FROM}"}]}}]}]}
JSON
)
    ;;
  *)
    echo "ERROR: unknown kind '$KIND' (expected 'message' or 'status')." >&2
    exit 2
    ;;
esac

# Sign the EXACT bytes we send (printf '%s' = no trailing newline; curl --data sends them verbatim).
SIG="sha256=$(printf '%s' "$PAYLOAD" | openssl dgst -sha256 -hmac "$APP_SECRET" -hex | sed 's/^.*= //')"

echo "POST ${BASE_URL}/webhooks/whatsapp/${CONNECTION_ID}  (${KIND}, wamid=${WAMID})"
curl -sS -i -X POST \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: ${SIG}" \
  --data "$PAYLOAD" \
  "${BASE_URL}/webhooks/whatsapp/${CONNECTION_ID}"
echo
