-- Platform template "Desactivación o sabotaje de GPS": on a trip, the device reports its external power
-- disconnected or GNSS/GSM jamming (signal.derived.power_disconnected, signal.derived.jamming, from the frame's
-- events). Level 4 at once and only an operator closes it, as panic. Same seed shape as V0.9.3.

WITH seed (symptom_key, name, family, icon, description, source_key, spec) AS (VALUES
    ('gps-sabotage', 'Desactivación o sabotaje de GPS', 'emergencies', NULL, 'En viaje, el GPS reporta su alimentación desconectada o inhibición de señal',
     'gps_signal',
     '{"source":"gps_signal","activation":"signal.trip.active && (signal.?derived.?power_disconnected == TRUE || signal.?derived.?jamming == TRUE)","levels":[{"icu":1,"applies":false,"when":null,"response":null},{"icu":2,"applies":false,"when":null,"response":null},{"icu":3,"applies":false,"when":null,"response":null},{"icu":4,"applies":true,"when":"true","response":{"operator":true,"slaMinutes":2,"steps":[],"notices":[],"evidence":[],"ignorable":false}}],"lifecycle":{"open":"case.condition_s >= 0","close":"case.closed_by_operator"},"family":"emergencies","state":"OFF"}')
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
SELECT d.id, 'platform', '1.0.0', 'PUBLISHED', s.spec::jsonb, 'MAJOR', 'Plantilla inicial de la plataforma',
       'platform-seed', 'platform-seed', now()
FROM definitions d JOIN seed s ON s.symptom_key = d.symptom_key;
