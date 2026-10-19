-- Contact book fields for the Control Tower contacts. Additive only.
-- national_id is stored normalised (no dots or dashes, upper case), so the
-- unique index compares the same person however the id was typed.

ALTER TABLE miot_symptoms.contact
    ADD COLUMN national_id      VARCHAR(32),
    ADD COLUMN national_id_type VARCHAR(16) NOT NULL DEFAULT 'RUT',
    ADD COLUMN company          TEXT,
    ADD COLUMN position         TEXT,
    ADD COLUMN channels         JSONB       NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN tags             JSONB       NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN member_user_id   VARCHAR(255),
    ADD COLUMN provisional      BOOLEAN     NOT NULL DEFAULT false;

CREATE UNIQUE INDEX uq_contact_national_id
    ON miot_symptoms.contact (tenant_code, national_id)
    WHERE national_id IS NOT NULL;
