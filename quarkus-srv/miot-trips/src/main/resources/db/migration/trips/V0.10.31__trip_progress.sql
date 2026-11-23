-- When each trip departed and whether it arrived, one row per trip row (every version, active or not).
-- Scalar subqueries, no GROUP BY: PostgreSQL inlines the view, so a reader filtered by trip reads by index.
CREATE VIEW miot_trips.trip_progress AS
SELECT t.tenant_code,
       t.id AS trip_id,
       coalesce((SELECT m.confirmed_at FROM miot_trips.trip_milestone m
                  WHERE m.tenant_code = t.tenant_code AND m.trip_id = t.id
                    AND m.milestone = 'departure' AND m.status = 'confirmed'),
                (SELECT min(s.actual_start) FROM miot_trips.stage s
                  WHERE s.tenant_code = t.tenant_code AND s.subject_type = 'trip'
                    AND s.subject_id = t.id AND s.stage_type IN ('transit', 'stop')
                    AND s.version_of IS NULL AND s.is_active)) AS departed_at,
       EXISTS (SELECT 1 FROM miot_trips.trip_milestone m
                WHERE m.tenant_code = t.tenant_code AND m.trip_id = t.id
                  AND m.milestone = 'arrival' AND m.status = 'confirmed') AS arrived,
       (SELECT m.confirmed_at FROM miot_trips.trip_milestone m
         WHERE m.tenant_code = t.tenant_code AND m.trip_id = t.id
           AND m.milestone = 'arrival' AND m.status = 'confirmed') AS arrived_at
  FROM miot_trips.trip t;

COMMENT ON VIEW miot_trips.trip_progress IS
    'The contract with miot-symptoms: when a trip departed and whether it arrived. '
    'When the milestone model changes, change this view, not its readers.';
