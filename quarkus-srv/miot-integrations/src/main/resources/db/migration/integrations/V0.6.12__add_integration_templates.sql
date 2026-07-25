-- Integration templates: an operator-defined "type" (like an n8n node type) that owns the
-- payload contract — method, path and request/response schema — for a family of connections.
--
-- A connection is an *instance* of a template: it supplies its own base URL and credential,
-- and on creation copies the template's contract into its own operation. That copy keeps the
-- dispatch path (connection + operation) untouched while guaranteeing every instance of a
-- template is forced through the same review-process field mapping. The instance's operation
-- is template-owned (read-only in the UI) so it cannot drift from the contract.
CREATE TABLE miot_integrations.integration_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       BIGINT REFERENCES miot_core.tenants(id),
    tenant_code     VARCHAR(128) NOT NULL,
    name            VARCHAR(160) NOT NULL,
    provider_type   VARCHAR(64)  NOT NULL,
    operation_name  VARCHAR(160) NOT NULL,
    method          VARCHAR(16)  NOT NULL,
    path            TEXT         NOT NULL,
    request_schema  JSONB        NOT NULL DEFAULT '{}'::jsonb,
    response_schema JSONB        NOT NULL DEFAULT '{}'::jsonb,
    active          BOOLEAN      NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    -- Mirrors the connections' provider_type set (extended through V0.6.6); a template's
    -- kind is the kind its instances take.
    CONSTRAINT chk_integration_templates_provider_type CHECK (
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
    ),
    CONSTRAINT chk_integration_templates_method CHECK (
        method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')
    )
);

CREATE INDEX idx_integration_templates_tenant_code
    ON miot_integrations.integration_templates(tenant_code);
CREATE UNIQUE INDEX idx_integration_templates_tenant_name_active
    ON miot_integrations.integration_templates(tenant_code, lower(name))
    WHERE active;

-- A connection may be an instance of a template. Nullable: ad-hoc connections (and every
-- connection created before templates existed) have none, and behave exactly as before.
ALTER TABLE miot_integrations.integration_connections
    ADD COLUMN template_id UUID REFERENCES miot_integrations.integration_templates(id);

-- Backs "which connections are instances of this template?" — the delete guard and the
-- instances list.
CREATE INDEX idx_integration_connections_template
    ON miot_integrations.integration_connections(template_id) WHERE active;
