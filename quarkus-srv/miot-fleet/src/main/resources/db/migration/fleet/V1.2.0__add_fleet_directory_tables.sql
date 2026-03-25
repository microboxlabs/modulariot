-- Fleet MER directory tables: trucks, trailers, carriers

CREATE TABLE miot_fleet.rd_trucks (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       BIGINT        NOT NULL REFERENCES miot_core.tenants(id),
    client_id       VARCHAR(128)  NOT NULL,
    entity_id       UUID          NOT NULL DEFAULT gen_random_uuid(),
    external_id     VARCHAR(255)  NOT NULL,
    license_plate   VARCHAR(20)   NOT NULL,
    vin             VARCHAR(17),
    brand           VARCHAR(100),
    model           VARCHAR(100),
    year            INTEGER,
    max_weight      NUMERIC(10,2),
    volume          NUMERIC(10,2),
    truck_type      VARCHAR(50),
    status          VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE',
    alfresco_node_id VARCHAR(100),
    active          BOOLEAN       NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_trucks_entity_id ON miot_fleet.rd_trucks(entity_id);
CREATE UNIQUE INDEX idx_trucks_client_external ON miot_fleet.rd_trucks(client_id, external_id);
CREATE INDEX idx_trucks_tenant ON miot_fleet.rd_trucks(tenant_id);
CREATE INDEX idx_trucks_client ON miot_fleet.rd_trucks(client_id);

CREATE TABLE miot_fleet.rd_trailers (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       BIGINT        NOT NULL REFERENCES miot_core.tenants(id),
    client_id       VARCHAR(128)  NOT NULL,
    entity_id       UUID          NOT NULL DEFAULT gen_random_uuid(),
    external_id     VARCHAR(255)  NOT NULL,
    license_plate   VARCHAR(20)   NOT NULL,
    trailer_type    VARCHAR(50),
    max_weight      NUMERIC(10,2),
    axle_count      INTEGER,
    status          VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE',
    alfresco_node_id VARCHAR(100),
    active          BOOLEAN       NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_trailers_entity_id ON miot_fleet.rd_trailers(entity_id);
CREATE UNIQUE INDEX idx_trailers_client_external ON miot_fleet.rd_trailers(client_id, external_id);
CREATE INDEX idx_trailers_tenant ON miot_fleet.rd_trailers(tenant_id);

CREATE TABLE miot_fleet.rd_carriers (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       BIGINT        NOT NULL REFERENCES miot_core.tenants(id),
    client_id       VARCHAR(128)  NOT NULL,
    entity_id       UUID          NOT NULL DEFAULT gen_random_uuid(),
    external_id     VARCHAR(255)  NOT NULL,
    name            VARCHAR(255)  NOT NULL,
    rut             VARCHAR(20),
    transport_license VARCHAR(50),
    transport_license_expires TIMESTAMPTZ,
    status          VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE',
    alfresco_node_id VARCHAR(100),
    active          BOOLEAN       NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_carriers_entity_id ON miot_fleet.rd_carriers(entity_id);
CREATE UNIQUE INDEX idx_carriers_client_external ON miot_fleet.rd_carriers(client_id, external_id);
CREATE INDEX idx_carriers_tenant ON miot_fleet.rd_carriers(tenant_id);
