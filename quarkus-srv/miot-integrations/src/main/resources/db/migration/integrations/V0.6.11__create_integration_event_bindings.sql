-- Event-shaped channel bindings.
--
--   when EVENT happens in SCOPE, if CONDITION, send to CONNECTION/OPERATION
--   shaped by TEMPLATES
--
-- Deliberately not review- or kanban-shaped: a review verdict and a symptoms
-- notification are the same sentence with different nouns, so they share this
-- table rather than each growing a near-identical one.
CREATE TABLE miot_integrations.integration_event_bindings (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- The Auth0 M2M client (what the rest of this schema calls tenant_code).
    -- Named for what it holds; see docs/review-channel-dispatch.md#terminology.
    tenant_client_id VARCHAR(128) NOT NULL,
    -- Which org authored it. Several orgs can share one M2M client, so the
    -- tenant alone cannot say who a binding belongs to.
    owner_org_slug   VARCHAR(100) NOT NULL,

    event_type       VARCHAR(128) NOT NULL,
    -- Opaque to this module: the producer defines what a scope means. NULL
    -- scope_kind means the binding applies to every scope of that event type.
    scope_kind       VARCHAR(64),
    scope_key        VARCHAR(255),

    connection_id    UUID NOT NULL
                     REFERENCES miot_integrations.integration_connections(id) ON DELETE RESTRICT,
    -- Nullable: only operation-based dispatchers (generic HTTP) use one. A
    -- WhatsApp binding has no operation row to point at.
    operation_id     UUID
                     REFERENCES miot_integrations.integration_operations(id) ON DELETE RESTRICT,

    -- Declarative filter over the event context ("only rejections").
    -- 'condition' is awkwardly close to reserved in SQL, hence the prefix.
    match_condition  JSONB        NOT NULL DEFAULT '{}'::jsonb,
    -- fieldId -> handlebars-subset template.
    field_templates  JSONB        NOT NULL DEFAULT '{}'::jsonb,

    enabled          BOOLEAN      NOT NULL DEFAULT false,
    active           BOOLEAN      NOT NULL DEFAULT true,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by       TEXT,
    updated_by       TEXT
);

-- One binding per (owner, event, scope, channel). connection_id is part of the
-- key on purpose: one event may legitimately fan out to several channels.
-- COALESCE rather than the bare columns because NULL <> NULL would let
-- duplicate "every scope" bindings through on PostgreSQL < 15.
CREATE UNIQUE INDEX idx_integration_event_bindings_target
    ON miot_integrations.integration_event_bindings (
        tenant_client_id,
        owner_org_slug,
        event_type,
        COALESCE(scope_kind, ''),
        COALESCE(scope_key, ''),
        connection_id
    ) WHERE active;

-- The dispatch-time lookup: everything armed for this tenant + event.
CREATE INDEX idx_integration_event_bindings_dispatch
    ON miot_integrations.integration_event_bindings (tenant_client_id, event_type)
    WHERE active AND enabled;

-- Backs "which bindings still use this connection?" before a delete.
CREATE INDEX idx_integration_event_bindings_connection
    ON miot_integrations.integration_event_bindings (connection_id) WHERE active;
