-- asset_id links rd_trucks to the GPS/metrics tracking system (asset_metric_core.asset_id).
-- This is separate from external_id (source system ERP key) — a truck has both.
-- Populated via bulk-sync payload or manual assignment during device provisioning.
ALTER TABLE miot_fleet.rd_trucks
    ADD COLUMN IF NOT EXISTS asset_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_trucks_asset_id
    ON miot_fleet.rd_trucks (client_id, asset_id)
    WHERE asset_id IS NOT NULL;

COMMENT ON COLUMN miot_fleet.rd_trucks.asset_id IS
    'GPS/metrics system identifier. Maps to asset_metric_core.asset_id and last_signal_data.asset_id.';
