-- Credentials as a first-class capability: a credential profile is configured once
-- in Settings > Credentials and referenced from anywhere that talks to an external
-- system. V0.6.0 stored only what an integration connection needed; the screen needs
-- four things more:
--
--   credential_type  what the operator picked. Azure Entra and generic OAuth2 both
--                    resolve as OAUTH2_CLIENT_CREDENTIALS, so auth_type alone cannot
--                    round-trip the choice or drive a type-specific form.
--   environment      providers issue one client_id/secret pair per environment, so it
--                    belongs to the credential's identity rather than to deployment
--                    config. Free text: teams run staging, sandbox and per-customer
--                    stacks beyond the three the UI seeds.
--   last_tested_*    a client-credentials grant can be exercised on its own, with no
--                    connection involved, so the result lives on the credential.
--   created_by /
--   updated_by       who last rotated a secret.
ALTER TABLE miot_integrations.credential_profiles
    ADD COLUMN credential_type  VARCHAR(64),
    -- The default exists only to backfill rows that predate the column; it is dropped
    -- below so new rows must state the environment they belong to. Existing profiles
    -- are live WhatsApp tokens, hence PRODUCTION, and the value stays editable.
    ADD COLUMN environment      VARCHAR(40) NOT NULL DEFAULT 'PRODUCTION',
    ADD COLUMN last_tested_at   TIMESTAMPTZ,
    ADD COLUMN last_test_result BOOLEAN,
    ADD COLUMN created_by       VARCHAR(255),
    ADD COLUMN updated_by       VARCHAR(255);

-- OAUTH2 rows become the generic type, never Entra: the directory-specific config
-- (tenant_id) was never captured, so claiming Entra would be a guess. NONE and
-- CUSTOM_HEADERS have no equivalent in the type catalog and fall to BEARER_TOKEN,
-- the closest shape; auth_type is kept untouched, so nothing they resolve with changes.
UPDATE miot_integrations.credential_profiles
SET credential_type = CASE auth_type
        WHEN 'OAUTH2_CLIENT_CREDENTIALS' THEN 'OAUTH2_CLIENT_CREDENTIALS'
        WHEN 'BASIC'                     THEN 'BASIC_AUTH'
        WHEN 'API_KEY_HEADER'            THEN 'API_KEY'
        WHEN 'API_KEY_QUERY'             THEN 'API_KEY'
        ELSE 'BEARER_TOKEN'
    END;

ALTER TABLE miot_integrations.credential_profiles
    ALTER COLUMN credential_type SET NOT NULL,
    ALTER COLUMN environment DROP DEFAULT,
    ADD CONSTRAINT chk_credential_profiles_credential_type CHECK (
        credential_type IN (
            'AZURE_ENTRA_CLIENT_CREDENTIALS',
            'OAUTH2_CLIENT_CREDENTIALS',
            'API_KEY',
            'BEARER_TOKEN',
            'BASIC_AUTH'
        )
    );

CREATE INDEX idx_credential_profiles_credential_type
    ON miot_integrations.credential_profiles(credential_type);

-- Name uniqueness becomes per environment: the same credential legitimately exists
-- once per environment ("Partner API" in QA and in PRODUCTION). Matched
-- case-insensitively on both halves so "qa" cannot become a twin of "QA".
DROP INDEX miot_integrations.idx_credential_profiles_tenant_name_active;
CREATE UNIQUE INDEX idx_credential_profiles_tenant_name_env_active
    ON miot_integrations.credential_profiles(tenant_code, lower(display_name), lower(environment))
    WHERE active;
