-- Integration connections: reusable external API connection and credential metadata
CREATE SCHEMA IF NOT EXISTS miot_integrations;

CREATE TABLE miot_integrations.credential_profiles (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             BIGINT REFERENCES miot_core.tenants(id),
    tenant_code           VARCHAR(128) NOT NULL,
    display_name          VARCHAR(160) NOT NULL,
    auth_type             VARCHAR(64)  NOT NULL,
    public_config         JSONB        NOT NULL DEFAULT '{}'::jsonb,
    encrypted_secret_json TEXT,
    secret_preview        VARCHAR(32),
    secret_version        INTEGER      NOT NULL DEFAULT 1,
    active                BOOLEAN      NOT NULL DEFAULT true,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_credential_profiles_auth_type CHECK (
        auth_type IN (
            'NONE',
            'BEARER_TOKEN',
            'API_KEY_HEADER',
            'API_KEY_QUERY',
            'BASIC',
            'OAUTH2_CLIENT_CREDENTIALS',
            'CUSTOM_HEADERS'
        )
    )
);

CREATE INDEX idx_credential_profiles_tenant_code
    ON miot_integrations.credential_profiles(tenant_code);
CREATE INDEX idx_credential_profiles_auth_type
    ON miot_integrations.credential_profiles(auth_type);
CREATE UNIQUE INDEX idx_credential_profiles_tenant_name_active
    ON miot_integrations.credential_profiles(tenant_code, lower(display_name))
    WHERE active;

CREATE TABLE miot_integrations.integration_connections (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             BIGINT REFERENCES miot_core.tenants(id),
    tenant_code           VARCHAR(128) NOT NULL,
    name                  VARCHAR(160) NOT NULL,
    provider_type         VARCHAR(64)  NOT NULL,
    base_url              TEXT         NOT NULL,
    credential_profile_id UUID REFERENCES miot_integrations.credential_profiles(id),
    status                VARCHAR(32)  NOT NULL DEFAULT 'DRAFT',
    last_tested_at        TIMESTAMPTZ,
    last_test_result      BOOLEAN,
    metadata              JSONB        NOT NULL DEFAULT '{}'::jsonb,
    active                BOOLEAN      NOT NULL DEFAULT true,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_integration_connections_provider_type CHECK (
        provider_type IN (
            'POSTGREST',
            'ALERCE_TMS',
            'N8N',
            'AUTH0',
            'ECM',
            'CUSTOM_HTTP'
        )
    ),
    CONSTRAINT chk_integration_connections_status CHECK (
        status IN ('DRAFT', 'ACTIVE', 'INACTIVE', 'TEST_FAILED')
    )
);

CREATE INDEX idx_integration_connections_tenant_code
    ON miot_integrations.integration_connections(tenant_code);
CREATE INDEX idx_integration_connections_provider_type
    ON miot_integrations.integration_connections(provider_type);
CREATE INDEX idx_integration_connections_credential_profile
    ON miot_integrations.integration_connections(credential_profile_id);
CREATE UNIQUE INDEX idx_integration_connections_tenant_name_active
    ON miot_integrations.integration_connections(tenant_code, lower(name))
    WHERE active;

CREATE TABLE miot_integrations.integration_operations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id   UUID NOT NULL REFERENCES miot_integrations.integration_connections(id) ON DELETE CASCADE,
    name            VARCHAR(160) NOT NULL,
    method          VARCHAR(16)  NOT NULL,
    path            TEXT         NOT NULL,
    request_schema  JSONB        NOT NULL DEFAULT '{}'::jsonb,
    response_schema JSONB        NOT NULL DEFAULT '{}'::jsonb,
    test_operation  BOOLEAN      NOT NULL DEFAULT false,
    active          BOOLEAN      NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_integration_operations_method CHECK (
        method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')
    )
);

CREATE INDEX idx_integration_operations_connection
    ON miot_integrations.integration_operations(connection_id);
CREATE UNIQUE INDEX idx_integration_operations_connection_name_active
    ON miot_integrations.integration_operations(connection_id, lower(name))
    WHERE active;

CREATE TABLE miot_integrations.integration_test_results (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES miot_integrations.integration_connections(id) ON DELETE CASCADE,
    operation_id  UUID REFERENCES miot_integrations.integration_operations(id) ON DELETE SET NULL,
    success       BOOLEAN      NOT NULL,
    status_code   INTEGER,
    message       TEXT,
    tested_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_integration_test_results_connection_tested_at
    ON miot_integrations.integration_test_results(connection_id, tested_at DESC);

CREATE TABLE miot_integrations.integration_audit_events (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_code   VARCHAR(128) NOT NULL,
    connection_id UUID REFERENCES miot_integrations.integration_connections(id) ON DELETE SET NULL,
    event_type    VARCHAR(80)  NOT NULL,
    actor         VARCHAR(255),
    details       JSONB        NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_integration_audit_events_tenant_created_at
    ON miot_integrations.integration_audit_events(tenant_code, created_at DESC);
