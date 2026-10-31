-- What company_rut holds: a Chilean RUT, a Peruvian RUC or another tax id. Existing values are RUTs.

ALTER TABLE miot_symptoms.contact ADD COLUMN company_tax_id_type VARCHAR(16);
UPDATE miot_symptoms.contact SET company_tax_id_type = 'RUT' WHERE company_rut IS NOT NULL;
