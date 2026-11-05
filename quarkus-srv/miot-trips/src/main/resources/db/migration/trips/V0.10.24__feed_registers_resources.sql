-- ============================================================
-- V0.10.24 — a feed may register the resources fleet lacks.
--   feed_profile.registers_resources: when true, a service that names
--   an unknown truck, trailer, driver or carrier, and sends the data to
--   create it, registers it in fleet before the trip uses it.
-- ============================================================

ALTER TABLE miot_trips.feed_profile ADD COLUMN registers_resources BOOLEAN NOT NULL DEFAULT true;
