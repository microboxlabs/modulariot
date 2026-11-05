-- ============================================================
-- V0.10.22 — each monitor version says which trips it takes.
--   trip_monitor.scope: {feeds, orderTypes, origins, destinations},
--     lists of accepted values; an empty list accepts any. Null: the
--     monitor takes no trips until a scope is set.
--   Filled from the feed profiles that named the monitor; otherwise
--   from selector entries `trip.orderType == '<value>'` or `true`.
--   Other selector conditions are not carried over.
--   trip_monitor_selector and feed_profile.monitor_key go.
-- ============================================================

ALTER TABLE miot_trips.trip_monitor ADD COLUMN scope JSONB;

WITH from_feeds AS (
    SELECT tenant_code, monitor_key, jsonb_agg(feed_key ORDER BY feed_key) AS feeds
    FROM miot_trips.feed_profile
    WHERE monitor_key IS NOT NULL
    GROUP BY tenant_code, monitor_key
)
UPDATE miot_trips.trip_monitor m
SET scope = jsonb_build_object('feeds', f.feeds, 'orderTypes', '[]'::jsonb,
                               'origins', '[]'::jsonb, 'destinations', '[]'::jsonb)
FROM from_feeds f
WHERE m.tenant_code = f.tenant_code AND m.monitor_key = f.monitor_key;

WITH from_selector AS (
    SELECT tenant_code, monitor_key,
           COALESCE(jsonb_agg(DISTINCT substring(condition FROM '^\s*trip\.orderType\s*==\s*''([^'']+)''\s*$'))
                    FILTER (WHERE condition ~ '^\s*trip\.orderType\s*==\s*''[^'']+''\s*$'), '[]'::jsonb) AS order_types,
           bool_or(btrim(condition) = 'true') AS any_trip
    FROM miot_trips.trip_monitor_selector
    GROUP BY tenant_code, monitor_key
)
UPDATE miot_trips.trip_monitor m
SET scope = jsonb_build_object('feeds', '[]'::jsonb,
                               'orderTypes', CASE WHEN s.any_trip THEN '[]'::jsonb ELSE s.order_types END,
                               'origins', '[]'::jsonb, 'destinations', '[]'::jsonb)
FROM from_selector s
WHERE m.tenant_code = s.tenant_code AND m.monitor_key = s.monitor_key AND m.scope IS NULL
  AND (s.any_trip OR jsonb_array_length(s.order_types) > 0);

DROP TABLE miot_trips.trip_monitor_selector;
ALTER TABLE miot_trips.feed_profile DROP COLUMN monitor_key;
