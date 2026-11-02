-- ============================================================
-- V0.10.25 — where a location is, and how it was found.
--   address, district_name, district_code, country: the site as declared;
--     district_code is the Peruvian ubigeo or the Chilean commune code (CUT).
--   latitude, longitude, plus_code: the point; plus_code is the full code of the point.
--   resolution_source: geofence, plus_code, coordinates or manual.
--   resolution_status: resolved (a geofence is linked), needs_review, rejected.
--   resolution_note: why it needs review.
-- ============================================================

ALTER TABLE miot_trips.location
    ADD COLUMN address           TEXT,
    ADD COLUMN district_name     VARCHAR(255),
    ADD COLUMN district_code     VARCHAR(16),
    ADD COLUMN country           CHAR(2) CHECK (country ~ '^[A-Z]{2}$'),
    ADD COLUMN plus_code         VARCHAR(32),
    ADD COLUMN latitude          DOUBLE PRECISION CHECK (latitude BETWEEN -90 AND 90),
    ADD COLUMN longitude         DOUBLE PRECISION CHECK (longitude BETWEEN -180 AND 180),
    ADD COLUMN resolution_source VARCHAR(16)
        CHECK (resolution_source IN ('geofence','plus_code','coordinates','manual')),
    ADD COLUMN resolution_status VARCHAR(16)
        CHECK (resolution_status IN ('resolved','needs_review','rejected')),
    ADD COLUMN resolution_note   VARCHAR(255);

CREATE INDEX idx_location_tenant_resolution ON miot_trips.location (tenant_code, resolution_status)
    WHERE version_of IS NULL;
