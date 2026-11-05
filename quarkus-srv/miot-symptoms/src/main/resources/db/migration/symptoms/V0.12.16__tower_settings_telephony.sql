-- Which telephony connection the Control Tower's calls use: TEAMS_PHONE or TELNYX.
-- NULL lets the server pick: Telnyx when connected, else Teams Phone.
ALTER TABLE miot_symptoms.tower_settings
    ADD COLUMN IF NOT EXISTS telephony_provider VARCHAR(16);

ALTER TABLE miot_symptoms.tower_settings
    DROP CONSTRAINT IF EXISTS chk_tower_settings_telephony_provider;

ALTER TABLE miot_symptoms.tower_settings
    ADD CONSTRAINT chk_tower_settings_telephony_provider
        CHECK (telephony_provider IS NULL OR telephony_provider IN ('TELNYX', 'TEAMS_PHONE'));
