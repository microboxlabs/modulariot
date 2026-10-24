-- The platform's symptom templates move from tenant 'platform' to '_platform', the tenant of the platform scope.
-- A version references its definition by (id, tenant_code), so the foreign key is dropped while both change.

ALTER TABLE miot_symptoms.symptom_version DROP CONSTRAINT fk_symptom_version_definition;

UPDATE miot_symptoms.symptom_definition SET tenant_code = '_platform' WHERE tenant_code = 'platform';
UPDATE miot_symptoms.symptom_version SET tenant_code = '_platform' WHERE tenant_code = 'platform';
UPDATE miot_symptoms.audit_event SET tenant_code = '_platform' WHERE tenant_code = 'platform';

ALTER TABLE miot_symptoms.symptom_version
    ADD CONSTRAINT fk_symptom_version_definition FOREIGN KEY (definition_id, tenant_code)
        REFERENCES miot_symptoms.symptom_definition (id, tenant_code) ON DELETE CASCADE;
