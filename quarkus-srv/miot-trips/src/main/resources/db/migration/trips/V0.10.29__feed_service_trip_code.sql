-- Case list enrichment reads only the newest service for each returned trip.
CREATE INDEX idx_feed_service_trip_code
    ON miot_trips.feed_service (tenant_code, trip_id, updated_at DESC)
    INCLUDE (external_code)
    WHERE trip_id IS NOT NULL;
