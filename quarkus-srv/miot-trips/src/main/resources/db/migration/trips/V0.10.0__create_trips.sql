-- ============================================================
-- Propósito:  Migración V0.10.0 — schema miot_trips (modelo v1)
--             16 tablas + triggers (línea única, consistencia
--             trip_cargo, proyección trip_live, set_updated_at)
-- Autor:      Steve (ModularSQL) para Erick Hernández
-- Fecha:      2026-10-23
-- BD/Esquema: miot / miot_trips  (pruebas: miot_trips_dev local)
-- Entorno:    miot_trips_local (pruebas) → db/migration/trips (modulith)
-- Status:     draft
-- ============================================================

CREATE SCHEMA IF NOT EXISTS miot_trips;

-- ---------- utilitario de auditoría ----------
CREATE OR REPLACE FUNCTION miot_trips.set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END $$;

-- ============================================================
-- CONTEXTO
-- ============================================================
CREATE TABLE miot_trips.location (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_code     VARCHAR(128) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    type            VARCHAR(32)  NOT NULL CHECK (type IN ('planta','puerto','cd','cliente','zona')),
    external_code   VARCHAR(128),
    geom_geojson    JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      VARCHAR(255),
    UNIQUE (id, tenant_code)
);
CREATE INDEX idx_location_tenant_ext ON miot_trips.location (tenant_code, external_code);

-- ============================================================
-- RECURSOS: viven en miot_fleet (V0.9.9 del módulo fleet) — carrier,
-- truck, trailer, driver y resource_attribute (acreditación).
-- Este schema solo los REFERENCIA (validación por trigger y joins).
-- ============================================================

-- ============================================================
-- PEDIDO: mandato (cabecera) → línea única → cargas
-- ============================================================
CREATE TABLE miot_trips.mandate (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_code     VARCHAR(128) NOT NULL,
    external_code   VARCHAR(128) NOT NULL,
    order_type      VARCHAR(32)  NOT NULL DEFAULT 'service',
    order_ref       VARCHAR(255),
    status          VARCHAR(32)  NOT NULL DEFAULT 'activo'
                    CHECK (status IN ('activo','en_ejecucion','cerrado','anulado')),
    origin_id       UUID,
    destination_id  UUID,
    sla_minutes     INT,
    closed_at       TIMESTAMPTZ,
    cancel_reason   VARCHAR(500),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      VARCHAR(255),
    UNIQUE (id, tenant_code),
    -- LA restricción anti-colisión: el código es único POR MANDANTE
    UNIQUE (tenant_code, external_code),
    FOREIGN KEY (origin_id, tenant_code)      REFERENCES miot_trips.location (id, tenant_code),
    FOREIGN KEY (destination_id, tenant_code) REFERENCES miot_trips.location (id, tenant_code)
);
CREATE INDEX idx_mandate_tenant_status ON miot_trips.mandate (tenant_code, status);

CREATE TABLE miot_trips.mandate_line (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_code     VARCHAR(128) NOT NULL,
    mandate_id      UUID NOT NULL,
    seq             INT  NOT NULL DEFAULT 1,
    item_id         UUID,                      -- NULL en v1 (sin catálogo de ítems)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      VARCHAR(255),
    UNIQUE (id, tenant_code),
    UNIQUE (mandate_id, seq),
    FOREIGN KEY (mandate_id, tenant_code) REFERENCES miot_trips.mandate (id, tenant_code) ON DELETE CASCADE
);

CREATE TABLE miot_trips.cargo_unit (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_code     VARCHAR(128) NOT NULL,
    line_id         UUID NOT NULL,
    partial_no      INT NOT NULL DEFAULT 1,
    description     VARCHAR(500) NOT NULL,
    qty             NUMERIC,
    qty_unit        VARCHAR(32),
    weight_kg       NUMERIC,
    volume_m3       NUMERIC,
    status          VARCHAR(32) NOT NULL DEFAULT 'anunciada'
                    CHECK (status IN ('anunciada','lista','retirada','entregada','recibida','rechazada')),
    receipt_result  VARCHAR(16) CHECK (receipt_result IN ('conforme','diferencia')),
    receipt_notes   VARCHAR(1000),
    received_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      VARCHAR(255),
    UNIQUE (id, tenant_code),
    FOREIGN KEY (line_id, tenant_code) REFERENCES miot_trips.mandate_line (id, tenant_code)
);
CREATE INDEX idx_cargo_line   ON miot_trips.cargo_unit (line_id);
CREATE INDEX idx_cargo_status ON miot_trips.cargo_unit (tenant_code, status);

-- ============================================================
-- EJECUCIÓN: viaje, vínculos, etapas, actividades, asignaciones
-- ============================================================
CREATE TABLE miot_trips.trip (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_code     VARCHAR(128) NOT NULL,
    status          VARCHAR(32) NOT NULL DEFAULT 'planificado'
                    CHECK (status IN ('planificado','en_ruta','realizado','anulado')),
    origin_id       UUID,
    destination_id  UUID,
    planned_start   TIMESTAMPTZ,
    actual_start    TIMESTAMPTZ,
    actual_end      TIMESTAMPTZ,
    cancel_reason   VARCHAR(500),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      VARCHAR(255),
    UNIQUE (id, tenant_code),
    FOREIGN KEY (origin_id, tenant_code)      REFERENCES miot_trips.location (id, tenant_code),
    FOREIGN KEY (destination_id, tenant_code) REFERENCES miot_trips.location (id, tenant_code)
);
CREATE INDEX idx_trip_tenant_status ON miot_trips.trip (tenant_code, status);
CREATE INDEX idx_trip_actual_start  ON miot_trips.trip (tenant_code, actual_start);

CREATE TABLE miot_trips.trip_mandate (
    trip_id         UUID NOT NULL,
    mandate_id      UUID NOT NULL,
    tenant_code     VARCHAR(128) NOT NULL,
    seq             INT NOT NULL DEFAULT 1,
    role            VARCHAR(32) NOT NULL DEFAULT 'primary',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      VARCHAR(255),
    PRIMARY KEY (trip_id, mandate_id),
    FOREIGN KEY (trip_id, tenant_code)    REFERENCES miot_trips.trip (id, tenant_code)    ON DELETE CASCADE,
    FOREIGN KEY (mandate_id, tenant_code) REFERENCES miot_trips.mandate (id, tenant_code)
);
CREATE INDEX idx_trip_mandate_mandate ON miot_trips.trip_mandate (mandate_id);

CREATE TABLE miot_trips.stage (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_code     VARCHAR(128) NOT NULL,
    subject_type    VARCHAR(16) NOT NULL CHECK (subject_type IN ('trip')),  -- ampliable a 'mandate' por migración
    subject_id      UUID NOT NULL,
    seq             INT NOT NULL,
    stage_type      VARCHAR(32) NOT NULL
                    CHECK (stage_type IN ('preparacion','carga','transito','parada','descarga','cierre')),
    status          VARCHAR(16) NOT NULL DEFAULT 'pendiente'
                    CHECK (status IN ('pendiente','en_curso','cerrada')),
    -- estado de negocio que la etapa proyecta al servicio mientras corre (vocabulario del tenant;
    -- DATO, no comportamiento: el motor nunca decide con él)
    service_status  VARCHAR(64),
    location_id     UUID,
    planned_start   TIMESTAMPTZ,
    planned_end     TIMESTAMPTZ,
    actual_start    TIMESTAMPTZ,
    actual_end      TIMESTAMPTZ,
    checklist       JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      VARCHAR(255),
    UNIQUE (id, tenant_code),
    UNIQUE (subject_type, subject_id, seq),
    FOREIGN KEY (location_id, tenant_code) REFERENCES miot_trips.location (id, tenant_code)
);
-- la máquina de estados: a lo más UNA etapa en curso por sujeto
CREATE UNIQUE INDEX uq_stage_one_running
    ON miot_trips.stage (subject_type, subject_id) WHERE status = 'en_curso';
CREATE INDEX idx_stage_subject ON miot_trips.stage (subject_type, subject_id);

CREATE TABLE miot_trips.stage_activity (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_code     VARCHAR(128) NOT NULL,
    stage_id        UUID NOT NULL,
    seq             INT NOT NULL,
    activity_type   VARCHAR(64) NOT NULL,
    status          VARCHAR(16) NOT NULL DEFAULT 'pendiente'
                    CHECK (status IN ('pendiente','en_curso','hecha','no_aplica')),
    assignee        VARCHAR(255),
    assignment_id   UUID,
    evidence        JSONB,
    done_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      VARCHAR(255),
    UNIQUE (id, tenant_code),
    UNIQUE (stage_id, seq),
    FOREIGN KEY (stage_id, tenant_code) REFERENCES miot_trips.stage (id, tenant_code) ON DELETE CASCADE
);

CREATE TABLE miot_trips.trip_resource_assignment (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_code     VARCHAR(128) NOT NULL,
    trip_id         UUID NOT NULL,
    resource_type   VARCHAR(16) NOT NULL CHECK (resource_type IN ('truck','trailer','driver')),
    resource_id     UUID NOT NULL,
    valid_from      TIMESTAMPTZ NOT NULL,
    valid_to        TIMESTAMPTZ,
    reason          VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      VARCHAR(255),
    UNIQUE (id, tenant_code),
    FOREIGN KEY (trip_id, tenant_code) REFERENCES miot_trips.trip (id, tenant_code) ON DELETE CASCADE
);
CREATE INDEX idx_assignment_trip     ON miot_trips.trip_resource_assignment (trip_id);
CREATE INDEX idx_assignment_resource ON miot_trips.trip_resource_assignment (tenant_code, resource_type, resource_id);

CREATE TABLE miot_trips.trip_cargo (
    trip_id             UUID NOT NULL,
    cargo_id            UUID NOT NULL,
    tenant_code         VARCHAR(128) NOT NULL,
    loaded_at_stage     UUID,
    unloaded_at_stage   UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      VARCHAR(255) NOT NULL DEFAULT 'system',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      VARCHAR(255),
    PRIMARY KEY (trip_id, cargo_id),
    FOREIGN KEY (trip_id, tenant_code)  REFERENCES miot_trips.trip (id, tenant_code)       ON DELETE CASCADE,
    FOREIGN KEY (cargo_id, tenant_code) REFERENCES miot_trips.cargo_unit (id, tenant_code),
    FOREIGN KEY (loaded_at_stage, tenant_code)   REFERENCES miot_trips.stage (id, tenant_code),
    FOREIGN KEY (unloaded_at_stage, tenant_code) REFERENCES miot_trips.stage (id, tenant_code)
);
CREATE INDEX idx_trip_cargo_cargo ON miot_trips.trip_cargo (cargo_id);

-- ============================================================
-- PROYECCIÓN CALIENTE (misma forma que live_trip; derivada)
-- ============================================================
CREATE TABLE miot_trips.trip_live (
    trip_id                     UUID PRIMARY KEY,
    tenant_code                 VARCHAR(128) NOT NULL,
    mandate_codes               JSONB,
    asset_id                    VARCHAR(20),
    trip_type                   VARCHAR(8),
    origin_geofence_id          INT,
    destination_geofence_id     INT,
    origin_geofence_label       VARCHAR(128),
    destination_geofence_label  VARCHAR(128),
    stop_geofence_ids           INT[],
    status                      VARCHAR(64),
    driver_id                   VARCHAR(64),
    driver_name                 VARCHAR(255),
    driver_contact_phone        VARCHAR(64),
    double_driver               BOOLEAN NOT NULL DEFAULT FALSE,
    second_driver_id            VARCHAR(64),
    second_driver_name          VARCHAR(255),
    second_driver_contact_phone VARCHAR(64),
    carrier_id                  VARCHAR(64),
    carrier_name                VARCHAR(255),
    carrier_contact_phone       VARCHAR(64),
    rampla_plate                VARCHAR(16),
    start_time                  TIMESTAMPTZ,
    end_time                    TIMESTAMPTZ,
    estimated_arrival_time      TIMESTAMPTZ,
    type_load                   VARCHAR(255),
    -- estado de motor: lo escribe el MOTOR, el rebuild lo preserva
    current_geofence_id         INT,
    origin_visited              BOOLEAN NOT NULL DEFAULT FALSE,
    destination_visited         BOOLEAN NOT NULL DEFAULT FALSE,
    origin_is_internal          BOOLEAN,
    forward_id                  TEXT[],
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_trip_live_asset  ON miot_trips.trip_live (asset_id);
CREATE INDEX idx_trip_live_tenant ON miot_trips.trip_live (tenant_code);

-- ============================================================
-- AUDITORÍA DEL MÓDULO (append-only, lectura keyset)
-- ============================================================
CREATE TABLE miot_trips.audit_event (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_code VARCHAR(128) NOT NULL,
    actor       VARCHAR(255) NOT NULL,
    action      VARCHAR(128) NOT NULL,
    entity_type VARCHAR(64)  NOT NULL,
    entity_id   VARCHAR(64),
    trip_id     UUID,
    details     JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_tenant_time  ON miot_trips.audit_event (tenant_code, created_at DESC, id DESC);
CREATE INDEX idx_audit_entity       ON miot_trips.audit_event (tenant_code, entity_type, entity_id);

-- ============================================================
-- TRIGGERS DE DOMINIO
-- ============================================================

-- 1) set_updated_at en todas las tablas con updated_at
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['location','mandate','mandate_line',
                             'cargo_unit','trip','trip_mandate','stage','stage_activity',
                             'trip_resource_assignment','trip_cargo','trip_live']
    LOOP
        EXECUTE format('CREATE TRIGGER trg_%s_updated BEFORE UPDATE ON miot_trips.%I
                        FOR EACH ROW EXECUTE FUNCTION miot_trips.set_updated_at()', t, t);
    END LOOP;
END $$;

-- 2) línea única autogenerada al crear el mandato
CREATE OR REPLACE FUNCTION miot_trips.fn_mandate_autoline() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.version_of IS NOT NULL THEN  -- las copias de versión no generan línea
        RETURN NEW;
    END IF;
    INSERT INTO miot_trips.mandate_line (tenant_code, mandate_id, seq, created_by)
    VALUES (NEW.tenant_code, NEW.id, 1, NEW.created_by);
    RETURN NEW;
END $$;
CREATE TRIGGER trg_mandate_autoline AFTER INSERT ON miot_trips.mandate
FOR EACH ROW EXECUTE FUNCTION miot_trips.fn_mandate_autoline();

-- 3) consistencia física→contractual: montar una carga implica el vínculo del mandato dueño
CREATE OR REPLACE FUNCTION miot_trips.fn_trip_cargo_consistency() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_mandate UUID; v_tenant VARCHAR(128);
BEGIN
    IF NEW.version_of IS NOT NULL THEN  -- las copias de versión no re-vinculan
        RETURN NEW;
    END IF;
    SELECT ml.mandate_id, ml.tenant_code INTO v_mandate, v_tenant
    FROM miot_trips.cargo_unit cu
    JOIN miot_trips.mandate_line ml ON ml.id = cu.line_id AND ml.version_of IS NULL AND ml.is_active
    WHERE cu.id = NEW.cargo_id AND cu.is_active;
    IF v_mandate IS NULL THEN
        RAISE EXCEPTION 'cargo % has no mandate', NEW.cargo_id;
    END IF;
    NEW.tenant_code := COALESCE(NEW.tenant_code, v_tenant);
    INSERT INTO miot_trips.trip_mandate (trip_id, mandate_id, tenant_code, created_by)
    VALUES (NEW.trip_id, v_mandate, v_tenant, NEW.created_by)
    ON CONFLICT (trip_id, mandate_id) WHERE version_of IS NULL AND is_active DO NOTHING;
    RETURN NEW;
END $$;
CREATE TRIGGER trg_trip_cargo_consistency BEFORE INSERT ON miot_trips.trip_cargo
FOR EACH ROW EXECUTE FUNCTION miot_trips.fn_trip_cargo_consistency();

-- a closed or cancelled mandate takes no new trips (directly or through mounted cargo)
CREATE OR REPLACE FUNCTION miot_trips.fn_trip_mandate_open() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_status VARCHAR(16);
BEGIN
    IF NEW.version_of IS NOT NULL THEN
        RETURN NEW;
    END IF;
    SELECT m.status INTO v_status FROM miot_trips.mandate m
    WHERE m.id = NEW.mandate_id AND m.tenant_code = NEW.tenant_code;
    IF v_status IN ('cerrado', 'anulado') THEN
        RAISE EXCEPTION 'mandate % is %', NEW.mandate_id, v_status;
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER trg_trip_mandate_open BEFORE INSERT ON miot_trips.trip_mandate
FOR EACH ROW EXECUTE FUNCTION miot_trips.fn_trip_mandate_open();

-- 4) la asignación debe apuntar a un recurso existente del tenant (FK por tipo)
CREATE OR REPLACE FUNCTION miot_trips.fn_assignment_resource_check() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE ok BOOLEAN;
BEGIN
    IF NEW.version_of IS NOT NULL THEN  -- las copias de versión no se re-chequean
        RETURN NEW;
    END IF;
    IF NEW.resource_type = 'truck' THEN
        SELECT EXISTS(SELECT 1 FROM miot_fleet.truck   WHERE id=NEW.resource_id AND tenant_code=NEW.tenant_code AND is_active) INTO ok;
    ELSIF NEW.resource_type = 'trailer' THEN
        SELECT EXISTS(SELECT 1 FROM miot_fleet.trailer WHERE id=NEW.resource_id AND tenant_code=NEW.tenant_code AND is_active) INTO ok;
    ELSE
        SELECT EXISTS(SELECT 1 FROM miot_fleet.driver  WHERE id=NEW.resource_id AND tenant_code=NEW.tenant_code AND is_active) INTO ok;
    END IF;
    IF NOT ok THEN
        RAISE EXCEPTION '% % not found for tenant', NEW.resource_type, NEW.resource_id
              USING ERRCODE = 'foreign_key_violation';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER trg_assignment_resource_check
BEFORE INSERT OR UPDATE OF resource_id, resource_type ON miot_trips.trip_resource_assignment
FOR EACH ROW EXECUTE FUNCTION miot_trips.fn_assignment_resource_check();

-- 5) PROYECCIÓN trip_live: rebuild desde el registro, preservando el estado de motor
CREATE OR REPLACE FUNCTION miot_trips.fn_trip_live_refresh(p_trip UUID) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
    t miot_trips.trip%ROWTYPE;
    v_asset VARCHAR(16); v_truck_carrier UUID;
    v_rampla VARCHAR(16);
    v_dr1_id VARCHAR(64); v_dr1_name VARCHAR(255); v_dr1_phone VARCHAR(64);
    v_dr2_id VARCHAR(64); v_dr2_name VARCHAR(255); v_dr2_phone VARCHAR(64);
    v_car_id VARCHAR(64); v_car_name VARCHAR(255); v_car_phone VARCHAR(64);
    v_codes JSONB; v_eta TIMESTAMPTZ; v_stops INT[];
    v_o_label VARCHAR(128); v_d_label VARCHAR(128); v_load VARCHAR(255);
    v_sstatus VARCHAR(64);
BEGIN
    -- serializa las reconstrucciones del mismo viaje: cada una lee lo que la anterior confirmó
    PERFORM pg_advisory_xact_lock(hashtextextended('miot_trips.trip_live:' || p_trip::text, 0));
    SELECT * INTO t FROM miot_trips.trip WHERE id = p_trip;
    IF NOT FOUND OR t.status IN ('realizado','anulado') THEN
        DELETE FROM miot_trips.trip_live WHERE trip_id = p_trip;
        RETURN;
    END IF;

    SELECT tk.license_plate, tk.carrier_id INTO v_asset, v_truck_carrier
    FROM miot_trips.trip_resource_assignment a
    JOIN miot_fleet.truck tk ON tk.id = a.resource_id
    WHERE a.trip_id = p_trip AND a.resource_type='truck' AND a.valid_to IS NULL
      AND a.version_of IS NULL AND a.is_active
    ORDER BY a.valid_from DESC LIMIT 1;

    SELECT tl.license_plate INTO v_rampla
    FROM miot_trips.trip_resource_assignment a
    JOIN miot_fleet.trailer tl ON tl.id = a.resource_id
    WHERE a.trip_id = p_trip AND a.resource_type='trailer' AND a.valid_to IS NULL
      AND a.version_of IS NULL AND a.is_active
    ORDER BY a.valid_from DESC LIMIT 1;

    SELECT d.rut, d.full_name, COALESCE(d.mobile_phone, d.phone)
      INTO v_dr1_id, v_dr1_name, v_dr1_phone
    FROM miot_trips.trip_resource_assignment a
    JOIN miot_fleet.driver d ON d.id = a.resource_id
    WHERE a.trip_id = p_trip AND a.resource_type='driver' AND a.valid_to IS NULL
      AND a.version_of IS NULL AND a.is_active
    ORDER BY a.valid_from ASC, a.created_at ASC LIMIT 1;

    SELECT d.rut, d.full_name, COALESCE(d.mobile_phone, d.phone)
      INTO v_dr2_id, v_dr2_name, v_dr2_phone
    FROM miot_trips.trip_resource_assignment a
    JOIN miot_fleet.driver d ON d.id = a.resource_id
    WHERE a.trip_id = p_trip AND a.resource_type='driver' AND a.valid_to IS NULL
      AND a.version_of IS NULL AND a.is_active
    ORDER BY a.valid_from ASC, a.created_at ASC OFFSET 1 LIMIT 1;

    IF v_truck_carrier IS NOT NULL THEN
        SELECT c.id::text, c.legal_name, c.phone INTO v_car_id, v_car_name, v_car_phone
        FROM miot_fleet.carrier c WHERE c.id = v_truck_carrier;
    END IF;

    SELECT jsonb_agg(jsonb_build_object('mandate_id', m.id, 'code', m.external_code))
      INTO v_codes
    FROM miot_trips.trip_mandate tm JOIN miot_trips.mandate m ON m.id = tm.mandate_id
    WHERE tm.trip_id = p_trip AND tm.version_of IS NULL AND tm.is_active;

    SELECT s.planned_end INTO v_eta
    FROM miot_trips.stage s
    WHERE s.subject_type='trip' AND s.subject_id = p_trip AND s.version_of IS NULL AND s.is_active
      AND s.planned_end IS NOT NULL
    ORDER BY s.seq DESC LIMIT 1;

    -- no stop geofences until locations map to real geofence ids
    v_stops := NULL;

    -- estado de negocio: lo proyecta la etapa en curso, o la última cerrada que declaró uno
    SELECT s.service_status INTO v_sstatus
    FROM miot_trips.stage s
    WHERE s.subject_type='trip' AND s.subject_id = p_trip
      AND s.version_of IS NULL AND s.is_active
      AND s.service_status IS NOT NULL AND s.status <> 'pendiente'
    ORDER BY (s.status='en_curso') DESC, s.actual_start DESC NULLS LAST, s.seq DESC
    LIMIT 1;

    SELECT l.name INTO v_o_label FROM miot_trips.location l WHERE l.id = t.origin_id;
    SELECT l.name INTO v_d_label FROM miot_trips.location l WHERE l.id = t.destination_id;

    SELECT left(string_agg(cu.description, ' + '), 255) INTO v_load
    FROM miot_trips.trip_cargo tc JOIN miot_trips.cargo_unit cu ON cu.id = tc.cargo_id
    WHERE tc.trip_id = p_trip AND tc.version_of IS NULL AND tc.is_active;

    INSERT INTO miot_trips.trip_live AS live (
        trip_id, tenant_code, mandate_codes, asset_id, trip_type,
        origin_geofence_label, destination_geofence_label, stop_geofence_ids,
        status, driver_id, driver_name, driver_contact_phone,
        double_driver, second_driver_id, second_driver_name, second_driver_contact_phone,
        carrier_id, carrier_name, carrier_contact_phone, rampla_plate,
        start_time, end_time, estimated_arrival_time, type_load)
    VALUES (
        p_trip, t.tenant_code, v_codes, v_asset, 'v',
        v_o_label, v_d_label, v_stops,
        COALESCE(v_sstatus, t.status), v_dr1_id, v_dr1_name, v_dr1_phone,
        v_dr2_id IS NOT NULL, v_dr2_id, v_dr2_name, v_dr2_phone,
        v_car_id, v_car_name, v_car_phone, v_rampla,
        t.actual_start, t.actual_end, v_eta, v_load)
    ON CONFLICT (trip_id) DO UPDATE SET
        mandate_codes = EXCLUDED.mandate_codes,
        asset_id = EXCLUDED.asset_id,
        origin_geofence_label = EXCLUDED.origin_geofence_label,
        destination_geofence_label = EXCLUDED.destination_geofence_label,
        stop_geofence_ids = EXCLUDED.stop_geofence_ids,
        status = EXCLUDED.status,
        driver_id = EXCLUDED.driver_id,
        driver_name = EXCLUDED.driver_name,
        driver_contact_phone = EXCLUDED.driver_contact_phone,
        double_driver = EXCLUDED.double_driver,
        second_driver_id = EXCLUDED.second_driver_id,
        second_driver_name = EXCLUDED.second_driver_name,
        second_driver_contact_phone = EXCLUDED.second_driver_contact_phone,
        carrier_id = EXCLUDED.carrier_id,
        carrier_name = EXCLUDED.carrier_name,
        carrier_contact_phone = EXCLUDED.carrier_contact_phone,
        rampla_plate = EXCLUDED.rampla_plate,
        start_time = EXCLUDED.start_time,
        end_time = EXCLUDED.end_time,
        estimated_arrival_time = EXCLUDED.estimated_arrival_time,
        type_load = EXCLUDED.type_load,
        updated_at = now();
    -- current_geofence_id / *_visited / origin_is_internal: estado de MOTOR, el rebuild no los toca.
END $$;

CREATE OR REPLACE FUNCTION miot_trips.fn_trip_live_from_trip() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.version_of IS NOT NULL THEN  -- las copias de versión no refrescan la proyección
        RETURN NEW;
    END IF;
    PERFORM miot_trips.fn_trip_live_refresh(NEW.id);
    RETURN NEW;
END $$;
CREATE TRIGGER trg_trip_live_trip AFTER INSERT OR UPDATE ON miot_trips.trip
FOR EACH ROW EXECUTE FUNCTION miot_trips.fn_trip_live_from_trip();

CREATE OR REPLACE FUNCTION miot_trips.fn_trip_live_from_child() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_trip UUID;
BEGIN
    IF (CASE WHEN TG_OP='DELETE' THEN OLD.version_of ELSE NEW.version_of END) IS NOT NULL THEN
        RETURN COALESCE(NEW, OLD);  -- las copias de versión no refrescan la proyección
    END IF;
    IF TG_TABLE_NAME = 'stage' THEN
        IF (TG_OP='DELETE') THEN v_trip := OLD.subject_id; ELSE v_trip := NEW.subject_id; END IF;
        IF (CASE WHEN TG_OP='DELETE' THEN OLD.subject_type ELSE NEW.subject_type END) <> 'trip' THEN
            RETURN COALESCE(NEW, OLD);
        END IF;
    ELSE
        IF (TG_OP='DELETE') THEN v_trip := OLD.trip_id; ELSE v_trip := NEW.trip_id; END IF;
    END IF;
    PERFORM miot_trips.fn_trip_live_refresh(v_trip);
    RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER trg_trip_live_assignment AFTER INSERT OR UPDATE OR DELETE ON miot_trips.trip_resource_assignment
FOR EACH ROW EXECUTE FUNCTION miot_trips.fn_trip_live_from_child();
CREATE TRIGGER trg_trip_live_stage AFTER INSERT OR UPDATE OR DELETE ON miot_trips.stage
FOR EACH ROW EXECUTE FUNCTION miot_trips.fn_trip_live_from_child();
CREATE TRIGGER trg_trip_live_tm AFTER INSERT OR UPDATE OR DELETE ON miot_trips.trip_mandate
FOR EACH ROW EXECUTE FUNCTION miot_trips.fn_trip_live_from_child();
CREATE TRIGGER trg_trip_live_tc AFTER INSERT OR UPDATE OR DELETE ON miot_trips.trip_cargo
FOR EACH ROW EXECUTE FUNCTION miot_trips.fn_trip_live_from_child();

-- the hot row shows location names and the cargo description: refresh the trips that use them
CREATE OR REPLACE FUNCTION miot_trips.fn_trip_live_from_reference() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_trip UUID;
BEGIN
    IF NEW.version_of IS NOT NULL THEN
        RETURN NEW;
    END IF;
    IF TG_TABLE_NAME = 'location' THEN
        FOR v_trip IN SELECT t.id FROM miot_trips.trip t
                      WHERE (t.origin_id = NEW.id OR t.destination_id = NEW.id)
                        AND t.version_of IS NULL AND t.is_active
                        AND t.status NOT IN ('realizado','anulado') LOOP
            PERFORM miot_trips.fn_trip_live_refresh(v_trip);
        END LOOP;
    ELSE
        FOR v_trip IN SELECT tc.trip_id FROM miot_trips.trip_cargo tc
                      WHERE tc.cargo_id = NEW.id AND tc.version_of IS NULL AND tc.is_active LOOP
            PERFORM miot_trips.fn_trip_live_refresh(v_trip);
        END LOOP;
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER trg_trip_live_location AFTER UPDATE ON miot_trips.location
FOR EACH ROW EXECUTE FUNCTION miot_trips.fn_trip_live_from_reference();
CREATE TRIGGER trg_trip_live_cargo AFTER UPDATE ON miot_trips.cargo_unit
FOR EACH ROW EXECUTE FUNCTION miot_trips.fn_trip_live_from_reference();

-- ============================================================
-- VERSIONADO (SCD2 en la misma tabla, decisión 2026-10-23)
-- Nada se pisa: cada UPDATE archiva la versión anterior como fila
-- inactiva (version_of = id de la entidad). La fila vigente conserva
-- su id para siempre (las FKs no cambian) y es la única con
-- version_of IS NULL; borrado lógico = is_active=false en la vigente.
-- Explotación: SELECT * FROM t WHERE id = X OR version_of = X ORDER BY version_from.
-- (ventana de versión = version_from/version_to; no confundir con valid_from/valid_to
--  de las asignaciones, que son vigencia OPERACIONAL del recurso en el viaje)
-- ============================================================

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['location','mandate','mandate_line',
                             'cargo_unit','trip','trip_mandate','stage','stage_activity',
                             'trip_resource_assignment','trip_cargo']
    LOOP
        EXECUTE format('ALTER TABLE miot_trips.%I
                        ADD COLUMN version_of   UUID,
                        ADD COLUMN is_active    BOOLEAN NOT NULL DEFAULT TRUE,
                        ADD COLUMN version_from TIMESTAMPTZ NOT NULL DEFAULT now(),
                        ADD COLUMN version_to   TIMESTAMPTZ', t);
        EXECUTE format('CREATE INDEX idx_%s_versions ON miot_trips.%I (version_of) WHERE version_of IS NOT NULL',
                       t, t);
    END LOOP;
END $$;

-- Los vínculos necesitan PK propio para poder convivir con sus versiones
ALTER TABLE miot_trips.trip_mandate DROP CONSTRAINT trip_mandate_pkey,
    ADD COLUMN id UUID NOT NULL DEFAULT gen_random_uuid(),
    ADD PRIMARY KEY (id);
CREATE UNIQUE INDEX uq_trip_mandate_current ON miot_trips.trip_mandate (trip_id, mandate_id)
    WHERE version_of IS NULL AND is_active;
ALTER TABLE miot_trips.trip_cargo DROP CONSTRAINT trip_cargo_pkey,
    ADD COLUMN id UUID NOT NULL DEFAULT gen_random_uuid(),
    ADD PRIMARY KEY (id);
CREATE UNIQUE INDEX uq_trip_cargo_current ON miot_trips.trip_cargo (trip_id, cargo_id)
    WHERE version_of IS NULL AND is_active;

-- Los únicos de negocio solo rigen para la versión vigente
ALTER TABLE miot_trips.mandate DROP CONSTRAINT mandate_tenant_code_external_code_key;
CREATE UNIQUE INDEX uq_mandate_code_current ON miot_trips.mandate (tenant_code, external_code)
    WHERE version_of IS NULL AND is_active;
ALTER TABLE miot_trips.mandate_line DROP CONSTRAINT mandate_line_mandate_id_seq_key;
CREATE UNIQUE INDEX uq_mandate_line_current ON miot_trips.mandate_line (mandate_id, seq)
    WHERE version_of IS NULL AND is_active;
ALTER TABLE miot_trips.stage DROP CONSTRAINT stage_subject_type_subject_id_seq_key;
CREATE UNIQUE INDEX uq_stage_seq_current ON miot_trips.stage (subject_type, subject_id, seq)
    WHERE version_of IS NULL AND is_active;
ALTER TABLE miot_trips.stage_activity DROP CONSTRAINT stage_activity_stage_id_seq_key;
CREATE UNIQUE INDEX uq_stage_activity_seq_current ON miot_trips.stage_activity (stage_id, seq)
    WHERE version_of IS NULL AND is_active;
CREATE UNIQUE INDEX uq_cargo_unit_partial_current ON miot_trips.cargo_unit (line_id, partial_no)
    WHERE version_of IS NULL AND is_active;
-- la máquina de estados también mira solo filas vigentes
DROP INDEX miot_trips.uq_stage_one_running;
CREATE UNIQUE INDEX uq_stage_one_running ON miot_trips.stage (subject_type, subject_id)
    WHERE status = 'en_curso' AND version_of IS NULL AND is_active;

-- El archivador genérico: cada UPDATE de una fila vigente guarda la versión anterior
CREATE OR REPLACE FUNCTION miot_trips.fn_version_on_update() RETURNS trigger
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
        NEW.version_to := now();   -- borrado lógico: la vigente cierra su ventana
    END IF;
    RETURN NEW;
END $$;

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['location','mandate','mandate_line',
                             'cargo_unit','trip','trip_mandate','stage','stage_activity',
                             'trip_resource_assignment','trip_cargo']
    LOOP
        EXECUTE format('CREATE TRIGGER trg_%s_zversion BEFORE UPDATE ON miot_trips.%I
                        FOR EACH ROW EXECUTE FUNCTION miot_trips.fn_version_on_update()', t, t);
    END LOOP;
END $$;
