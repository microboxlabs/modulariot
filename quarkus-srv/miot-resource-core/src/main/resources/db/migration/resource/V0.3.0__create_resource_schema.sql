-- Resource core schema: shared entity events, scores, sync cursors, links, profiles
CREATE SCHEMA IF NOT EXISTS miot_resource;

-- Entity event log (append-only audit trail + KPI data source)
CREATE TABLE miot_resource.rd_entity_events (
    id              BIGSERIAL PRIMARY KEY,
    client_id       VARCHAR(128)  NOT NULL,
    entity_type     VARCHAR(20)   NOT NULL,
    entity_id       UUID          NOT NULL,
    event_type      VARCHAR(50)   NOT NULL,
    event_source    VARCHAR(50)   NOT NULL,
    actor           VARCHAR(255),
    payload         JSONB,
    metadata        JSONB,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_entity_events_entity ON miot_resource.rd_entity_events(entity_type, entity_id);
CREATE INDEX idx_entity_events_client ON miot_resource.rd_entity_events(client_id, entity_type);
CREATE INDEX idx_entity_events_type ON miot_resource.rd_entity_events(event_type);
CREATE INDEX idx_entity_events_created ON miot_resource.rd_entity_events(created_at);

-- Computed KPI scores (current + historical snapshots)
CREATE TABLE miot_resource.rd_entity_scores (
    id              BIGSERIAL PRIMARY KEY,
    client_id       VARCHAR(128)  NOT NULL,
    entity_type     VARCHAR(20)   NOT NULL,
    entity_id       UUID          NOT NULL,
    dimension       VARCHAR(50)   NOT NULL,
    score           INTEGER       NOT NULL CHECK (score >= 0 AND score <= 100),
    snapshot_at     TIMESTAMPTZ   NOT NULL,
    is_current      BOOLEAN       NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_entity_scores_entity ON miot_resource.rd_entity_scores(entity_type, entity_id);
CREATE INDEX idx_entity_scores_current ON miot_resource.rd_entity_scores(entity_type, entity_id, is_current)
    WHERE is_current = true;
CREATE INDEX idx_entity_scores_client ON miot_resource.rd_entity_scores(client_id, entity_type);

-- Sync cursors for source system integrations
CREATE TABLE miot_resource.rd_sync_cursors (
    id              SERIAL PRIMARY KEY,
    client_id       VARCHAR(128)  NOT NULL,
    source_system   VARCHAR(50)   NOT NULL,
    entity_type     VARCHAR(20)   NOT NULL,
    cursor_type     VARCHAR(20)   NOT NULL,
    cursor_value    VARCHAR(100)  NOT NULL,
    last_sync_at    TIMESTAMPTZ   NOT NULL,
    entities_synced INTEGER,
    errors_last_sync INTEGER      DEFAULT 0,

    CONSTRAINT uk_sync_cursor UNIQUE (client_id, source_system, entity_type)
);

-- Polymorphic resource links (entity relationships with temporal validity)
CREATE TABLE miot_resource.rd_resource_links (
    id              BIGSERIAL PRIMARY KEY,
    client_id       VARCHAR(128)  NOT NULL,
    parent_type     VARCHAR(20)   NOT NULL,
    parent_id       UUID          NOT NULL,
    child_type      VARCHAR(20)   NOT NULL,
    child_id        UUID          NOT NULL,
    link_type       VARCHAR(50)   NOT NULL,
    valid_from      TIMESTAMPTZ,
    valid_to        TIMESTAMPTZ,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_resource_links_parent ON miot_resource.rd_resource_links(parent_type, parent_id);
CREATE INDEX idx_resource_links_child ON miot_resource.rd_resource_links(child_type, child_id);
CREATE INDEX idx_resource_links_client ON miot_resource.rd_resource_links(client_id);

-- Resource availability schedules
CREATE TABLE miot_resource.rd_resource_schedules (
    id              BIGSERIAL PRIMARY KEY,
    client_id       VARCHAR(128)  NOT NULL,
    resource_type   VARCHAR(20)   NOT NULL,
    resource_id     UUID          NOT NULL,
    available_from  TIMESTAMPTZ   NOT NULL,
    available_to    TIMESTAMPTZ,
    capacity        INTEGER,
    current_usage   INTEGER       DEFAULT 0,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_resource_schedules_resource ON miot_resource.rd_resource_schedules(resource_type, resource_id);

-- Demand templates (profiles)
CREATE TABLE miot_resource.rd_resource_profiles (
    id              BIGSERIAL PRIMARY KEY,
    client_id       VARCHAR(128)  NOT NULL,
    code            VARCHAR(50)   NOT NULL,
    name            VARCHAR(255)  NOT NULL,
    active          BOOLEAN       NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT uk_profile_client_code UNIQUE (client_id, code)
);

-- Resource slots per profile
CREATE TABLE miot_resource.rd_profile_items (
    id              BIGSERIAL PRIMARY KEY,
    profile_id      BIGINT        NOT NULL REFERENCES miot_resource.rd_resource_profiles(id),
    resource_type   VARCHAR(20)   NOT NULL,
    filter_criteria JSONB,
    scoring_weights JSONB,
    min_count       INTEGER,
    max_count       INTEGER
);

CREATE INDEX idx_profile_items_profile ON miot_resource.rd_profile_items(profile_id);
