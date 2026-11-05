-- How far each tenant's contact book is synced from a source, such as the fleet's drivers (fleet-driver).
-- synced_until is when the last complete run started.

CREATE TABLE miot_symptoms.contact_sync (
    tenant_code  VARCHAR(128) NOT NULL,
    source       VARCHAR(32)  NOT NULL,
    synced_until TIMESTAMPTZ  NOT NULL,
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT pk_contact_sync PRIMARY KEY (tenant_code, source)
);
