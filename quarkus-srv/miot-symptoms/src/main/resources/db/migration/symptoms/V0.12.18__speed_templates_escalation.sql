-- The speeding templates 2.0.0, with the escalation of the GPS database's speed rules: the speed rounded to
-- km/h over the limit; level 2 from 5 km/h over, 3 from 11, 4 over 21 held 60 s (own limit: 6 s). A case opens
-- after 60 s over the limit (own limit: 9 s) once the excess reaches 5 km/h, follows the excess down, closes on
-- the first signal under the limit, and at level 4 after 120 s under it. Where the organization has its own
-- limit for the road, the road limit is not checked. The road part is read as optional, so the templates raise
-- no rule error while the signal has no road limits. Symptoms copied from 1.0.0 keep their rules.

WITH upgrade (symptom_key, version, spec, bump, reason, description) AS (VALUES
    ('speeding', '2.0.0',
     '{"source":"gps_signal","activation":"signal.trip.active && signal.?road.?maxspeed_osm.orValue(0.0) > 0.0 && signal.?road.?maxspeed_custom.orValue(0.0) <= 0.0","measure":{"expression":"double(int(signal.frame.gps.speed + 0.5)) - signal.road.maxspeed_osm","label":"Exceso sobre el límite","unit":"km/h"},"levels":[{"icu":1,"applies":true,"when":"measure > 0.0 && measure < 5.0","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":2,"applies":true,"when":"measure >= 5.0 && measure < 11.0","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":3,"applies":true,"when":"measure >= 11.0 && measure <= 21.0","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":4,"applies":true,"when":"measure > 21.0 && held_s >= 60","response":{"operator":true,"slaMinutes":5,"steps":[],"notices":[],"evidence":[],"ignorable":false}}],"lifecycle":{"open":"case.condition_s >= 60 && case.level >= 2","close":"case.normal_s >= 0 && case.level < 4 || case.normal_s >= 120","levelDown":true},"family":"driving_safety","state":"OFF"}',
     'MAJOR', 'Escalamiento de las reglas de velocidad de la base GPS', 'En viaje y sobre el límite de la vía por más de un minuto'),
    ('speeding-custom-limit', '2.0.0',
     '{"source":"gps_signal","activation":"signal.trip.active && signal.?road.?maxspeed_custom.orValue(0.0) > 0.0","measure":{"expression":"double(int(signal.frame.gps.speed + 0.5)) - signal.road.maxspeed_custom","label":"Exceso sobre el límite propio","unit":"km/h"},"levels":[{"icu":1,"applies":true,"when":"measure > 0.0 && measure < 5.0","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":2,"applies":true,"when":"measure >= 5.0 && measure < 11.0","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":3,"applies":true,"when":"measure >= 11.0 && measure <= 21.0","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":4,"applies":true,"when":"measure > 21.0 && held_s >= 6","response":{"operator":true,"slaMinutes":5,"steps":[],"notices":[],"evidence":[],"ignorable":false}}],"lifecycle":{"open":"case.condition_s >= 9 && case.level >= 2","close":"case.normal_s >= 0 && case.level < 4 || case.normal_s >= 120","levelDown":true},"family":"driving_safety","state":"OFF"}',
     'MAJOR', 'Escalamiento de las reglas de velocidad de la base GPS', 'En viaje y sobre el límite que fija la organización para la vía')
), published AS (
    INSERT INTO miot_symptoms.symptom_version
        (definition_id, tenant_code, version, status, spec, bump, reason, created_by, published_by, published_at)
    SELECT d.id, '_platform', u.version, 'PUBLISHED', u.spec::jsonb, u.bump, u.reason, 'platform-seed',
           'platform-seed', now()
    FROM upgrade u
    JOIN miot_symptoms.symptom_definition d ON d.tenant_code = '_platform' AND d.symptom_key = u.symptom_key
    ON CONFLICT DO NOTHING
    RETURNING definition_id
)
UPDATE miot_symptoms.symptom_definition d
SET current_version = u.version, description = u.description, updated_by = 'platform-seed', updated_at = now()
FROM upgrade u
WHERE d.tenant_code = '_platform' AND d.symptom_key = u.symptom_key;

