-- ============================================================
-- V0.10.13 — feeds declare the plan only; the trip's monitor moves it.
--   feed_profile.monitor_key:   the monitor of the trips the feed creates;
--                               null lets the tenant's selector pick it.
--   feed_profile.arrival_stage: the stage whose planned end is the arrival
--                               time (was close_stage).
--   departure_stage and close_tolerance_minutes go: departure and close are
--   monitor rules now, and no clock re-checks open services.
-- ============================================================

ALTER TABLE miot_trips.feed_profile ADD COLUMN monitor_key VARCHAR(64);
ALTER TABLE miot_trips.feed_profile RENAME COLUMN close_stage TO arrival_stage;
ALTER TABLE miot_trips.feed_profile DROP COLUMN departure_stage;
ALTER TABLE miot_trips.feed_profile DROP COLUMN close_tolerance_minutes;

DROP INDEX miot_trips.idx_feed_service_open;
