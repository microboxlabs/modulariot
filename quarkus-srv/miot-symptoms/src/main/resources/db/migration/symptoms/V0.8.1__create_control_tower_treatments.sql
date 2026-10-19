-- Control Tower: treatment episodes and their actions, the contact list, and
-- the audit log of every write through the Control Tower API.
-- symptom_id is the engine's symptom id, not a symptom_definition row.

-- What one operator did about one symptom, from opening a form to finishing it.
CREATE TABLE miot_symptoms.treatment (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_code VARCHAR(128) NOT NULL,
    symptom_id  BIGINT       NOT NULL,
    asset_id    TEXT,
    trip_id     TEXT,
    type        VARCHAR(32)  NOT NULL,
    status      VARCHAR(16)  NOT NULL DEFAULT 'OPEN',
    opened_by   VARCHAR(255),
    opened_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    closed_by   VARCHAR(255),
    closed_at   TIMESTAMPTZ,
    resolution  TEXT,
    note        TEXT,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_treatment_type CHECK (type IN ('CALL', 'IGNORE_CONDITION', 'INVALIDATE_SYMPTOM')),
    CONSTRAINT chk_treatment_status CHECK (status IN ('OPEN', 'CLOSED', 'CANCELLED')),
    CONSTRAINT uq_treatment_tenant UNIQUE (id, tenant_code)
);

CREATE INDEX idx_treatment_symptom
    ON miot_symptoms.treatment (tenant_code, symptom_id, opened_at);
-- One open episode per operator and symptom.
CREATE UNIQUE INDEX idx_treatment_one_open
    ON miot_symptoms.treatment (tenant_code, symptom_id, opened_by) WHERE status = 'OPEN';

-- One step of an episode, numbered by seq from 1.
CREATE TABLE miot_symptoms.treatment_action (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    treatment_id     UUID         NOT NULL,
    tenant_code      VARCHAR(128) NOT NULL,
    seq              INTEGER      NOT NULL,
    kind             VARCHAR(16)  NOT NULL,
    contact_id       UUID,
    contact_name     TEXT,
    contact_role     TEXT,
    contact_phone    VARCHAR(32),
    method           VARCHAR(16),
    outcome_key      TEXT,
    outcome_label    TEXT,
    answered         BOOLEAN,
    duration_seconds INTEGER,
    message          TEXT,
    note             TEXT,
    tags             JSONB        NOT NULL DEFAULT '[]'::jsonb,
    details          JSONB        NOT NULL DEFAULT '{}'::jsonb,
    performed_by     VARCHAR(255),
    performed_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_treatment_action_kind CHECK (kind IN ('CALL', 'IGNORE', 'INVALIDATE', 'NOTE')),
    CONSTRAINT chk_treatment_action_method CHECK (method IS NULL OR method IN ('PHONE', 'WHATSAPP', 'MEET', 'TEAMS')),
    CONSTRAINT uq_treatment_action_seq UNIQUE (treatment_id, seq),
    -- An action belongs to an episode of the same organization.
    CONSTRAINT fk_treatment_action_treatment FOREIGN KEY (treatment_id, tenant_code)
        REFERENCES miot_symptoms.treatment (id, tenant_code) ON DELETE CASCADE
);

-- Call statistics per contact. contact_id has no foreign key: an action
-- keeps its copy of the contact after the contact is deleted.
CREATE INDEX idx_treatment_action_contact_calls
    ON miot_symptoms.treatment_action (tenant_code, contact_id)
    WHERE kind = 'CALL' AND contact_id IS NOT NULL;

-- Who the tower can call about a symptom.
CREATE TABLE miot_symptoms.contact (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_code VARCHAR(128) NOT NULL,
    name        TEXT         NOT NULL,
    role        TEXT,
    phone       VARCHAR(32),
    methods     JSONB        NOT NULL DEFAULT '[]'::jsonb,
    active      BOOLEAN      NOT NULL DEFAULT true,
    notes       TEXT,
    created_by  VARCHAR(255),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_contact_tenant
    ON miot_symptoms.contact (tenant_code, created_at);

-- Append-only record of each write through the Control Tower API.
CREATE TABLE miot_symptoms.audit_event (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_code VARCHAR(128) NOT NULL,
    actor       VARCHAR(255),
    action      VARCHAR(128) NOT NULL,
    entity_type VARCHAR(64),
    entity_id   TEXT,
    symptom_id  BIGINT,
    details     JSONB        NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_event_tenant
    ON miot_symptoms.audit_event (tenant_code, created_at DESC);
CREATE INDEX idx_audit_event_entity
    ON miot_symptoms.audit_event (tenant_code, entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_event_symptom
    ON miot_symptoms.audit_event (tenant_code, symptom_id, created_at DESC) WHERE symptom_id IS NOT NULL;
