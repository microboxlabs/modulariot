-- Latest metrics lookup functions.
-- Migrated from db-writer V1.36.0.

-- Single asset: returns latest metric snapshot as JSONB.
CREATE OR REPLACE FUNCTION miot_tracking.fn_latest_metrics(
    p_shared_client_id TEXT,
    p_asset_id         TEXT
)
RETURNS JSONB
LANGUAGE SQL STABLE PARALLEL SAFE
AS $$
    SELECT to_jsonb(m)
        - 'id'
        - 'asset_data_id'
        - 'request_id'
        - 'payload_schema'
        - 'seq'
        - 'request_timestamp'
        - 'created_datetime'
    FROM (
        SELECT DISTINCT ON (asset_id) *
        FROM miot_tracking.asset_metric_core
        WHERE shared_client_id = p_shared_client_id
          AND asset_id         = p_asset_id
        ORDER BY asset_id, ts DESC
    ) m
$$;

-- Batch: returns latest metrics for multiple assets in one round-trip.
CREATE OR REPLACE FUNCTION miot_tracking.fn_latest_metrics_batch(
    p_shared_client_id TEXT,
    p_asset_ids        TEXT[]
)
RETURNS TABLE(asset_id TEXT, metrics JSONB)
LANGUAGE SQL STABLE PARALLEL SAFE
AS $$
    SELECT
        m.asset_id::TEXT,
        to_jsonb(m)
            - 'id'
            - 'asset_data_id'
            - 'request_id'
            - 'payload_schema'
            - 'seq'
            - 'request_timestamp'
            - 'created_datetime'
    FROM (
        SELECT DISTINCT ON (asset_id) *
        FROM miot_tracking.asset_metric_core
        WHERE shared_client_id = p_shared_client_id
          AND asset_id = ANY(p_asset_ids)
        ORDER BY asset_id, ts DESC
    ) m
$$;

COMMENT ON FUNCTION miot_tracking.fn_latest_metrics IS
    'Latest metric snapshot for one asset as JSONB. '
    'Implementation: DISTINCT ON asset_metric_core. '
    'Escalation path: swap body for last_metric_data lookup if p95 > 100ms at scale.';

COMMENT ON FUNCTION miot_tracking.fn_latest_metrics_batch IS
    'Latest metric snapshot for multiple assets — one DB round-trip. '
    'Use for fleet list views. Same escalation path as fn_latest_metrics.';
