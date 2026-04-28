-- Seed: Traza sub-account under Gama Mobility
-- Environment: storm (and any environment where gama-mobility.sql has been applied)
-- Run: psql $DATABASE_URL -f traza-sub-account.sql
--
-- Creates:
--   miot_core.organizations — traza (child of gama-mobility, tax_id = 77656970-4)
--   miot_core.organization_modules — FLEET_MANAGEMENT + COLLABORATORS_MANAGEMENT enabled
--
-- Safe to run multiple times (ON CONFLICT DO NOTHING / DO UPDATE).
-- Requires V0.1.3 migration (tax_id, display_name, organization_modules table).

BEGIN;

-- Insert Traza as a child org. Same tenant_client_id as GAMA (shared Auth0 M2M).
-- parent_id is looked up dynamically from gama-mobility.
INSERT INTO miot_core.organizations (slug, name, display_name, tenant_client_id, alfresco_group_id, parent_id, tax_id)
VALUES (
  'traza',
  'Traza',
  'Traza',
  'Z0XLkAmGvVQvRWL08iKCUe2x0AuRIBCn',
  'GROUP_TRAZA',
  (SELECT id FROM miot_core.organizations WHERE slug = 'gama-mobility'),
  '77656970-4'
)
ON CONFLICT (slug) DO UPDATE SET
  display_name     = EXCLUDED.display_name,
  alfresco_group_id = EXCLUDED.alfresco_group_id,
  parent_id        = EXCLUDED.parent_id,
  tax_id           = EXCLUDED.tax_id;

-- Enable modules for Traza
INSERT INTO miot_core.organization_modules (organization_id, module_code)
VALUES
  ((SELECT id FROM miot_core.organizations WHERE slug = 'traza'), 'FLEET_MANAGEMENT'),
  ((SELECT id FROM miot_core.organizations WHERE slug = 'traza'), 'COLLABORATORS_MANAGEMENT')
ON CONFLICT (organization_id, module_code) DO NOTHING;

-- Enable all modules for GAMA (parent sees everything)
INSERT INTO miot_core.organization_modules (organization_id, module_code)
VALUES
  ((SELECT id FROM miot_core.organizations WHERE slug = 'gama-mobility'), 'FLEET_MANAGEMENT'),
  ((SELECT id FROM miot_core.organizations WHERE slug = 'gama-mobility'), 'COLLABORATORS_MANAGEMENT'),
  ((SELECT id FROM miot_core.organizations WHERE slug = 'gama-mobility'), 'DASHBOARDS')
ON CONFLICT (organization_id, module_code) DO NOTHING;

COMMIT;

-- Verify
SELECT o.id, o.slug, o.name, o.tax_id, o.display_name,
       o.alfresco_group_id, p.slug AS parent_slug
FROM miot_core.organizations o
LEFT JOIN miot_core.organizations p ON p.id = o.parent_id
WHERE o.slug = 'traza';

SELECT * FROM miot_core.organization_modules
WHERE organization_id = (SELECT id FROM miot_core.organizations WHERE slug = 'traza');
