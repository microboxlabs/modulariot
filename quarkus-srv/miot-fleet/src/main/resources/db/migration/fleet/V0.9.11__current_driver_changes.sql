-- Poll and page current drivers by tenant and modification time, including deactivated drivers.
CREATE INDEX idx_fleet_driver_changes
    ON miot_fleet.driver (tenant_code, updated_at, id)
    WHERE version_of IS NULL;
