-- Rule versions become semantic versions, like symptoms: published version N becomes 0.N.0, so the first
-- publish stays 0.1.0. conv_rule_version.bump records PATCH, MINOR or MAJOR for each published version.

ALTER TABLE miot_conversational.conv_rule
    ALTER COLUMN current_version TYPE VARCHAR(32)
    USING CASE WHEN current_version IS NULL THEN NULL ELSE '0.' || current_version || '.0' END;

ALTER TABLE miot_conversational.conv_rule_version
    DROP CONSTRAINT uq_conv_rule_version,
    ALTER COLUMN version TYPE VARCHAR(32)
    USING CASE WHEN version IS NULL THEN NULL ELSE '0.' || version || '.0' END,
    ADD COLUMN bump VARCHAR(8),
    ADD CONSTRAINT uq_conv_rule_version UNIQUE (rule_id, version),
    ADD CONSTRAINT chk_conv_rule_version_bump CHECK (bump IS NULL OR bump IN ('PATCH', 'MINOR', 'MAJOR'));

UPDATE miot_conversational.conv_rule_version SET bump = 'MINOR' WHERE status = 'PUBLISHED';

ALTER TABLE miot_conversational.conv_run
    ALTER COLUMN rule_version TYPE VARCHAR(32) USING '0.' || rule_version || '.0';
