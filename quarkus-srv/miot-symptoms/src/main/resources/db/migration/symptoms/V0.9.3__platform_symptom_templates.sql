-- Platform symptom templates live in the catalog, as symptoms of the reserved tenant 'platform'. They are always
-- OFF, so the engine never evaluates them. A symptom copied from a template records the template's version.

ALTER TABLE miot_symptoms.symptom_definition ADD COLUMN template_version VARCHAR(32);

WITH seed (symptom_key, name, family, icon, description, source_key, spec) AS (VALUES
    ('speeding', 'Exceso de velocidad', 'driving_safety', 'SPEED LIMIT STANDARD', 'En viaje y sobre el límite de la vía',
     'gps_signal',
     $spec${"source":"gps_signal","activation":"signal.trip.active && signal.road.maxspeed_osm > 0","measure":{"expression":"signal.gps.speed_kmh - signal.road.maxspeed_osm","label":"Exceso sobre el límite","unit":"km/h"},"levels":[{"icu":1,"applies":true,"when":"measure > 0 && measure < 5","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":2,"applies":true,"when":"measure >= 5 && measure < 10","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":3,"applies":true,"when":"measure >= 10 && measure < 20","response":{"operator":true,"slaMinutes":15,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":4,"applies":true,"when":"measure >= 20 && held_s >= 60","response":{"operator":true,"slaMinutes":5,"steps":[],"notices":[],"evidence":[],"ignorable":false}}],"lifecycle":{"open":"case.condition_s >= 0","close":"case.normal_s >= 120"},"family":"driving_safety","state":"OFF"}$spec$),
    ('speeding-custom-limit', 'Exceso sobre el límite propio', 'driving_safety', 'SPEED LIMIT CUSTOM', 'En viaje y sobre el límite que fija la organización para la zona',
     'gps_signal',
     $spec${"source":"gps_signal","activation":"signal.trip.active && signal.road.maxspeed_custom > 0","measure":{"expression":"signal.gps.speed_kmh - signal.road.maxspeed_custom","label":"Exceso sobre el límite propio","unit":"km/h"},"levels":[{"icu":1,"applies":true,"when":"measure > 0 && measure < 5","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":2,"applies":true,"when":"measure >= 5 && measure < 10","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":3,"applies":true,"when":"measure >= 10 && measure < 20","response":{"operator":true,"slaMinutes":15,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":4,"applies":true,"when":"measure >= 20 && held_s >= 60","response":{"operator":true,"slaMinutes":5,"steps":[],"notices":[],"evidence":[],"ignorable":false}}],"lifecycle":{"open":"case.condition_s >= 0","close":"case.normal_s >= 120"},"family":"driving_safety","state":"OFF"}$spec$),
    ('night-stop-unauthorized', 'Detención nocturna fuera de zona autorizada', 'zones_places', 'NIGHT STAY RISK', 'En viaje, detenido entre 21:00 y 06:00 fuera de una zona autorizada',
     'gps_signal',
     $spec${"source":"gps_signal","activation":"signal.trip.active && !signal.gps.moving && !signal.geo.authorized_zone && (signal.local_hour >= 21 || signal.local_hour < 6)","levels":[{"icu":1,"applies":true,"when":"held_s < 600","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":2,"applies":true,"when":"held_s >= 600 && held_s < 1200","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":3,"applies":true,"when":"held_s >= 1200 && held_s < 1800","response":{"operator":true,"slaMinutes":15,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":4,"applies":true,"when":"held_s >= 1800","response":{"operator":true,"slaMinutes":10,"steps":[],"notices":[],"evidence":[],"ignorable":false}}],"lifecycle":{"open":"case.condition_s >= 0","close":"case.normal_s >= 300"},"family":"zones_places","state":"OFF"}$spec$),
    ('off-hours-driving', 'Conducción en horario no permitido', 'workday_fatigue', 'OFF HOURS DRIVING', 'En viaje con un conductor y en movimiento entre 02:00 y 06:00',
     'gps_signal',
     $spec${"source":"gps_signal","activation":"signal.trip.active && signal.gps.moving && !signal.trip.double_driver && signal.local_hour >= 2 && signal.local_hour < 6","levels":[{"icu":1,"applies":true,"when":"held_s < 300","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":2,"applies":true,"when":"held_s >= 300 && held_s < 900","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":3,"applies":true,"when":"held_s >= 900 && held_s < 1800","response":{"operator":true,"slaMinutes":15,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":4,"applies":true,"when":"held_s >= 1800","response":{"operator":true,"slaMinutes":10,"steps":[],"notices":[],"evidence":[],"ignorable":false}}],"lifecycle":{"open":"case.condition_s >= 0","close":"case.normal_s >= 300"},"family":"workday_fatigue","state":"OFF"}$spec$),
    ('continuous-driving', 'Conducción continua', 'workday_fatigue', 'CONTINUOUS DRIVE CHECK', 'En viaje con un conductor, conduciendo sin descanso',
     'trip_check',
     $spec${"source":"trip_check","activation":"check.trip.active && !check.trip.double_driver","measure":{"expression":"check.driving_minutes","label":"Minutos conduciendo seguido","unit":"min"},"levels":[{"icu":1,"applies":true,"when":"measure >= 270 && measure < 300","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":2,"applies":true,"when":"measure >= 300 && measure < 330","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":3,"applies":true,"when":"measure >= 330 && measure < 360","response":{"operator":true,"slaMinutes":15,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":4,"applies":true,"when":"measure >= 360","response":{"operator":true,"slaMinutes":10,"steps":[],"notices":[],"evidence":[],"ignorable":false}}],"lifecycle":{"open":"case.condition_s >= 0","close":"case.normal_s >= 600"},"family":"workday_fatigue","state":"OFF"}$spec$),
    ('signal-loss', 'Pérdida de señal', 'signal_continuity', 'LOST SIGNAL', 'En viaje y sin señales del GPS',
     'trip_check',
     $spec${"source":"trip_check","activation":"check.trip.active","measure":{"expression":"check.signal_lost_minutes","label":"Minutos sin señal","unit":"min"},"levels":[{"icu":1,"applies":true,"when":"measure >= 30 && measure < 90","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":2,"applies":true,"when":"measure >= 90 && measure < 120","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":3,"applies":true,"when":"measure >= 120 && measure < 180","response":{"operator":true,"slaMinutes":15,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":4,"applies":true,"when":"measure >= 180","response":{"operator":true,"slaMinutes":10,"steps":[],"notices":[],"evidence":[],"ignorable":false}}],"lifecycle":{"open":"case.condition_s >= 0","close":"case.normal_s >= 600"},"family":"signal_continuity","state":"OFF"}$spec$),
    ('panic-button', 'Botón de pánico', 'emergencies', NULL, 'El conductor presiona el botón de pánico del GPS',
     'gps_signal',
     $spec${"source":"gps_signal","activation":"has(signal.frame) && has(signal.frame.sensors) && has(signal.frame.sensors.panic_button) && signal.frame.sensors.panic_button == true","levels":[{"icu":1,"applies":false,"when":null,"response":null},{"icu":2,"applies":false,"when":null,"response":null},{"icu":3,"applies":false,"when":null,"response":null},{"icu":4,"applies":true,"when":"true","response":{"operator":true,"slaMinutes":2,"steps":[],"notices":[],"evidence":[],"ignorable":false}}],"lifecycle":{"open":"case.condition_s >= 0","close":"case.closed_by_operator"},"family":"emergencies","state":"OFF"}$spec$)
), definitions AS (
    INSERT INTO miot_symptoms.symptom_definition
        (tenant_code, symptom_key, name, family, icon, description, source_key, state, current_version,
         created_by, updated_by)
    SELECT 'platform', symptom_key, name, family, icon, description, source_key, 'OFF', '1.0.0',
           'platform-seed', 'platform-seed'
    FROM seed
    ON CONFLICT (tenant_code, symptom_key) DO NOTHING
    RETURNING id, symptom_key
)
INSERT INTO miot_symptoms.symptom_version
    (definition_id, tenant_code, version, status, spec, bump, reason, created_by, published_by, published_at)
SELECT d.id, 'platform', '1.0.0', 'PUBLISHED', to_jsonb(s.spec), 'MAJOR', 'Plantilla inicial de la plataforma',
       'platform-seed', 'platform-seed', now()
FROM definitions d JOIN seed s ON s.symptom_key = d.symptom_key;

-- Symptoms already copied from a template were copied from this content.
UPDATE miot_symptoms.symptom_definition
SET template_version = '1.0.0'
WHERE template_key IS NOT NULL AND tenant_code <> 'platform';
