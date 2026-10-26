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

-- Only the newest published version routes new trips. Refuse ambiguous
-- backfills before removing legacy routing; Flyway rolls this migration back.
DO $$
DECLARE
    pair RECORD;
    dimension TEXT;
    left_values TEXT[];
    right_values TEXT[];
    has_intersection BOOLEAN;
    left_inside BOOLEAN;
    right_inside BOOLEAN;
BEGIN
    FOR pair IN
        WITH latest AS (
            SELECT DISTINCT ON (tenant_code, monitor_key) tenant_code, monitor_key, scope
              FROM miot_trips.trip_monitor
             WHERE status = 'published'
             ORDER BY tenant_code, monitor_key, version DESC
        )
        SELECT a.tenant_code, a.monitor_key AS left_key, b.monitor_key AS right_key,
               a.scope AS left_scope, b.scope AS right_scope
          FROM latest a JOIN latest b
            ON a.tenant_code = b.tenant_code AND a.monitor_key < b.monitor_key
         WHERE a.scope IS NOT NULL AND b.scope IS NOT NULL
    LOOP
        has_intersection := true;
        left_inside := true;
        right_inside := true;
        FOREACH dimension IN ARRAY ARRAY['feeds', 'orderTypes', 'origins', 'destinations'] LOOP
            SELECT ARRAY(SELECT DISTINCT btrim(value)
                           FROM jsonb_array_elements_text(pair.left_scope -> dimension) value
                          WHERE btrim(value) <> '') INTO left_values;
            SELECT ARRAY(SELECT DISTINCT btrim(value)
                           FROM jsonb_array_elements_text(pair.right_scope -> dimension) value
                          WHERE btrim(value) <> '') INTO right_values;
            IF cardinality(left_values) > 0 AND cardinality(right_values) > 0
                    AND NOT left_values && right_values THEN
                has_intersection := false;
                EXIT;
            END IF;
            left_inside := left_inside AND (cardinality(right_values) = 0
                OR (cardinality(left_values) > 0 AND right_values @> left_values));
            right_inside := right_inside AND (cardinality(left_values) = 0
                OR (cardinality(right_values) > 0 AND left_values @> right_values));
        END LOOP;
        IF has_intersection AND left_inside = right_inside THEN
            RAISE EXCEPTION 'Cannot migrate monitor scopes: tenant %, monitors % and % have equal or partly overlapping scopes. Adjust legacy routing to disjoint or nested scopes before retrying.',
                pair.tenant_code, pair.left_key, pair.right_key;
        END IF;
    END LOOP;
END $$;

DROP TABLE miot_trips.trip_monitor_selector;
ALTER TABLE miot_trips.feed_profile DROP COLUMN monitor_key;
