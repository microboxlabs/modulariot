-- A run started on request (POST /rules/{id}/invoke) instead of by its trigger.
-- recipients: the people the request named for some of the rule's groups, {"<group id>": [{"name", "email", "phone"}]};
-- null when the run writes to the rule's groups as they are.
-- invocation_key: the caller's key; a second request with the same key for the same rule starts nothing.

ALTER TABLE miot_conversational.conv_run
    ADD COLUMN recipients     JSONB,
    ADD COLUMN invocation_key VARCHAR(200);

CREATE UNIQUE INDEX idx_conv_run_invocation_key
    ON miot_conversational.conv_run (rule_id, invocation_key)
    WHERE invocation_key IS NOT NULL;
