-- ============================================================
-- Propósito:  V0.9.9 — Directorio de recursos operacionales + acreditación
--             (carrier, truck, trailer, driver, resource_attribute).
--             Estructura heredada de ams.rd_* (mismos ids al migrar datos).
--             Versionado SCD2 en la misma tabla (decisión 2026-10-23):
--             la vigente conserva su id; cada UPDATE archiva la versión
--             anterior (version_of = id de la entidad). Borrado lógico.
-- Autor:      Steve (ModularSQL) para Erick Hernández
-- Fecha:      2026-10-23
-- BD/Esquema: miot / miot_fleet
-- Status:     draft
-- ============================================================

CREATE OR REPLACE FUNCTION miot_fleet.set_resource_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END $$;

CREATE TABLE miot_fleet.carrier (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_code     VARCHAR(128) NOT NULL,
    external_id     VARCHAR(128),
    rut             VARCHAR(32),
    legal_name      VARCHAR(255) NOT NULL,
    transport_license          VARCHAR(64),
    transport_license_expires  TIMESTAMPTZ,
    contact_name    VARCHAR(255),
    phone           VARCHAR(64),
    email           VARCHAR(255),
    status          VARCHAR(32) NOT NULL DEFAULT 'active',
    is_occasional   BOOLEAN NOT NULL DEFAULT FALSE,
    source_system   VARCHAR(64),
    source_data     JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      VARCHAR(255),
    UNIQUE (id, tenant_code)
);
CREATE INDEX idx_fleet_carrier_tenant_rut ON miot_fleet.carrier (tenant_code, rut);

CREATE TABLE miot_fleet.truck (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_code     VARCHAR(128) NOT NULL,
    carrier_id      UUID NOT NULL,
    external_id     VARCHAR(128),
    license_plate   VARCHAR(16) NOT NULL,
    vin             VARCHAR(32),
    truck_type      VARCHAR(64),
    max_weight      NUMERIC,
    volume          NUMERIC,
    status          VARCHAR(32) NOT NULL DEFAULT 'active',
    is_occasional   BOOLEAN NOT NULL DEFAULT FALSE,
    source_system   VARCHAR(64),
    source_data     JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      VARCHAR(255),
    UNIQUE (id, tenant_code),
    FOREIGN KEY (carrier_id, tenant_code) REFERENCES miot_fleet.carrier (id, tenant_code)
);
CREATE INDEX idx_fleet_truck_tenant_plate ON miot_fleet.truck (tenant_code, license_plate);
CREATE INDEX idx_fleet_truck_carrier ON miot_fleet.truck (carrier_id);

CREATE TABLE miot_fleet.trailer (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_code     VARCHAR(128) NOT NULL,
    carrier_id      UUID NOT NULL,
    external_id     VARCHAR(128),
    license_plate   VARCHAR(16) NOT NULL,
    vin             VARCHAR(32),
    trailer_type    VARCHAR(64),
    max_weight      NUMERIC,
    status          VARCHAR(32) NOT NULL DEFAULT 'active',
    is_occasional   BOOLEAN NOT NULL DEFAULT FALSE,
    source_system   VARCHAR(64),
    source_data     JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      VARCHAR(255),
    UNIQUE (id, tenant_code),
    FOREIGN KEY (carrier_id, tenant_code) REFERENCES miot_fleet.carrier (id, tenant_code)
);
CREATE INDEX idx_fleet_trailer_tenant_plate ON miot_fleet.trailer (tenant_code, license_plate);

CREATE TABLE miot_fleet.driver (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_code     VARCHAR(128) NOT NULL,
    carrier_id      UUID,
    external_id     VARCHAR(128),
    rut             VARCHAR(32) NOT NULL,
    first_name      VARCHAR(128),
    last_name       VARCHAR(128),
    full_name       VARCHAR(255),
    phone           VARCHAR(64),
    mobile_phone    VARCHAR(64),
    license_category VARCHAR(16),
    license_expires TIMESTAMPTZ,
    status          VARCHAR(32) NOT NULL DEFAULT 'active',
    is_occasional   BOOLEAN NOT NULL DEFAULT FALSE,
    source_system   VARCHAR(64),
    source_data     JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      VARCHAR(255),
    UNIQUE (id, tenant_code),
    FOREIGN KEY (carrier_id, tenant_code) REFERENCES miot_fleet.carrier (id, tenant_code)
);
CREATE INDEX idx_fleet_driver_tenant_rut ON miot_fleet.driver (tenant_code, rut);

-- ============================================================
-- ACREDITACIÓN (estructura heredada de ams.rd_resource_attributes)
-- Un atributo por (recurso, tipo, clave): SITE_ACCREDITATION/MEL,
-- CERTIFICATION/ADR, INSURANCE/RC, LICENSE/A4... con vigencia y origen.
-- ============================================================
CREATE TABLE miot_fleet.resource_attribute (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_code     VARCHAR(128) NOT NULL,
    resource_type   VARCHAR(16) NOT NULL CHECK (resource_type IN ('carrier','truck','trailer','driver')),
    resource_id     UUID NOT NULL,
    attribute_type  VARCHAR(64) NOT NULL,      -- SITE_ACCREDITATION, CERTIFICATION, INSURANCE, LICENSE...
    attribute_key   VARCHAR(64) NOT NULL,      -- MEL, ADR, RC, ITV...
    attribute_value VARCHAR(64),               -- ACCREDITED, REVOKED, VALID, EXPIRED...
    context         JSONB,
    valid_from      TIMESTAMPTZ,
    valid_until     TIMESTAMPTZ,               -- NULL = indefinido
    source_system   VARCHAR(64),
    source_data     JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      VARCHAR(255),
    UNIQUE (id, tenant_code)
);
CREATE INDEX idx_fleet_resattr_resource ON miot_fleet.resource_attribute (tenant_code, resource_type, resource_id);
CREATE INDEX idx_fleet_resattr_type_key ON miot_fleet.resource_attribute (tenant_code, attribute_type, attribute_key);
CREATE INDEX idx_fleet_resattr_expiry   ON miot_fleet.resource_attribute (valid_until) WHERE valid_until IS NOT NULL;

-- ============================================================
-- VERSIONADO (SCD2 en la misma tabla, igual que miot_trips)
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['carrier','truck','trailer','driver','resource_attribute']
    LOOP
        EXECUTE format('ALTER TABLE miot_fleet.%I
                        ADD COLUMN version_of   UUID,
                        ADD COLUMN is_active    BOOLEAN NOT NULL DEFAULT TRUE,
                        ADD COLUMN version_from TIMESTAMPTZ NOT NULL DEFAULT now(),
                        ADD COLUMN version_to   TIMESTAMPTZ', t);
        EXECUTE format('CREATE INDEX idx_fleet_%s_versions ON miot_fleet.%I (version_of) WHERE version_of IS NOT NULL',
                       t, t);
        EXECUTE format('CREATE TRIGGER trg_fleet_%s_updated BEFORE UPDATE ON miot_fleet.%I
                        FOR EACH ROW EXECUTE FUNCTION miot_fleet.set_resource_updated_at()', t, t);
    END LOOP;
END $$;

-- la clave natural de un atributo rige solo para la versión vigente (el upsert del feed apunta aquí)
CREATE UNIQUE INDEX uq_fleet_resattr_current ON miot_fleet.resource_attribute
    (tenant_code, resource_type, resource_id, attribute_type, attribute_key)
    WHERE version_of IS NULL AND is_active;
CREATE UNIQUE INDEX uq_fleet_carrier_rut_current ON miot_fleet.carrier (tenant_code, rut)
    WHERE version_of IS NULL AND is_active;
CREATE UNIQUE INDEX uq_fleet_truck_plate_current ON miot_fleet.truck (tenant_code, license_plate)
    WHERE version_of IS NULL AND is_active;
CREATE UNIQUE INDEX uq_fleet_trailer_plate_current ON miot_fleet.trailer (tenant_code, license_plate)
    WHERE version_of IS NULL AND is_active;
CREATE UNIQUE INDEX uq_fleet_driver_rut_current ON miot_fleet.driver (tenant_code, rut)
    WHERE version_of IS NULL AND is_active;

CREATE OR REPLACE FUNCTION miot_fleet.fn_version_on_update() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v JSONB;
BEGIN
    IF OLD.version_of IS NOT NULL THEN
        RAISE EXCEPTION 'version rows are read-only (%.%)', TG_TABLE_NAME, OLD.id;
    END IF;
    -- an update that changes no data (a feed re-sending the same row) keeps the row and archives nothing
    IF to_jsonb(NEW) - ARRAY['updated_at','updated_by','version_from','version_to']
       = to_jsonb(OLD) - ARRAY['updated_at','updated_by','version_from','version_to'] THEN
        RETURN OLD;
    END IF;
    v := to_jsonb(OLD) || jsonb_build_object(
            'id', gen_random_uuid(),
            'version_of', OLD.id,
            'is_active', false,
            'version_to', now());
    EXECUTE format('INSERT INTO %I.%I SELECT (jsonb_populate_record(NULL::%I.%I, $1)).*',
                   TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_TABLE_SCHEMA, TG_TABLE_NAME) USING v;
    NEW.version_from := now();
    IF NEW.is_active = FALSE AND OLD.is_active = TRUE THEN
        NEW.version_to := now();
    END IF;
    RETURN NEW;
END $$;

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['carrier','truck','trailer','driver','resource_attribute']
    LOOP
        EXECUTE format('CREATE TRIGGER trg_fleet_%s_zversion BEFORE UPDATE ON miot_fleet.%I
                        FOR EACH ROW EXECUTE FUNCTION miot_fleet.fn_version_on_update()', t, t);
    END LOOP;
END $$;
