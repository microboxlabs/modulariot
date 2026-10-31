-- ============================================================
-- V0.10.26 — geocoding by address.
--   resolution_source adds internal (the GPS openaddresses table, Chile) and
--     provider (a geocoding provider, called or from the cache).
--   geocode_cache: provider results whose terms allow keeping them, shared by
--     every tenant. The key is the normalized address with its district; no
--     tenant, site name or client is stored.
-- ============================================================

ALTER TABLE miot_trips.location DROP CONSTRAINT location_resolution_source_check;
ALTER TABLE miot_trips.location ADD CONSTRAINT location_resolution_source_check
    CHECK (resolution_source IN ('geofence','plus_code','coordinates','manual','internal','provider'));

CREATE TABLE miot_trips.geocode_cache (
    address_key  TEXT             NOT NULL,
    country      CHAR(2)          NOT NULL CHECK (country ~ '^[A-Z]{2}$'),
    latitude     DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude    DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    source       VARCHAR(16)      NOT NULL,
    provider     VARCHAR(32)      NOT NULL,
    resolved_at  TIMESTAMPTZ      NOT NULL DEFAULT now(),
    PRIMARY KEY (address_key, country)
);
