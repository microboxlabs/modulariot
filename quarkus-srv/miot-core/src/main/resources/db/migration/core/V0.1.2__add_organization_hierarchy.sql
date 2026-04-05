-- Add parent/child hierarchy to organizations (max 2 levels: parent → children)
ALTER TABLE miot_core.organizations
    ADD COLUMN parent_id BIGINT REFERENCES miot_core.organizations(id);

CREATE INDEX idx_organizations_parent ON miot_core.organizations(parent_id) WHERE active = true;
