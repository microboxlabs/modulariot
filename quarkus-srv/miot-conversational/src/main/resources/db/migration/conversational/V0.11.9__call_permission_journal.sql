-- Preserve an existing permission as the replay checkpoint before journaling its first new event.
CREATE TABLE miot_conversational.conv_call_permission_checkpoint
    (LIKE miot_conversational.conv_call_permission INCLUDING ALL);
CREATE TABLE miot_conversational.conv_call_permission_event (
    business_phone_number_id VARCHAR(128) NOT NULL,
    contact_e164 VARCHAR(32) NOT NULL,
    event_id TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    payload JSONB NOT NULL,
    PRIMARY KEY (business_phone_number_id, contact_e164, event_id)
);
-- A retried send must recover its request accounting without counting the same wamid twice.
DELETE FROM miot_conversational.conv_call_permission_request a
USING miot_conversational.conv_call_permission_request b
WHERE a.wamid IS NOT NULL AND a.wamid = b.wamid
  AND a.business_phone_number_id = b.business_phone_number_id AND a.contact_e164 = b.contact_e164
  AND (a.sent_at, a.id) > (b.sent_at, b.id);
CREATE UNIQUE INDEX conv_call_request_wamid_idx
    ON miot_conversational.conv_call_permission_request (business_phone_number_id, contact_e164, wamid)
    WHERE wamid IS NOT NULL;
