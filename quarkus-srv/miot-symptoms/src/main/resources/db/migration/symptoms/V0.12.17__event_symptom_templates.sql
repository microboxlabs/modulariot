-- Platform templates for device and driver-app events, with the escalation of the GPS database's event rules.
-- The events reach the rules as the frame's events (signal.frame.events), each with its event_type; the default
-- types are the codes of the GPS database's event rules. An event repeated while the case is open raises the
-- level by the time since the case opened (open_s), as the GPS database raises it by the time between the
-- episode's first and last event. Same seed shape as V0.12.6, under the '_platform' tenant.

WITH seed (symptom_key, name, family, icon, description, source_key, spec) AS (VALUES
    ('driver-fatigue-sensor', 'Fatiga y somnolencia (sensor)', 'workday_fatigue', NULL, 'En viaje, el sensor de fatiga reporta somnolencia; sube de nivel si se repite',
     'gps_signal',
     '{"source":"gps_signal","activation":"signal.trip.active && signal.frame.events.exists(e, e.event_type == \"FYSS\")","levels":[{"icu":1,"applies":true,"when":"open_s < 300","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":2,"applies":true,"when":"open_s >= 300 && open_s < 900","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":3,"applies":true,"when":"open_s >= 900 && open_s < 1800","response":{"operator":true,"slaMinutes":15,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":4,"applies":true,"when":"open_s >= 1800","response":{"operator":true,"slaMinutes":10,"steps":[],"notices":[],"evidence":[],"ignorable":false}}],"lifecycle":{"open":"case.condition_s >= 0","close":"case.closed_by_operator || !signal.trip.active"},"family":"workday_fatigue","state":"OFF"}'),
    ('driver-fatigue', 'Fatiga y somnolencia', 'workday_fatigue', NULL, 'En viaje, la cámara reporta fatiga; sube por la gravedad del evento o si se repite',
     'gps_signal',
     '{"source":"gps_signal","activation":"signal.trip.active && signal.frame.events.exists(e, e.event_type == \"FYS\")","measure":{"expression":"signal.frame.events.exists(e, e.event_type == \"FYS\" && e.severity == \"high\") ? 2.0 : signal.frame.events.exists(e, e.event_type == \"FYS\" && e.severity == \"medium\") ? 1.0 : 0.0","label":"Gravedad del evento (0 baja, 1 media, 2 alta)","unit":"nivel"},"levels":[{"icu":1,"applies":true,"when":"measure < 1.0 && open_s < 300","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":2,"applies":true,"when":"measure < 2.0 && open_s < 600 && (measure >= 1.0 || open_s >= 300)","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":3,"applies":true,"when":"measure < 2.0 && open_s >= 600 && open_s < 900","response":{"operator":true,"slaMinutes":15,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":4,"applies":true,"when":"measure >= 2.0 || open_s >= 900","response":{"operator":true,"slaMinutes":10,"steps":[],"notices":[],"evidence":[],"ignorable":false}}],"lifecycle":{"open":"case.condition_s >= 0","close":"case.closed_by_operator || !signal.trip.active"},"family":"workday_fatigue","state":"OFF"}'),
    ('load-securing-absence', 'Ausencia de amarre y sujeción', 'cargo', NULL, 'El conductor reporta la carga sin amarre ni sujeción; sube de nivel si se repite',
     'gps_signal',
     '{"source":"gps_signal","activation":"signal.frame.events.exists(e, e.event_type == \"AAS\")","levels":[{"icu":1,"applies":true,"when":"open_s <= 120","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":2,"applies":false,"when":null,"response":null},{"icu":3,"applies":true,"when":"open_s > 120 && open_s < 150","response":{"operator":true,"slaMinutes":15,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":4,"applies":true,"when":"open_s >= 150","response":{"operator":true,"slaMinutes":10,"steps":[],"notices":[],"evidence":[],"ignorable":false}}],"lifecycle":{"open":"case.condition_s >= 0","close":"case.closed_by_operator || !signal.trip.active && case.normal_s >= 1200"},"family":"cargo","state":"OFF"}'),
    ('stake-side-usage', 'Uso de barandas', 'cargo', NULL, 'El conductor reporta el uso de barandas; sube de nivel si se repite',
     'gps_signal',
     '{"source":"gps_signal","activation":"signal.frame.events.exists(e, e.event_type == \"ABR\")","levels":[{"icu":1,"applies":true,"when":"open_s <= 120","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":2,"applies":false,"when":null,"response":null},{"icu":3,"applies":true,"when":"open_s > 120 && open_s < 150","response":{"operator":true,"slaMinutes":15,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":4,"applies":true,"when":"open_s >= 150","response":{"operator":true,"slaMinutes":10,"steps":[],"notices":[],"evidence":[],"ignorable":false}}],"lifecycle":{"open":"case.condition_s >= 0","close":"case.closed_by_operator || !signal.trip.active && case.normal_s >= 1200"},"family":"cargo","state":"OFF"}'),
    ('road-assistance', 'Asistencia en ruta', 'emergencies', NULL, 'El conductor pide asistencia en ruta desde la aplicación',
     'gps_signal',
     '{"source":"gps_signal","activation":"signal.frame.events.exists(e, e.event_type == \"Asistencia en ruta\")","levels":[{"icu":1,"applies":false,"when":null,"response":null},{"icu":2,"applies":false,"when":null,"response":null},{"icu":3,"applies":true,"when":"true","response":{"operator":true,"slaMinutes":15,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":4,"applies":false,"when":null,"response":null}],"lifecycle":{"open":"case.condition_s >= 0","close":"case.closed_by_operator"},"family":"emergencies","state":"OFF"}')
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

-- The panic-button template 1.1.0 also opens on the driver app's emergency event (event_type "Emergencia").
-- Symptoms copied from 1.0.0 keep their rules.

WITH upgrade (symptom_key, version, spec, bump, reason, description) AS (VALUES
    ('panic-button', '1.1.0',
     '{"source":"gps_signal","activation":"signal.frame.?sensors.?panic_button == TRUE || signal.frame.events.exists(e, e.event_type == \"Emergencia\")","levels":[{"icu":1,"applies":false,"when":null,"response":null},{"icu":2,"applies":false,"when":null,"response":null},{"icu":3,"applies":false,"when":null,"response":null},{"icu":4,"applies":true,"when":"true","response":{"operator":true,"slaMinutes":2,"steps":[],"notices":[],"evidence":[],"ignorable":false}}],"lifecycle":{"open":"case.condition_s >= 0","close":"case.closed_by_operator"},"family":"emergencies","state":"OFF"}',
     'MINOR', 'También abre con la emergencia de la aplicación del conductor', 'El conductor presiona el botón de pánico del GPS o la emergencia de la aplicación')
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

