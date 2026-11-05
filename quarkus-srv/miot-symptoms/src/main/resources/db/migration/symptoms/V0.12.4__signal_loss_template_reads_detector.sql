-- The platform's lost-signal template reads the lost-signal detector's check (check.loss.*, docs/lost-signal.md).
-- It opens when the vehicle has been silent longer than expected for it and its sender, rises when the silence
-- reaches L (check.loss.silence_s >= 1800, the time after which the loss is validated), at 120 and at 180 min,
-- and only an operator closes it, as panic: a returning signal is reported to the case, it does not close it.
-- Version 2.0.0 of the template; symptoms copied from 1.0.0 keep their rules.

INSERT INTO miot_symptoms.symptom_version
    (definition_id, tenant_code, version, status, spec, bump, reason, created_by, published_by, published_at)
SELECT d.id, 'platform', '2.0.0', 'PUBLISHED',
       '{"source":"trip_check","activation":"check.trip.active && check.loss.ratio >= 1 && !check.loss.returned","measure":{"expression":"check.loss.silence_s / 60.0","label":"Minutos sin señal","unit":"min"},"levels":[{"icu":1,"applies":true,"when":"check.loss.silence_s < 1800","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":2,"applies":true,"when":"check.loss.silence_s >= 1800 && measure < 120","response":{"operator":true,"slaMinutes":15,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":3,"applies":true,"when":"measure >= 120 && measure < 180","response":{"operator":true,"slaMinutes":15,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":4,"applies":true,"when":"measure >= 180","response":{"operator":true,"slaMinutes":10,"steps":[],"notices":[],"evidence":[],"ignorable":false}}],"lifecycle":{"open":"case.condition_s >= 0","close":"case.closed_by_operator"},"family":"signal_continuity","state":"OFF"}'::jsonb,
       'MAJOR', 'Lee el detector de pérdida de señal y la cierra el operador', 'platform-seed', 'platform-seed', now()
FROM miot_symptoms.symptom_definition d
WHERE d.tenant_code = 'platform' AND d.symptom_key = 'signal-loss'
ON CONFLICT DO NOTHING;

UPDATE miot_symptoms.symptom_definition
SET current_version = '2.0.0',
    description = 'En viaje y sin señal más tiempo del esperado para el vehículo y su emisor',
    updated_by = 'platform-seed', updated_at = now()
WHERE tenant_code = 'platform' AND symptom_key = 'signal-loss';
