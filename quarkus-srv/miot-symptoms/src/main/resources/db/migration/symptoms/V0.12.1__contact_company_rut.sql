-- The RUT of the company a contact works for, normalised like national_id (no dots or dashes, upper case).
-- Communication rules match it against the carrier of a trip.

ALTER TABLE miot_symptoms.contact ADD COLUMN company_rut VARCHAR(32);
