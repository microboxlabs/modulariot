-- Multi-client mapping tables.
-- Consolidated from db-writer V1.29.0 and V1.29.1.

-- asset_data_client: one row per asset-client pair per message (partitioned monthly)
CREATE TABLE miot_tracking.asset_data_client (
    asset_data_id       INT8 NOT NULL,
    asset_id            TEXT NOT NULL,
    shared_client_id    TEXT NOT NULL,
    timestamp           TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT asset_data_client_pkey PRIMARY KEY (asset_data_id, shared_client_id, timestamp)
) PARTITION BY RANGE (timestamp);

CREATE INDEX idx_adc_shared_client_timestamp
    ON miot_tracking.asset_data_client (shared_client_id, timestamp DESC);
CREATE INDEX idx_adc_timestamp_asset
    ON miot_tracking.asset_data_client (shared_client_id, asset_id, timestamp DESC);

-- asset_client_map: configuration table mapping assets to shared clients
CREATE TABLE miot_tracking.asset_client_map (
    asset_id            TEXT NOT NULL,
    shared_client_id    TEXT NOT NULL,
    active              BOOLEAN NOT NULL DEFAULT TRUE,
    valid_from          TIMESTAMPTZ DEFAULT NOW(),
    valid_to            TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 year',
    CONSTRAINT asset_client_map_pkey PRIMARY KEY (asset_id, shared_client_id)
);

CREATE INDEX idx_acm_asset_active
    ON miot_tracking.asset_client_map (asset_id) WHERE active = TRUE;
CREATE INDEX idx_acm_client
    ON miot_tracking.asset_client_map (shared_client_id);

-- pg_partman configuration for asset_data_client
SELECT partman.create_parent(
    p_parent_table := 'miot_tracking.asset_data_client',
    p_control      := 'timestamp',
    p_type         := 'range',
    p_interval     := '1 month',
    p_start_partition := '2026-01-01'
);

UPDATE partman.part_config
SET premake = 1
WHERE parent_table = 'miot_tracking.asset_data_client';
