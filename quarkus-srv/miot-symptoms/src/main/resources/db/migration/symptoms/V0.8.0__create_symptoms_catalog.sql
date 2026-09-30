-- Symptom catalog: what each organization's symptoms are, their published
-- versions, the data sources their rules read, and cached descriptions.
-- Applied by FlywayMigrator when miot.component.symptoms.enabled=true.
CREATE SCHEMA IF NOT EXISTS miot_symptoms;

-- A data source a rule reads (enriched GPS signal, device event, ...).
-- tenant_code NULL is a platform source every organization sees.
CREATE TABLE miot_symptoms.data_source (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_code VARCHAR(128),
    source_key  VARCHAR(96)  NOT NULL,
    name        VARCHAR(200) NOT NULL,
    kind        VARCHAR(16)  NOT NULL,
    root        VARCHAR(32)  NOT NULL,
    cadence     VARCHAR(200),
    fields      JSONB        NOT NULL DEFAULT '[]'::jsonb,
    samples     JSONB        NOT NULL DEFAULT '[]'::jsonb,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_data_source_kind CHECK (kind IN ('SIGNAL', 'EVENT', 'CHECK', 'TRIP_EVENT', 'WEBHOOK'))
);

CREATE UNIQUE INDEX idx_data_source_key
    ON miot_symptoms.data_source (COALESCE(tenant_code, ''), source_key);

-- One symptom of one organization. Its rules live in symptom_version.
CREATE TABLE miot_symptoms.symptom_definition (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_code            VARCHAR(128) NOT NULL,
    symptom_key            VARCHAR(96)  NOT NULL,
    name                   VARCHAR(200) NOT NULL,
    family                 VARCHAR(96),
    icon                   VARCHAR(64),
    description            TEXT,
    source_key             VARCHAR(96)  NOT NULL,
    engine_rule_id         INTEGER,
    template_key           VARCHAR(96),
    forked_from_version_id UUID,
    state                  VARCHAR(16)  NOT NULL DEFAULT 'OFF',
    current_version        VARCHAR(32),
    created_by             VARCHAR(255) NOT NULL,
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by             VARCHAR(255) NOT NULL,
    updated_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_symptom_definition_state CHECK (state IN ('OFF', 'TEST', 'ACTIVE'))
);

CREATE UNIQUE INDEX idx_symptom_definition_key
    ON miot_symptoms.symptom_definition (tenant_code, symptom_key);

-- The rules of a symptom. One DRAFT per symptom at most; PUBLISHED rows are
-- never edited, a rollback publishes an old spec as a new version.
CREATE TABLE miot_symptoms.symptom_version (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    definition_id      UUID         NOT NULL
                           REFERENCES miot_symptoms.symptom_definition (id) ON DELETE CASCADE,
    tenant_code        VARCHAR(128) NOT NULL,
    version            VARCHAR(32),
    status             VARCHAR(16)  NOT NULL,
    spec               JSONB        NOT NULL,
    bump               VARCHAR(8),
    reason             TEXT,
    rolled_back_from   VARCHAR(32),
    created_by         VARCHAR(255) NOT NULL,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    published_by       VARCHAR(255),
    published_at       TIMESTAMPTZ,
    CONSTRAINT chk_symptom_version_status CHECK (status IN ('DRAFT', 'PUBLISHED')),
    CONSTRAINT chk_symptom_version_bump CHECK (bump IS NULL OR bump IN ('MAJOR', 'MINOR', 'PATCH')),
    CONSTRAINT chk_symptom_version_published CHECK (status = 'DRAFT' OR version IS NOT NULL)
);

CREATE UNIQUE INDEX idx_symptom_version_number
    ON miot_symptoms.symptom_version (definition_id, version) WHERE version IS NOT NULL;
CREATE UNIQUE INDEX idx_symptom_version_one_draft
    ON miot_symptoms.symptom_version (definition_id) WHERE status = 'DRAFT';
CREATE INDEX idx_symptom_version_tenant
    ON miot_symptoms.symptom_version (tenant_code, definition_id, created_at DESC);

-- Plain-language descriptions of a rule, keyed by the hash of the rule text,
-- so the same rule is described once.
CREATE TABLE miot_symptoms.rule_description (
    rule_hash  VARCHAR(64)  NOT NULL,
    locale     VARCHAR(16)  NOT NULL,
    audience   VARCHAR(32)  NOT NULL,
    html       TEXT         NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (rule_hash, locale, audience)
);
