-- Add missing columns for address, deactivation tracking, and source system
-- Add status CHECK constraint matching the directory lifecycle model

ALTER TABLE miot_driver.rd_drivers
    ADD COLUMN address_street      VARCHAR(255),
    ADD COLUMN address_city        VARCHAR(100),
    ADD COLUMN address_postal_code VARCHAR(20),
    ADD COLUMN address_country     VARCHAR(10),
    ADD COLUMN deactivated_at      TIMESTAMPTZ,
    ADD COLUMN source_system       VARCHAR(50);

ALTER TABLE miot_driver.rd_drivers
    ADD CONSTRAINT ck_rd_drivers_status
    CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING'));
