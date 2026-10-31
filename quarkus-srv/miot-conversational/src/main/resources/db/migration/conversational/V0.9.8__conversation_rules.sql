-- Conversation rules, runs and templates (#2003).
--
-- conv_event: the operational events the component received, stored before any rule acts on them.
-- conv_template: a message with a base text and one variant per channel (whatsapp, email).
-- conv_rule / conv_rule_version: a rule and its versions. A version is a DRAFT (version null, at most
--   one per rule) or PUBLISHED (version 1, 2, ...). conv_rule.current_version is the published one in force.
-- conv_run: one per rule version and event. step is the index of the next step to send; next_at is when.
-- wa_message: SIMULATED is the status of messages a TEST run recorded without sending.

CREATE TABLE miot_conversational.conv_event (
    id           UUID PRIMARY KEY,
    tenant_code  VARCHAR(128) NOT NULL,
    type         VARCHAR(128) NOT NULL,
    source       VARCHAR(128) NOT NULL,
    context_kind VARCHAR(32),
    context_key  VARCHAR(255),
    data         JSONB        NOT NULL DEFAULT '{}'::jsonb,
    test         BOOLEAN      NOT NULL DEFAULT false,
    at           TIMESTAMPTZ  NOT NULL,
    received_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_conv_event_tenant_context
    ON miot_conversational.conv_event (tenant_code, context_kind, context_key);

CREATE TABLE miot_conversational.conv_template (
    id          UUID PRIMARY KEY,
    tenant_code VARCHAR(128) NOT NULL,
    key         VARCHAR(128) NOT NULL,
    name        VARCHAR(255) NOT NULL,
    base_text   TEXT,
    whatsapp    JSONB,
    email       JSONB,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by  VARCHAR(255),
    CONSTRAINT uq_conv_template_tenant_key UNIQUE (tenant_code, key)
);

CREATE TABLE miot_conversational.conv_rule (
    id              UUID PRIMARY KEY,
    tenant_code     VARCHAR(128) NOT NULL,
    key             VARCHAR(128) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    state           VARCHAR(16)  NOT NULL DEFAULT 'OFF',
    current_version INTEGER,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_conv_rule_tenant_key UNIQUE (tenant_code, key),
    CONSTRAINT chk_conv_rule_state CHECK (state IN ('OFF', 'TEST', 'ACTIVE'))
);

CREATE TABLE miot_conversational.conv_rule_version (
    id         UUID PRIMARY KEY,
    rule_id    UUID        NOT NULL REFERENCES miot_conversational.conv_rule (id) ON DELETE CASCADE,
    version    INTEGER,
    status     VARCHAR(16) NOT NULL,
    spec       JSONB       NOT NULL DEFAULT '{}'::jsonb,
    reason     TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by VARCHAR(255),
    CONSTRAINT chk_conv_rule_version_status CHECK (status IN ('DRAFT', 'PUBLISHED')),
    CONSTRAINT chk_conv_rule_version_number CHECK ((status = 'DRAFT') = (version IS NULL)),
    CONSTRAINT uq_conv_rule_version UNIQUE (rule_id, version)
);

CREATE UNIQUE INDEX idx_conv_rule_version_one_draft
    ON miot_conversational.conv_rule_version (rule_id)
    WHERE status = 'DRAFT';

CREATE TABLE miot_conversational.conv_run (
    id           UUID PRIMARY KEY,
    tenant_code  VARCHAR(128) NOT NULL,
    rule_id      UUID         NOT NULL REFERENCES miot_conversational.conv_rule (id) ON DELETE CASCADE,
    rule_version INTEGER      NOT NULL,
    event_id     UUID         NOT NULL REFERENCES miot_conversational.conv_event (id),
    context_kind VARCHAR(32),
    context_key  VARCHAR(255),
    test         BOOLEAN      NOT NULL DEFAULT false,
    status       VARCHAR(16)  NOT NULL DEFAULT 'WAITING',
    step         INTEGER      NOT NULL DEFAULT 0,
    next_at      TIMESTAMPTZ,
    last_error   TEXT,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_conv_run_status CHECK (status IN ('WAITING', 'REPLIED', 'DONE', 'FAILED', 'CANCELLED'))
);

-- The scheduler's scan of due runs.
CREATE INDEX idx_conv_run_status_next_at
    ON miot_conversational.conv_run (status, next_at);

-- Cancelling the waiting runs of a context, and the Activity list.
CREATE INDEX idx_conv_run_tenant_context
    ON miot_conversational.conv_run (tenant_code, context_kind, context_key)
    WHERE status = 'WAITING';
CREATE INDEX idx_conv_run_tenant_created
    ON miot_conversational.conv_run (tenant_code, created_at DESC);

ALTER TABLE miot_conversational.wa_message
    ADD CONSTRAINT fk_wa_message_run
        FOREIGN KEY (run_id) REFERENCES miot_conversational.conv_run (id) ON DELETE SET NULL;

ALTER TABLE miot_conversational.wa_message DROP CONSTRAINT chk_wa_message_status;
ALTER TABLE miot_conversational.wa_message ADD CONSTRAINT chk_wa_message_status CHECK (
    status IN ('RECEIVED', 'PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'SIMULATED'));
