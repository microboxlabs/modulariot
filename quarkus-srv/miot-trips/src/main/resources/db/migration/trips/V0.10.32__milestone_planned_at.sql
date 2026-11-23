-- ============================================================
-- V0.10.32 — planned time per milestone and feed corrections.
--   trip_milestone.planned_at: when the milestone is planned
--     (an appointment); a feed sets it. A milestone with only a
--     planned time has a row with status 'open'.
--   feed_profile.feed_corrections: when true, a later time from
--     the feed replaces a confirmation the feed made itself.
--   Only adds: the previous image keeps working on this schema.
-- ============================================================

SET LOCAL lock_timeout = '2s';

ALTER TABLE miot_trips.trip_milestone ADD COLUMN planned_at TIMESTAMPTZ;

ALTER TABLE miot_trips.trip_milestone DROP CONSTRAINT IF EXISTS trip_milestone_status_check;
ALTER TABLE miot_trips.trip_milestone ADD CONSTRAINT trip_milestone_status_check
    CHECK (status IN ('open', 'pending', 'confirmed', 'rejected'));

ALTER TABLE miot_trips.feed_profile ADD COLUMN feed_corrections BOOLEAN NOT NULL DEFAULT false;
