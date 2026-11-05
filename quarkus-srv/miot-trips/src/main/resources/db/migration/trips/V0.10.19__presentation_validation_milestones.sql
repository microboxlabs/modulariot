-- ============================================================
-- V0.10.19 — presentation and validation milestones.
--   presentation: the truck reached the origin (GPS, a gate system or
--   a person). validation: external checks reported on the load,
--   vehicle and documents; the evidence column keeps what they send.
-- ============================================================

ALTER TABLE miot_trips.trip_milestone DROP CONSTRAINT IF EXISTS trip_milestone_milestone_check;
ALTER TABLE miot_trips.trip_milestone ADD CONSTRAINT trip_milestone_milestone_check
    CHECK (milestone IN ('presentation', 'validation', 'departure', 'arrival', 'closure'));

ALTER TABLE miot_trips.milestone_confirmer DROP CONSTRAINT IF EXISTS milestone_confirmer_milestone_check;
ALTER TABLE miot_trips.milestone_confirmer ADD CONSTRAINT milestone_confirmer_milestone_check
    CHECK (milestone IN ('presentation', 'validation', 'departure', 'arrival', 'closure'));
