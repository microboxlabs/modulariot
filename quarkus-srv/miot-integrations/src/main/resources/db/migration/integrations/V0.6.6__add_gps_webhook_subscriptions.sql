-- GPS webhook subscriptions: tenant-owned outbound webhooks with filter criteria
-- and a durable delivery outbox for at-least-once HTTP fan-out.

-- Extend provider_type allow-list (never mutate already-applied V0.6.0 / V0.6.2).
ALTER TABLE miot_integrations.integration_connections
    DROP CONSTRAINT chk_integration_connections_provider_type;

ALTER TABLE miot_integrations.integration_connections
    ADD CONSTRAINT chk_integration_connections_provider_type CHECK (
        provider_type IN (
            'POSTGREST',
            'ALERCE_TMS',
            'N8N',
            'AUTH0',
            'ECM',
            'CUSTOM_HTTP',
            'WHATSAPP',
            'GPS_WEBHOOK'
        )
    );

CREATE TABLE miot_integrations.webhook_subscriptions (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_code           VARCHAR(128) NOT NULL,
    connection_id         UUID NOT NULL
        REFERENCES miot_integrations.integration_connections(id),
    name                  VARCHAR(160) NOT NULL,
    enabled               BOOLEAN NOT NULL DEFAULT true,
    filter_mode           VARCHAR(32)  NOT NULL,
    filter_json           JSONB        NOT NULL DEFAULT '{}'::jsonb,
    include_all_visible   BOOLEAN NOT NULL DEFAULT false,
    compiled_at           TIMESTAMPTZ,
    active                BOOLEAN NOT NULL DEFAULT true,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_webhook_subscriptions_filter_mode CHECK (
        filter_mode IN ('ALL_VISIBLE', 'RULES')
    )
);

CREATE INDEX idx_webhook_subscriptions_tenant_code
    ON miot_integrations.webhook_subscriptions(tenant_code)
    WHERE active;

CREATE INDEX idx_webhook_subscriptions_connection
    ON miot_integrations.webhook_subscriptions(connection_id);

CREATE UNIQUE INDEX idx_webhook_subscriptions_tenant_name_active
    ON miot_integrations.webhook_subscriptions(tenant_code, lower(name))
    WHERE active;

CREATE INDEX idx_webhook_subscriptions_enabled
    ON miot_integrations.webhook_subscriptions(tenant_code)
    WHERE active AND enabled;

CREATE TABLE miot_integrations.webhook_subscription_assets (
    subscription_id UUID NOT NULL
        REFERENCES miot_integrations.webhook_subscriptions(id) ON DELETE CASCADE,
    asset_id        TEXT NOT NULL,
    PRIMARY KEY (subscription_id, asset_id)
);

CREATE INDEX idx_webhook_subscription_assets_asset
    ON miot_integrations.webhook_subscription_assets(asset_id);

CREATE TABLE miot_integrations.webhook_deliveries (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id   UUID NOT NULL
        REFERENCES miot_integrations.webhook_subscriptions(id) ON DELETE CASCADE,
    tenant_code       VARCHAR(128) NOT NULL,
    dedupe_key        VARCHAR(640),
    payload           JSONB        NOT NULL DEFAULT '{}'::jsonb,
    state             VARCHAR(32)  NOT NULL DEFAULT 'PENDING',
    attempts          INTEGER      NOT NULL DEFAULT 0,
    max_attempts      INTEGER      NOT NULL DEFAULT 5,
    next_retry_at     TIMESTAMPTZ,
    last_status_code  INTEGER,
    last_error        TEXT,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_webhook_deliveries_state CHECK (
        state IN ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'DEAD')
    )
);

CREATE UNIQUE INDEX idx_webhook_deliveries_dedupe
    ON miot_integrations.webhook_deliveries(tenant_code, dedupe_key)
    WHERE dedupe_key IS NOT NULL;

CREATE INDEX idx_webhook_deliveries_claim
    ON miot_integrations.webhook_deliveries(state, next_retry_at)
    WHERE state IN ('PENDING', 'RUNNING');

CREATE INDEX idx_webhook_deliveries_subscription_created
    ON miot_integrations.webhook_deliveries(subscription_id, created_at DESC);

CREATE INDEX idx_webhook_deliveries_tenant_created
    ON miot_integrations.webhook_deliveries(tenant_code, created_at DESC);
