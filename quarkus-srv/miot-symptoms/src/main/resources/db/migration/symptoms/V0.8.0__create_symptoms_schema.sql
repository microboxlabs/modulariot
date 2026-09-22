-- Control Tower system of record for the miot-symptoms module.
-- Symptoms themselves stay in the StreamHub GPS database (public.symptoms);
-- this schema owns what the tower does about them: treatment episodes and
-- the actions inside them, the tenant's contact list, the selectable
-- catalogs behind the treatment forms, and the audit trail.

CREATE SCHEMA IF NOT EXISTS miot_symptoms;

CREATE TABLE miot_symptoms.treatments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_code         VARCHAR(128) NOT NULL,
    symptom_id          BIGINT       NOT NULL,
    asset_id            VARCHAR(64),
    trip_id             VARCHAR(64),
    type                VARCHAR(32)  NOT NULL,
    status              VARCHAR(16)  NOT NULL,
    opened_by           VARCHAR(255),
    opened_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    closed_by           VARCHAR(255),
    closed_at           TIMESTAMPTZ,
    resolution          VARCHAR(64),
    note                TEXT,
    legacy_treatment_id BIGINT,
    idempotency_key     VARCHAR(128),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_treatments_type   CHECK (type IN ('CALL', 'IGNORE_CONDITION', 'INVALIDATE_SYMPTOM')),
    CONSTRAINT chk_treatments_status CHECK (status IN ('OPEN', 'CLOSED', 'CANCELLED'))
);

CREATE INDEX idx_treatments_tenant_symptom
    ON miot_symptoms.treatments(tenant_code, symptom_id, opened_at DESC);

CREATE UNIQUE INDEX uq_treatments_tenant_idempotency
    ON miot_symptoms.treatments(tenant_code, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE TABLE miot_symptoms.treatment_actions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    treatment_id     UUID         NOT NULL REFERENCES miot_symptoms.treatments(id) ON DELETE CASCADE,
    tenant_code      VARCHAR(128) NOT NULL,
    seq              INTEGER      NOT NULL,
    kind             VARCHAR(32)  NOT NULL,
    contact_id       UUID,
    contact_name     VARCHAR(255),
    contact_role     VARCHAR(255),
    contact_phone    VARCHAR(32),
    method           VARCHAR(32),
    outcome_key      VARCHAR(128),
    outcome_label    VARCHAR(255),
    answered         BOOLEAN,
    duration_seconds INTEGER,
    note             TEXT,
    tags             JSONB        NOT NULL DEFAULT '[]'::jsonb,
    details          JSONB        NOT NULL DEFAULT '{}'::jsonb,
    performed_by     VARCHAR(255),
    performed_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_treatment_actions_seq UNIQUE (treatment_id, seq),
    CONSTRAINT chk_treatment_actions_kind CHECK (kind IN ('CALL', 'IGNORE', 'INVALIDATE', 'NOTE'))
);

CREATE INDEX idx_treatment_actions_contact
    ON miot_symptoms.treatment_actions(tenant_code, contact_id, performed_at DESC)
    WHERE contact_id IS NOT NULL;

CREATE TABLE miot_symptoms.contacts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_code VARCHAR(128) NOT NULL,
    name        VARCHAR(255) NOT NULL,
    role        VARCHAR(255),
    phone       VARCHAR(32),
    methods     JSONB        NOT NULL DEFAULT '[]'::jsonb,
    active      BOOLEAN      NOT NULL DEFAULT true,
    notes       TEXT,
    created_by  VARCHAR(255),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_contacts_tenant_active_name
    ON miot_symptoms.contacts(tenant_code, active, name);

CREATE TABLE miot_symptoms.selectables (
    tenant_code VARCHAR(128) NOT NULL,
    key         VARCHAR(64)  NOT NULL,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    mode        VARCHAR(16)  NOT NULL,
    options     JSONB        NOT NULL DEFAULT '[]'::jsonb,
    updated_by  VARCHAR(255),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_code, key),
    CONSTRAINT chk_selectables_mode CHECK (mode IN ('SINGLE', 'MULTIPLE'))
);

CREATE TABLE miot_symptoms.selectable_bindings (
    tenant_code    VARCHAR(128) NOT NULL,
    field_key      VARCHAR(64)  NOT NULL,
    selectable_key VARCHAR(64)  NOT NULL,
    updated_by     VARCHAR(255),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_code, field_key)
);

CREATE TABLE miot_symptoms.audit_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_code VARCHAR(128) NOT NULL,
    actor       VARCHAR(255),
    action      VARCHAR(80)  NOT NULL,
    entity_type VARCHAR(40)  NOT NULL,
    entity_id   VARCHAR(64),
    symptom_id  BIGINT,
    details     JSONB        NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_events_tenant_created_at
    ON miot_symptoms.audit_events(tenant_code, created_at DESC);

CREATE INDEX idx_audit_events_tenant_entity
    ON miot_symptoms.audit_events(tenant_code, entity_type, entity_id);
