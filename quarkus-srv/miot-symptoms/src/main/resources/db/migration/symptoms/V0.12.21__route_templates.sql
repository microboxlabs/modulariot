-- Route templates with the escalation of the GPS database's rules.
-- ETA early and late: the predicted arrival against the estimated one (signal.trip.eta_deviation_min, not
-- evaluated yet). Early opens from 40 min ahead (level 2 at 60, 3 at 120, 4 at 180), late from 120 min behind
-- (level 2 at 180, 3 at 240, 4 at 480), before the destination is reached; the level follows the deviation and
-- only an operator or the trip's end closes the case. The GPS database hides every one of these cases, so no
-- level asks for an operator.
-- Double-driver rotation: on a trip with two drivers, a level-3 call reminder 30 min after the trip starts and
-- again 5 h after the operator closed the previous one (case.closed_on_trip_s), until the destination.

WITH seed (symptom_key, name, family, icon, description, source_key, spec) AS (VALUES
    ('eta-early', 'Desvío anticipado de ETA', 'route_plan', NULL, 'En viaje, la llegada prevista se adelanta 40 min o más a la estimada',
     'gps_signal',
     '{"source":"gps_signal","activation":"signal.trip.active && signal.?trip.?destination.?visited != TRUE && signal.?trip.?eta_deviation_min.orValue(0.0) <= -40.0","measure":{"expression":"-signal.trip.eta_deviation_min","label":"Minutos antes de la llegada estimada","unit":"min"},"levels":[{"icu":1,"applies":true,"when":"measure < 60.0","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":2,"applies":true,"when":"measure >= 60.0 && measure < 120.0","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":3,"applies":true,"when":"measure >= 120.0 && measure < 180.0","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":4,"applies":true,"when":"measure >= 180.0","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}}],"lifecycle":{"open":"case.condition_s >= 0","close":"case.closed_by_operator || !signal.trip.active","levelDown":true},"family":"route_plan","state":"OFF"}'),
    ('eta-late', 'Desvío retardado de ETA', 'route_plan', NULL, 'En viaje, la llegada prevista se atrasa 120 min o más sobre la estimada',
     'gps_signal',
     '{"source":"gps_signal","activation":"signal.trip.active && signal.?trip.?destination.?visited != TRUE && signal.?trip.?eta_deviation_min.orValue(0.0) >= 120.0","measure":{"expression":"signal.trip.eta_deviation_min","label":"Minutos después de la llegada estimada","unit":"min"},"levels":[{"icu":1,"applies":true,"when":"measure < 180.0","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":2,"applies":true,"when":"measure >= 180.0 && measure < 240.0","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":3,"applies":true,"when":"measure >= 240.0 && measure < 480.0","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":4,"applies":true,"when":"measure >= 480.0","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}}],"lifecycle":{"open":"case.condition_s >= 0","close":"case.closed_by_operator || !signal.trip.active","levelDown":true},"family":"route_plan","state":"OFF"}'),
    ('double-driver-rotation', 'Llamada doble conductor', 'workday_fatigue', 'DOUBLE DRIVER ROTATION CHECK', 'En viaje con dos conductores, recordar el cambio de conductor cada 5 h',
     'gps_signal',
     '{"source":"gps_signal","activation":"signal.trip.active && signal.trip.double_driver && signal.?trip.?destination.?visited != TRUE && signal.?trip.?age_min.orValue(0.0) >= 30.0","levels":[{"icu":1,"applies":false,"when":null,"response":null},{"icu":2,"applies":false,"when":null,"response":null},{"icu":3,"applies":true,"when":"true","response":{"operator":true,"slaMinutes":15,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":4,"applies":false,"when":null,"response":null}],"lifecycle":{"open":"case.condition_s >= 0 && (!case.closed_on_trip || case.closed_on_trip_s >= 18000)","close":"case.closed_by_operator || !signal.trip.active"},"family":"workday_fatigue","state":"OFF"}')
), definitions AS (
    INSERT INTO miot_symptoms.symptom_definition
        (tenant_code, symptom_key, name, family, icon, description, source_key, state, current_version,
         created_by, updated_by)
    SELECT '_platform', symptom_key, name, family, icon, description, source_key, 'OFF', '1.0.0',
           'platform-seed', 'platform-seed'
    FROM seed
    ON CONFLICT (tenant_code, symptom_key) DO NOTHING
    RETURNING id, symptom_key
)
INSERT INTO miot_symptoms.symptom_version
    (definition_id, tenant_code, version, status, spec, bump, reason, created_by, published_by, published_at)
SELECT d.id, '_platform', '1.0.0', 'PUBLISHED', s.spec::jsonb, 'MAJOR', 'Plantilla inicial de la plataforma',
       'platform-seed', 'platform-seed', now()
FROM definitions d JOIN seed s ON s.symptom_key = d.symptom_key;

