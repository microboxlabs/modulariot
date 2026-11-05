-- Driving and rest templates with the escalation of the GPS database's trackers, on the trip_check source.
-- continuous-driving 2.0.0: on a trip with one driver, from 4 h 30 min of net driving; level 2 at 300 min, 3 at
-- 330, 4 at 360; rest lowers the level and the case closes on the first check under 270 min. Symptoms copied
-- from 1.0.0 keep their rules.
-- continuous-resting: on a trip with one driver, after 975 min (16 h 15 min) without a rest of 8 h; the level
-- falls as the current rest grows: under 420 min (or driving) level 4, 420-435 level 3, 435-465 level 2, then 1.
-- Neither tracker writes its check yet (check.driving_minutes, check.duty_minutes and check.resting_minutes
-- are not evaluated), so both templates open nothing until it does.

WITH seed (symptom_key, name, family, icon, description, source_key, spec) AS (VALUES
    ('continuous-resting', 'Descanso mínimo continuo', 'workday_fatigue', 'CONTINUOUS RESTING CHECK', 'En viaje con un conductor, más de 16 h 15 min sin un descanso de 8 h',
     'trip_check',
     '{"source":"trip_check","activation":"check.trip.active && !check.trip.double_driver && check.duty_minutes >= 975.0","measure":{"expression":"check.resting_minutes","label":"Minutos de descanso","unit":"min"},"levels":[{"icu":1,"applies":true,"when":"measure >= 465.0","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":2,"applies":true,"when":"measure >= 435.0 && measure < 465.0","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":3,"applies":true,"when":"measure >= 420.0 && measure < 435.0","response":{"operator":true,"slaMinutes":15,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":4,"applies":true,"when":"measure < 420.0","response":{"operator":true,"slaMinutes":10,"steps":[],"notices":[],"evidence":[],"ignorable":false}}],"lifecycle":{"open":"case.condition_s >= 0","close":"case.closed_by_operator || case.normal_s >= 0","levelDown":true},"family":"workday_fatigue","state":"OFF"}')
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

WITH upgrade (symptom_key, version, spec, bump, reason, description) AS (VALUES
    ('continuous-driving', '2.0.0',
     '{"source":"trip_check","activation":"check.trip.active && !check.trip.double_driver && check.driving_minutes >= 270.0","measure":{"expression":"check.driving_minutes","label":"Minutos conduciendo seguido","unit":"min"},"levels":[{"icu":1,"applies":true,"when":"check.driving_minutes < 300.0","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":2,"applies":true,"when":"check.driving_minutes >= 300.0 && check.driving_minutes < 330.0","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":3,"applies":true,"when":"check.driving_minutes >= 330.0 && check.driving_minutes < 360.0","response":{"operator":true,"slaMinutes":15,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":4,"applies":true,"when":"check.driving_minutes >= 360.0","response":{"operator":true,"slaMinutes":10,"steps":[],"notices":[],"evidence":[],"ignorable":false}}],"lifecycle":{"open":"case.condition_s >= 0","close":"case.normal_s >= 0","levelDown":true},"family":"workday_fatigue","state":"OFF"}',
     'MAJOR', 'Escalamiento del control de conducción continua de la base GPS', 'En viaje con un conductor, 4 h 30 min o más conduciendo sin descanso')
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

