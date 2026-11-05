-- The platform's lost-signal template 2.2.0: a case that never left level 1 closes when the signal returns.
-- case.level is the highest level the case reached; the return check (check.loss.returned) stops the
-- activation, so case.normal_s >= 0 on it. A case that reached level 2 or more stays open for the operator.
-- The rest of the spec is 2.1.0 as V0.12.7 publishes it.

INSERT INTO miot_symptoms.symptom_version
    (definition_id, tenant_code, version, status, spec, bump, reason, created_by, published_by, published_at)
SELECT d.id, '_platform', '2.2.0', 'PUBLISHED',
       '{"source":"trip_check","activation":"check.trip.active && check.loss.ratio >= 1 && !check.loss.returned","measure":{"expression":"check.loss.silence_s / 60.0","label":"Minutos sin señal","unit":"min"},"levels":[{"icu":1,"applies":true,"when":"check.loss.silence_s < 1800 || check.loss.cohort_outage || check.loss.low_coverage_zone","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":2,"applies":true,"when":"check.loss.silence_s >= 1800 && measure < 120 && !(check.loss.cohort_outage || check.loss.low_coverage_zone)","response":{"operator":true,"slaMinutes":15,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":3,"applies":true,"when":"measure >= 120 && measure < 180 && !(check.loss.cohort_outage || check.loss.low_coverage_zone)","response":{"operator":true,"slaMinutes":15,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":4,"applies":true,"when":"measure >= 180","response":{"operator":true,"slaMinutes":10,"steps":[],"notices":[],"evidence":[],"ignorable":false}}],"lifecycle":{"open":"case.condition_s >= 0","close":"case.closed_by_operator || (case.level <= 1 && case.normal_s >= 0)"},"family":"signal_continuity","state":"OFF"}'::jsonb,
       'MINOR', 'Un caso que nunca salió del nivel 1 se cierra al volver la señal', 'platform-seed', 'platform-seed', now()
FROM miot_symptoms.symptom_definition d
WHERE d.tenant_code = '_platform' AND d.symptom_key = 'signal-loss'
ON CONFLICT DO NOTHING;

UPDATE miot_symptoms.symptom_definition
SET current_version = '2.2.0',
    description = 'En viaje y sin señal más tiempo del esperado para el vehículo y su emisor',
    updated_by = 'platform-seed', updated_at = now()
WHERE tenant_code = '_platform' AND symptom_key = 'signal-loss';
