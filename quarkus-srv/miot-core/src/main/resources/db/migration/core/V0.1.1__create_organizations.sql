-- Organizations: multi-tenant units for web users
-- Maps a URL slug to an Alfresco group (membership/permissions) and an Auth0 M2M client (data scope)
CREATE TABLE miot_core.organizations (
    id                BIGSERIAL    PRIMARY KEY,
    slug              VARCHAR(100) NOT NULL UNIQUE,
    name              VARCHAR(255) NOT NULL,
    alfresco_group_id VARCHAR(255),          -- Alfresco GROUP_xxx or site shortname; null = skip membership check
    tenant_client_id  VARCHAR(255) NOT NULL, -- Auth0 M2M client ID = Tenant.code
    active            BOOLEAN      NOT NULL DEFAULT true,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_organizations_slug ON miot_core.organizations(slug) WHERE active = true;
