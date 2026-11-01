-- The platform's lost-signal template 2.1.0: while many of the sender's vehicles are lost at once
-- (check.loss.cohort_outage) or the last position is in a low-coverage cell of the shadow map
-- (check.loss.low_coverage_zone), the case stays at level 1 until 180 min, when it reaches level 4 anyway.

INSERT INTO miot_symptoms.symptom_version
    (definition_id, tenant_code, version, status, spec, bump, reason, created_by, published_by, published_at)
SELECT d.id, 'platform', '2.1.0', 'PUBLISHED',
       '{"source":"trip_check","activation":"check.trip.active && check.loss.ratio >= 1 && !check.loss.returned","measure":{"expression":"check.loss.silence_s / 60.0","label":"Minutos sin señal","unit":"min"},"levels":[{"icu":1,"applies":true,"when":"check.loss.silence_s < 1800 || check.loss.cohort_outage || check.loss.low_coverage_zone","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":2,"applies":true,"when":"check.loss.silence_s >= 1800 && measure < 120 && !(check.loss.cohort_outage || check.loss.low_coverage_zone)","response":{"operator":true,"slaMinutes":15,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":3,"applies":true,"when":"measure >= 120 && measure < 180 && !(check.loss.cohort_outage || check.loss.low_coverage_zone)","response":{"operator":true,"slaMinutes":15,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":4,"applies":true,"when":"measure >= 180","response":{"operator":true,"slaMinutes":10,"steps":[],"notices":[],"evidence":[],"ignorable":false}}],"lifecycle":{"open":"case.condition_s >= 0","close":"case.closed_by_operator"},"family":"signal_continuity","state":"OFF"}'::jsonb,
       'MINOR', 'Pérdida en grupo y zona de baja cobertura no escalan', 'platform-seed', 'platform-seed', now()
FROM miot_symptoms.symptom_definition d
WHERE d.tenant_code = 'platform' AND d.symptom_key = 'signal-loss'
ON CONFLICT DO NOTHING;

UPDATE miot_symptoms.symptom_definition
SET current_version = '2.1.0',
    description = 'En viaje y sin señal más tiempo del esperado para el vehículo y su emisor',
    updated_by = 'platform-seed', updated_at = now()
WHERE tenant_code = 'platform' AND symptom_key = 'signal-loss';
