-- A Google service account as a credential: the modulith signs its JWT and exchanges
-- it for an access token, so a BigQuery datasource on the dashboard server never
-- holds the private key.

ALTER TABLE miot_integrations.credential_profiles
    DROP CONSTRAINT chk_credential_profiles_auth_type,
    ADD CONSTRAINT chk_credential_profiles_auth_type CHECK (
        auth_type IN (
            'NONE',
            'BEARER_TOKEN',
            'API_KEY_HEADER',
            'API_KEY_QUERY',
            'BASIC',
            'OAUTH2_CLIENT_CREDENTIALS',
            'GOOGLE_SERVICE_ACCOUNT',
            'CUSTOM_HEADERS'
        )
    );

ALTER TABLE miot_integrations.credential_profiles
    DROP CONSTRAINT chk_credential_profiles_credential_type,
    ADD CONSTRAINT chk_credential_profiles_credential_type CHECK (
        credential_type IN (
            'AZURE_ENTRA_CLIENT_CREDENTIALS',
            'OAUTH2_CLIENT_CREDENTIALS',
            'API_KEY',
            'BEARER_TOKEN',
            'BASIC_AUTH',
            'GOOGLE_SERVICE_ACCOUNT'
        )
    );
