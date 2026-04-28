-- Add tax_id and display_name to organizations.
-- tax_id is the organization's national tax identifier (e.g. Chilean RUT "77856310-K").
-- Only child (sub-account) orgs carry a tax_id; parent orgs are site containers and stay NULL.
-- display_name is a free-form human label independent of the URL slug.
ALTER TABLE miot_core.organizations
    ADD COLUMN tax_id       VARCHAR(32),
    ADD COLUMN display_name VARCHAR(200);

-- Only one org may claim a given tax_id. Parent orgs with NULL tax_id are excluded.
CREATE UNIQUE INDEX ux_organizations_tax_id
    ON miot_core.organizations(tax_id)
    WHERE tax_id IS NOT NULL;

-- Per-organization product module entitlements.
-- Drives which application features an org can access at runtime
-- (FLEET_MANAGEMENT, DASHBOARDS, COLLABORATORS_MANAGEMENT, ...).
-- Replaces the hardcoded `requiredGroups: ["GROUP_FLEET_MANAGEMENT", ...]` in the Next.js app.
CREATE TABLE miot_core.organization_modules (
    organization_id BIGINT       NOT NULL REFERENCES miot_core.organizations(id) ON DELETE CASCADE,
    module_code     VARCHAR(64)  NOT NULL,
    enabled         BOOLEAN      NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (organization_id, module_code)
);

CREATE INDEX idx_organization_modules_enabled
    ON miot_core.organization_modules(organization_id)
    WHERE enabled = true;
