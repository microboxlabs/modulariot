-- WhatsApp conversational channel: message pool (per number / per driver history).
-- Component-scoped migration applied by FlywayMigrator when
-- miot.component.conversational.enabled=true. Owns its own schema; the shared
-- Flyway history lives in miot_core.
CREATE SCHEMA IF NOT EXISTS miot_conversational;

-- One conversation per (tenant, phone). Carries the current trip context the
-- conversation is about plus 24h-window state.
CREATE TABLE miot_conversational.wa_conversation (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   BIGINT REFERENCES miot_core.tenants(id),
    tenant_code                 VARCHAR(128) NOT NULL,
    phone_e164                  VARCHAR(32)  NOT NULL,
    wa_contact_name             VARCHAR(255),
    driver_id                   VARCHAR(128),
    context_service_code        VARCHAR(128),
    context_process_instance_id VARCHAR(128),
    context_task_id             VARCHAR(128),
    status                      VARCHAR(32)  NOT NULL DEFAULT 'OPEN',
    last_inbound_at             TIMESTAMPTZ,
    last_outbound_at            TIMESTAMPTZ,
    last_message_at             TIMESTAMPTZ,
    session_expires_at          TIMESTAMPTZ,
    last_message_preview        VARCHAR(280),
    unread_count                INTEGER      NOT NULL DEFAULT 0,
    created_at                  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_wa_conversation_status CHECK (status IN ('OPEN', 'ARCHIVED'))
);

CREATE UNIQUE INDEX idx_wa_conversation_tenant_phone
    ON miot_conversational.wa_conversation(tenant_code, phone_e164);
CREATE INDEX idx_wa_conversation_tenant_last_message
    ON miot_conversational.wa_conversation(tenant_code, last_message_at DESC);
CREATE INDEX idx_wa_conversation_context_service
    ON miot_conversational.wa_conversation(context_service_code);

-- Message timeline. service_code / process_instance_id are snapshotted so a message
-- stays attributable to a trip even after the conversation's context moves on.
CREATE TABLE miot_conversational.wa_message (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id     UUID NOT NULL
                            REFERENCES miot_conversational.wa_conversation(id) ON DELETE CASCADE,
    direction           VARCHAR(16) NOT NULL,
    role                VARCHAR(16) NOT NULL,
    msg_type            VARCHAR(16) NOT NULL,
    body                TEXT,
    template_name       VARCHAR(255),
    media_ref           TEXT,
    media_mime_type     VARCHAR(128),
    media_file_name     VARCHAR(255),
    meta_message_id     VARCHAR(255),
    status              VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    error_message       TEXT,
    sent_by_user_id     VARCHAR(128),
    service_code        VARCHAR(128),
    process_instance_id VARCHAR(128),
    metadata            JSONB       NOT NULL DEFAULT '{}'::jsonb,
    sent_at             TIMESTAMPTZ,
    delivered_at        TIMESTAMPTZ,
    read_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_wa_message_direction CHECK (direction IN ('INBOUND', 'OUTBOUND')),
    CONSTRAINT chk_wa_message_role CHECK (role IN ('DRIVER', 'AGENT', 'SYSTEM', 'HARNESS')),
    CONSTRAINT chk_wa_message_type CHECK (
        msg_type IN ('TEXT', 'IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO', 'STICKER', 'TEMPLATE', 'UNKNOWN')
    ),
    CONSTRAINT chk_wa_message_status CHECK (
        status IN ('RECEIVED', 'PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED')
    )
);

CREATE INDEX idx_wa_message_conversation_created
    ON miot_conversational.wa_message(conversation_id, created_at);
-- Dedup Meta's wamid (nullable for locally-originated rows before send completes).
CREATE UNIQUE INDEX idx_wa_message_meta_message_id
    ON miot_conversational.wa_message(meta_message_id)
    WHERE meta_message_id IS NOT NULL;

-- Webhook idempotency: one row per processed external event; survives Meta retries.
CREATE TABLE miot_conversational.wa_webhook_idempotency (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source      VARCHAR(64)  NOT NULL,
    external_id VARCHAR(255) NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_wa_webhook_idempotency UNIQUE (source, external_id)
);
