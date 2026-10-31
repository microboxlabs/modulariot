-- Frames with a position for the shadow map's first load: sender, position, frame time and arrival time.
-- Run read-only, one day at a time, for the vehicles of the fleet ($1 day start, $2 asset ids):
--   PGOPTIONS="-c default_transaction_read_only=on -c statement_timeout=120s"
COPY (
    SELECT client_id, latitude, longitude, "timestamp", created_datetime
    FROM asset_data
    WHERE "timestamp" >= :'day'::timestamptz AND "timestamp" < :'day'::timestamptz + interval '1 day'
      AND asset_id = ANY (:'assets'::text[])
      AND latitude IS NOT NULL AND longitude IS NOT NULL
) TO STDOUT WITH (FORMAT csv);
