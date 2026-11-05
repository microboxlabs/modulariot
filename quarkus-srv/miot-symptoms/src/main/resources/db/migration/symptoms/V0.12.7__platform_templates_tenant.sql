-- V0.12.4, V0.12.5 and V0.12.6 wrote the platform's templates under tenant 'platform', which V0.12.0 had already
-- renamed to '_platform'. So the lost-signal template stayed at 1.0.0 and "Desactivación o sabotaje de GPS" was
-- seeded where no organization reads it. This moves what they left under 'platform' and publishes the
-- lost-signal versions 2.0.0 and 2.1.0, with the same rules as those migrations.

ALTER TABLE miot_symptoms.symptom_version DROP CONSTRAINT fk_symptom_version_definition;

UPDATE miot_symptoms.symptom_definition SET tenant_code = '_platform'
WHERE tenant_code = 'platform'
  AND symptom_key NOT IN (SELECT symptom_key FROM miot_symptoms.symptom_definition WHERE tenant_code = '_platform');
UPDATE miot_symptoms.symptom_version v SET tenant_code = '_platform'
FROM miot_symptoms.symptom_definition d
WHERE v.tenant_code = 'platform' AND d.id = v.definition_id AND d.tenant_code = '_platform';
UPDATE miot_symptoms.audit_event SET tenant_code = '_platform' WHERE tenant_code = 'platform';

ALTER TABLE miot_symptoms.symptom_version
    ADD CONSTRAINT fk_symptom_version_definition FOREIGN KEY (definition_id, tenant_code)
        REFERENCES miot_symptoms.symptom_definition (id, tenant_code) ON DELETE CASCADE;

INSERT INTO miot_symptoms.symptom_version
    (definition_id, tenant_code, version, status, spec, bump, reason, created_by, published_by, published_at)
SELECT d.id, '_platform', v.version, 'PUBLISHED', v.spec::jsonb, v.bump, v.reason, 'platform-seed', 'platform-seed', now()
FROM miot_symptoms.symptom_definition d
CROSS JOIN (VALUES
    ('2.0.0',
     '{"source":"trip_check","activation":"check.trip.active && check.loss.ratio >= 1 && !check.loss.returned","measure":{"expression":"check.loss.silence_s / 60.0","label":"Minutos sin señal","unit":"min"},"levels":[{"icu":1,"applies":true,"when":"check.loss.silence_s < 1800","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":2,"applies":true,"when":"check.loss.silence_s >= 1800 && measure < 120","response":{"operator":true,"slaMinutes":15,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":3,"applies":true,"when":"measure >= 120 && measure < 180","response":{"operator":true,"slaMinutes":15,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":4,"applies":true,"when":"measure >= 180","response":{"operator":true,"slaMinutes":10,"steps":[],"notices":[],"evidence":[],"ignorable":false}}],"lifecycle":{"open":"case.condition_s >= 0","close":"case.closed_by_operator"},"family":"signal_continuity","state":"OFF"}',
     'MAJOR', 'Lee el detector de pérdida de señal y la cierra el operador'),
    ('2.1.0',
     '{"source":"trip_check","activation":"check.trip.active && check.loss.ratio >= 1 && !check.loss.returned","measure":{"expression":"check.loss.silence_s / 60.0","label":"Minutos sin señal","unit":"min"},"levels":[{"icu":1,"applies":true,"when":"check.loss.silence_s < 1800 || check.loss.cohort_outage || check.loss.low_coverage_zone","response":{"operator":false,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":2,"applies":true,"when":"check.loss.silence_s >= 1800 && measure < 120 && !(check.loss.cohort_outage || check.loss.low_coverage_zone)","response":{"operator":true,"slaMinutes":15,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":3,"applies":true,"when":"measure >= 120 && measure < 180 && !(check.loss.cohort_outage || check.loss.low_coverage_zone)","response":{"operator":true,"slaMinutes":15,"steps":[],"notices":[],"evidence":[],"ignorable":true}},{"icu":4,"applies":true,"when":"measure >= 180","response":{"operator":true,"slaMinutes":10,"steps":[],"notices":[],"evidence":[],"ignorable":false}}],"lifecycle":{"open":"case.condition_s >= 0","close":"case.closed_by_operator"},"family":"signal_continuity","state":"OFF"}',
     'MINOR', 'Pérdida en grupo y zona de baja cobertura no escalan')
) AS v (version, spec, bump, reason)
WHERE d.tenant_code = '_platform' AND d.symptom_key = 'signal-loss'
ON CONFLICT DO NOTHING;

UPDATE miot_symptoms.symptom_definition
SET current_version = '2.1.0',
    description = 'En viaje y sin señal más tiempo del esperado para el vehículo y su emisor',
    updated_by = 'platform-seed', updated_at = now()
WHERE tenant_code = '_platform' AND symptom_key = 'signal-loss';
