-- A test send: a run of a rule's draft that writes to one chosen person instead of the rule's recipients.
-- spec is the draft as it was when the test started; the run's rule_version is 'prueba'.

CREATE TABLE miot_conversational.conv_run_test_send (
    run_id UUID PRIMARY KEY REFERENCES miot_conversational.conv_run (id) ON DELETE CASCADE,
    spec   JSONB        NOT NULL,
    email  VARCHAR(320),
    phone  VARCHAR(32),
    name   VARCHAR(255),
    CONSTRAINT chk_conv_run_test_send_to CHECK (email IS NOT NULL OR phone IS NOT NULL)
);
