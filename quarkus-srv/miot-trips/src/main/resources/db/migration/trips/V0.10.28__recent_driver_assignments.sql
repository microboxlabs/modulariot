-- Cross-tenant discovery of recent assignments, then tenant/driver reads in the same window.
CREATE INDEX idx_assignment_recent_driver
    ON miot_trips.trip_resource_assignment (created_at, tenant_code, resource_id)
    WHERE resource_type = 'driver' AND version_of IS NULL AND is_active;
