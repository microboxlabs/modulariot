-- Driver schema: driver entities
CREATE SCHEMA IF NOT EXISTS miot_driver;

CREATE TABLE miot_driver.rd_drivers (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       BIGINT        NOT NULL REFERENCES miot_core.tenants(id),
    client_id       VARCHAR(128)  NOT NULL,
    entity_id       UUID          NOT NULL DEFAULT gen_random_uuid(),
    external_id     VARCHAR(255)  NOT NULL,
    first_name      VARCHAR(100)  NOT NULL,
    last_name       VARCHAR(100)  NOT NULL,
    rut             VARCHAR(20),
    phone           VARCHAR(30),
    mobile_phone    VARCHAR(30),
    email           VARCHAR(255),
    license_number  VARCHAR(50),
    license_category VARCHAR(10),
    license_expires TIMESTAMPTZ,
    carrier_id      BIGINT,
    is_occasional   BOOLEAN       NOT NULL DEFAULT false,
    operation_blocked BOOLEAN     NOT NULL DEFAULT false,
    status          VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE',
    alfresco_node_id VARCHAR(100),
    active          BOOLEAN       NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_drivers_entity_id ON miot_driver.rd_drivers(entity_id);
CREATE UNIQUE INDEX idx_drivers_client_external ON miot_driver.rd_drivers(client_id, external_id);
CREATE INDEX idx_drivers_tenant ON miot_driver.rd_drivers(tenant_id);
CREATE INDEX idx_drivers_client ON miot_driver.rd_drivers(client_id);
CREATE INDEX idx_drivers_carrier ON miot_driver.rd_drivers(carrier_id);
CREATE INDEX idx_drivers_rut ON miot_driver.rd_drivers(client_id, rut);
