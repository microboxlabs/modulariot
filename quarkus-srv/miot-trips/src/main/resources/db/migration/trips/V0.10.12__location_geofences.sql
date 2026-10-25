-- ============================================================
-- V0.10.12 — locations point at a GPS geofence.
--   location.geofence_id: the GPS database's geofences.geofence_id, chosen by
--                         hand; null while the location has none.
--   One current location per tenant and external code, so a feed that names a
--   place creates it once.
-- ============================================================

ALTER TABLE miot_trips.location ADD COLUMN geofence_id INT;

DROP INDEX miot_trips.idx_location_tenant_ext;
CREATE UNIQUE INDEX uq_location_tenant_ext ON miot_trips.location (tenant_code, external_code)
    WHERE external_code IS NOT NULL AND version_of IS NULL;
