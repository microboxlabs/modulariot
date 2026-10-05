-- A row means the tenant got that default list once. Deleting the list keeps
-- the row, so the list comes back only through an explicit reset. A default
-- list added later still reaches tenants seeded before it.
CREATE TABLE miot_core.selectable_seeded_keys (
    tenant_code VARCHAR(255) NOT NULL,
    key         VARCHAR(64)  NOT NULL,
    seeded_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_code, key)
);

-- Tenants seeded before this table existed: every list they have counts as given.
INSERT INTO miot_core.selectable_seeded_keys (tenant_code, key)
SELECT s.tenant_code, s.key
FROM miot_core.selectables s
JOIN miot_core.selectable_tenants t ON t.tenant_code = s.tenant_code;

-- selectable_tenants is no longer read. It stays until every replica runs this
-- version, so one still running the previous version does not fail.
