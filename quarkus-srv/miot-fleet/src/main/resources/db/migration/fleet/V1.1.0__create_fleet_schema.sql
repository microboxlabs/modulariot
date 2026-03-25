-- Fleet schema: vehicles and trips
CREATE SCHEMA IF NOT EXISTS miot_fleet;

CREATE TABLE miot_fleet.vehicles (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   BIGINT       NOT NULL REFERENCES miot_core.tenants(id),
    plate       VARCHAR(20)  NOT NULL,
    vin         VARCHAR(17),
    brand       VARCHAR(100),
    model       VARCHAR(100),
    year        INTEGER,
    active      BOOLEAN      NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_vehicles_tenant ON miot_fleet.vehicles(tenant_id);
CREATE UNIQUE INDEX idx_vehicles_tenant_plate ON miot_fleet.vehicles(tenant_id, plate);

CREATE TABLE miot_fleet.trips (
    id          BIGSERIAL PRIMARY KEY,
    vehicle_id  BIGINT       NOT NULL REFERENCES miot_fleet.vehicles(id),
    start_time  TIMESTAMPTZ  NOT NULL,
    end_time    TIMESTAMPTZ,
    start_lat   DOUBLE PRECISION,
    start_lon   DOUBLE PRECISION,
    end_lat     DOUBLE PRECISION,
    end_lon     DOUBLE PRECISION,
    distance_km DOUBLE PRECISION,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_trips_vehicle ON miot_fleet.trips(vehicle_id);
CREATE INDEX idx_trips_start_time ON miot_fleet.trips(start_time);
