-- Answer key for the fleet_ops dataset. Each query is the correct answer to a
-- question in analytics_cases.yaml; the eval compares the harness answer with it.
--
-- Rules the correct answers follow:
--   * one row per service: the latest process by proc_end (reopened services)
--   * driving time = minutes_moving summed over every tractor of the trip
--   * km = trip_distance_m summed over tractors, from GPS
--   * a symptom listed in telemetry.excluded_symptoms is not counted

-- name: services_2026
WITH s AS (
  SELECT DISTINCT ON (service_code) *
  FROM ops.service_process
  ORDER BY service_code, proc_end DESC NULLS FIRST
)
SELECT count(*) AS services FROM s WHERE extract(year FROM proc_start) = 2026;

-- name: driving_hours_2026
WITH s AS (
  SELECT DISTINCT ON (service_code) *
  FROM ops.service_process
  ORDER BY service_code, proc_end DESC NULLS FIRST
), g AS (
  SELECT trip_id, sum(minutes_moving) AS minutes, sum(trip_distance_m) / 1000.0 AS km
  FROM telemetry.trip_gps_summary GROUP BY trip_id
)
SELECT round(sum(g.minutes) / 60.0, 1) AS driving_hours,
       round(avg(g.minutes) / 60.0, 2) AS avg_hours_per_service,
       round(sum(g.km), 0) AS km
FROM s JOIN g ON g.trip_id = s.service_code
WHERE extract(year FROM s.proc_start) = 2026;

-- name: driving_hours_by_carrier_2026
WITH s AS (
  SELECT DISTINCT ON (service_code) *
  FROM ops.service_process
  ORDER BY service_code, proc_end DESC NULLS FIRST
), g AS (
  SELECT trip_id, sum(minutes_moving) AS minutes FROM telemetry.trip_gps_summary GROUP BY trip_id
)
SELECT s.carrier, round(sum(g.minutes) / 60.0, 1) AS driving_hours
FROM s JOIN g ON g.trip_id = s.service_code
WHERE extract(year FROM s.proc_start) = 2026
GROUP BY s.carrier ORDER BY driving_hours DESC;

-- name: gps_coverage_2026
WITH s AS (
  SELECT DISTINCT ON (service_code) *
  FROM ops.service_process
  ORDER BY service_code, proc_end DESC NULLS FIRST
)
SELECT round(100.0 * count(*) FILTER (WHERE EXISTS (
         SELECT 1 FROM telemetry.trip_gps_summary g WHERE g.trip_id = s.service_code))
       / count(*), 1) AS pct_services_with_gps
FROM s WHERE extract(year FROM s.proc_start) = 2026;

-- name: black_codes_attended_2026
WITH s AS (
  SELECT DISTINCT ON (service_code) *
  FROM ops.service_process
  ORDER BY service_code, proc_end DESC NULLS FIRST
), e AS (
  SELECT g.trip_id, d.key AS symptom, (d.value->>'b')::int AS black, (d.value->>'btr')::int AS black_treated
  FROM telemetry.trip_gps_summary g, jsonb_each(g.symptoms_detail) d
  WHERE d.key NOT IN (SELECT symptom_name FROM telemetry.excluded_symptoms)
)
SELECT sum(e.black) AS black_codes, sum(e.black_treated) AS attended,
       round(100.0 * sum(e.black_treated) / nullif(sum(e.black), 0), 1) AS pct_attended
FROM s JOIN e ON e.trip_id = s.service_code
WHERE extract(year FROM s.proc_start) = 2026;
