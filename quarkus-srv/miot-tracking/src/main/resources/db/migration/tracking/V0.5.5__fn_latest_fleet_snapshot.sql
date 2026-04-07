-- Latest fleet snapshot lookup for fleet list/detail views.
-- Uses the client-scoped asset_data_client index to avoid scans on asset_data.

CREATE OR REPLACE FUNCTION miot_tracking.fn_latest_fleet_snapshot_batch(
    p_shared_client_id TEXT,
    p_asset_ids        TEXT[]
)
RETURNS TABLE(
    asset_id     TEXT,
    tracking     JSONB,
    metric_core  JSONB,
    metric_dtc   JSONB,
    metric_ext   JSONB
)
LANGUAGE SQL STABLE PARALLEL SAFE
AS $$
    WITH input_assets AS (
        SELECT DISTINCT UNNEST(p_asset_ids)::TEXT AS asset_id
    ),
    latest_tracking_ref AS (
        SELECT DISTINCT ON (adc.asset_id)
            adc.asset_id,
            adc.asset_data_id
        FROM input_assets i
        JOIN miot_tracking.asset_data_client adc
            ON adc.asset_id = i.asset_id
        WHERE adc.shared_client_id = p_shared_client_id
        ORDER BY adc.asset_id, adc.timestamp DESC
    ),
    latest_tracking AS (
        SELECT
            r.asset_id,
            jsonb_strip_nulls(
                jsonb_build_object(
                    'timestamp', ad.timestamp,
                    'speed', ad.speed,
                    'heading', ad.heading,
                    'altitude', ad.altitude,
                    'gps_provider', ad.telcom_gps_provider,
                    'driver_id', ad.driver_info_driver_id,
                    'driver_name', ad.driver_info_name,
                    'driver_license_number', ad.driver_info_license_number,
                    'co_driver_id', ad.co_driver_info_driver_id,
                    'co_driver_name', ad.co_driver_info_name,
                    'latitude', ST_Y(ad.location::geometry),
                    'longitude', ST_X(ad.location::geometry)
                )
            ) AS tracking
        FROM latest_tracking_ref r
        JOIN miot_tracking.asset_data ad
            ON ad.id = r.asset_data_id
    ),
    latest_core AS (
        SELECT DISTINCT ON (m.asset_id)
            m.asset_id,
            to_jsonb(m)
                - 'id'
                - 'asset_data_id'
                - 'request_id'
                - 'payload_schema'
                - 'seq'
                - 'request_timestamp'
                - 'created_datetime'
                - 'shared_client_id' AS metric_core
        FROM input_assets i
        JOIN miot_tracking.asset_metric_core m
            ON m.asset_id = i.asset_id
        WHERE m.shared_client_id = p_shared_client_id
        ORDER BY m.asset_id, m.ts DESC
    ),
    latest_dtc AS (
        SELECT DISTINCT ON (d.asset_id)
            d.asset_id,
            to_jsonb(d)
                - 'id'
                - 'asset_data_id'
                - 'request_id'
                - 'payload_schema'
                - 'request_timestamp'
                - 'created_datetime'
                - 'shared_client_id' AS metric_dtc
        FROM input_assets i
        JOIN miot_tracking.asset_metric_dtc d
            ON d.asset_id = i.asset_id
        WHERE d.shared_client_id = p_shared_client_id
        ORDER BY d.asset_id, d.ts DESC
    ),
    latest_ext AS (
        SELECT DISTINCT ON (e.asset_id)
            e.asset_id,
            e.ext AS metric_ext
        FROM input_assets i
        JOIN miot_tracking.asset_metric_ext e
            ON e.asset_id = i.asset_id
        WHERE e.shared_client_id = p_shared_client_id
        ORDER BY e.asset_id, e.ts DESC
    )
    SELECT
        i.asset_id,
        t.tracking,
        c.metric_core,
        d.metric_dtc,
        e.metric_ext
    FROM input_assets i
    LEFT JOIN latest_tracking t ON t.asset_id = i.asset_id
    LEFT JOIN latest_core c ON c.asset_id = i.asset_id
    LEFT JOIN latest_dtc d ON d.asset_id = i.asset_id
    LEFT JOIN latest_ext e ON e.asset_id = i.asset_id
$$;

COMMENT ON FUNCTION miot_tracking.fn_latest_fleet_snapshot_batch(TEXT, TEXT[]) IS
    'Latest fleet card snapshot for multiple assets. Uses asset_data_client for tracking lookup and batch DISTINCT ON for core/dtc/ext metrics.';
