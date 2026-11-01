-- Frames with a position for the shadow map's first load: sender, position, frame time and arrival time.
-- Runs against the GPS tracking database, whose frames are public.asset_data (not the modulith's
-- miot_tracking.asset_data). One day at a time, read-only, for a list of vehicles:
--   PGOPTIONS="-c default_transaction_read_only=on -c statement_timeout=120s" \
--     psql -v ON_ERROR_STOP=1 -v day=2026-01-01 -v assets='{A,B}' -f export.sql > frames.part \
--     && mv frames.part frames-2026-01-01.csv
-- ON_ERROR_STOP makes a timeout fail the command, so a partial file is never published.
COPY (
    SELECT client_id, ST_Y(location::geometry), ST_X(location::geometry), "timestamp", created_datetime
    FROM public.asset_data
    WHERE "timestamp" >= :'day'::timestamptz AND "timestamp" < :'day'::timestamptz + interval '1 day'
      AND asset_id = ANY (:'assets'::text[])
      AND location IS NOT NULL
) TO STDOUT WITH (FORMAT csv);
