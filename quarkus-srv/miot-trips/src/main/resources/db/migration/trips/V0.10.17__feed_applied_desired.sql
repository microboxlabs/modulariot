-- Keep the last applied feed state while a newer desired state waits for reconciliation.
-- This lets a closed trip report changed plan fields even when the feed uses the async worker.
ALTER TABLE miot_trips.feed_service ADD COLUMN applied_desired JSONB;
UPDATE miot_trips.feed_service
SET applied_desired = desired
WHERE last_action IS NOT NULL AND last_action NOT IN ('pending', 'error', 'report');
