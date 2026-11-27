-- ============================================================
-- Propósito:  Migración V0.14.0 — schema miot_teltonika
--             Equipos GPS conectados directo a la plataforma (Teltonika
--             Codec 8 / 8 Extended): registro por organización con prueba
--             de posesión, patente con vigencia, salud, bitácora de paquetes
--             (particionada) y comandos (Codec 12).
-- Esquema:    miot_teltonika  (pruebas: esquema aislado)
-- Entorno:    db/migration/teltonika (modulith)
-- Requisito:  extensión pg_partman en el esquema partman (la crea miot-tracking)
-- Status:     draft
-- ============================================================
--
-- tenant_code es el client_id GPS de la organización (organization.tenant_client_id),
-- el mismo de Ajustes › Integración GPS. Cada registro del equipo se publica con él.
--
-- Prueba de posesión: al registrar, el equipo queda pendiente. Teltonika: el instalador
-- carga un código de activación en el equipo (parámetro 2015); el receptor acepta su
-- conexión, guarda sus paquetes sin publicarlos y le pregunta el código (Codec 12
-- getparam 2015); si coincide, se activa y lo guardado se publica. Marcas vía Traccar:
-- un dueño de plataforma aprueba el reclamo. Un reclamo pendiente vence en claim_expires_at.
--
-- La patente no es fija: device_assignment guarda sus vigencias y el receptor
-- resuelve la patente de cada registro según la hora del registro.
--
-- packet_log guarda los paquetes que no se publicaron (pendientes de activación,
-- cuarentena, CRC, registros sin posición u hora fuera de rango) y, durante una
-- captura, todo el tráfico del equipo. Particionada por día; pg_partman borra las
-- particiones vencidas.

CREATE SCHEMA IF NOT EXISTS miot_teltonika;
CREATE SCHEMA IF NOT EXISTS partman;
CREATE EXTENSION IF NOT EXISTS pg_partman WITH SCHEMA partman;

-- Catálogo de modelos que la plataforma recibe. protocol 'teltonika' lo decodifica el
-- receptor propio (activación por código y comandos); los demás llegan por Traccar
-- (pasarela de código abierto, más de 200 protocolos) y se activan con aprobación de
-- plataforma. traccar_port es el puerto que Traccar escucha para ese protocolo.
CREATE TABLE miot_teltonika.device_model (
    code            text PRIMARY KEY,
    brand           text NOT NULL,
    model           text NOT NULL,
    protocol        text NOT NULL,
    via             text NOT NULL CHECK (via IN ('native', 'traccar')),
    traccar_port    integer,
    guide_family    text,
    verified        boolean NOT NULL DEFAULT false,
    notes           text
);

INSERT INTO miot_teltonika.device_model (code, brand, model, protocol, via, traccar_port, guide_family, verified, notes)
VALUES
 ('FMB920', 'Teltonika', 'FMB920', 'teltonika', 'native', NULL, 'fmb9xx', true, '2G, básico'),
 ('FMC920', 'Teltonika', 'FMC920', 'teltonika', 'native', NULL, 'fmb9xx', false, 'LTE Cat 1; mismos IDs que FMB920'),
 ('FMM920', 'Teltonika', 'FMM920', 'teltonika', 'native', NULL, 'fmb9xx', false, 'LTE Cat M1/NB-IoT; mismos IDs que FMB920'),
 ('FMB120', 'Teltonika', 'FMB120', 'teltonika', 'native', NULL, 'fmb9xx', false, 'Verificar IDs de entradas adicionales'),
 ('FMB130', 'Teltonika', 'FMB130', 'teltonika', 'native', NULL, 'fmb9xx', false, 'Verificar IDs de entradas adicionales'),
 ('FMB140', 'Teltonika', 'FMB140', 'teltonika', 'native', NULL, 'fmb9xx', false, 'CAN (ALL-CAN300); verificar IDs CAN'),
 ('FMC130', 'Teltonika', 'FMC130', 'teltonika', 'native', NULL, 'fmb9xx', false, 'LTE; verificar IDs de entradas adicionales'),
 ('GT06N', 'Concox / Jimi', 'GT06N', 'gt06', 'traccar', 5023, NULL, false, 'Configuración por SMS según el manual del fabricante'),
 ('JM-VL01', 'Concox / Jimi', 'JM-VL01', 'gt06', 'traccar', 5023, NULL, false, NULL),
 ('GV300', 'Queclink', 'GV300', 'gl200', 'traccar', 5004, NULL, false, NULL),
 ('GV500', 'Queclink', 'GV500', 'gl200', 'traccar', 5004, NULL, false, NULL),
 ('TK103', 'Coban', 'TK103', 'gps103', 'traccar', 5001, NULL, false, NULL),
 ('ST-901', 'Sinotrack', 'ST-901', 'h02', 'traccar', 5013, NULL, false, NULL),
 ('T366', 'Meitrack', 'T366', 'meitrack', 'traccar', 5020, NULL, false, NULL),
 ('FM-ECO4', 'Ruptela', 'FM-Eco4', 'ruptela', 'traccar', 5046, NULL, false, NULL),
 ('ST300', 'Suntech', 'ST300', 'suntech', 'traccar', 5011, NULL, false, NULL),
 ('LMU-2630', 'CalAmp', 'LMU-2630', 'calamp', 'traccar', 5082, NULL, false, NULL),
 ('OSMAND', 'OsmAnd / Traccar Client', 'App móvil', 'osmand', 'traccar', 5055, NULL, true, 'Útil para pruebas y celulares');

-- Perfiles de configuración por organización (frecuencia, ignición, sueño, entradas activas),
-- en forma de parámetros Teltonika id:value. Validados con los mismos rangos que los comandos.
CREATE TABLE miot_teltonika.config_profile (
    id              uuid PRIMARY KEY,
    tenant_code     text NOT NULL,
    name            text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
    description     text,
    guide_family    text NOT NULL DEFAULT 'fmb9xx',
    params          text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    created_by      text,
    updated_at      timestamptz NOT NULL DEFAULT now(),
    updated_by      text,
    UNIQUE (tenant_code, name)
);

-- Perfiles de entradas: qué está conectado en cada entrada del equipo y qué evento genera.
-- source es el nombre canónico de la entrada (din1..din4, ain1, ain2), igual para
-- Teltonika y para las marcas que llegan por Traccar.
CREATE TABLE miot_teltonika.input_profile (
    id              uuid PRIMARY KEY,
    tenant_code     text NOT NULL,
    name            text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
    description     text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    created_by      text,
    updated_at      timestamptz NOT NULL DEFAULT now(),
    updated_by      text,
    UNIQUE (tenant_code, name)
);

CREATE TABLE miot_teltonika.input_mapping (
    profile_id      uuid NOT NULL REFERENCES miot_teltonika.input_profile (id) ON DELETE CASCADE,
    source          text NOT NULL CHECK (source IN ('din1', 'din2', 'din3', 'din4', 'ain1', 'ain2')),
    meaning         text NOT NULL CHECK (meaning IN
                        ('door', 'panic', 'pto', 'refrigeration', 'seatbelt', 'tamper', 'custom')),
    label           text NOT NULL CHECK (length(label) BETWEEN 1 AND 60),
    active_high     boolean NOT NULL DEFAULT true,
    threshold_v     double precision,
    event_on        boolean NOT NULL DEFAULT true,
    event_off       boolean NOT NULL DEFAULT true,
    PRIMARY KEY (profile_id, source)
);

CREATE TABLE miot_teltonika.device (
    -- IMEI (15 dígitos) en Teltonika; en marcas vía Traccar, el identificador que el equipo
    -- envía (uniqueId en Traccar), que no siempre es el IMEI.
    imei             text PRIMARY KEY CHECK (imei ~ '^[0-9A-Za-z]{4,32}$'),
    tenant_code      text NOT NULL,
    model            text NOT NULL DEFAULT 'FMB920' REFERENCES miot_teltonika.device_model (code),
    label            text,
    config_profile_id uuid REFERENCES miot_teltonika.config_profile (id) ON DELETE SET NULL,
    input_profile_id uuid REFERENCES miot_teltonika.input_profile (id) ON DELETE SET NULL,
    is_active        boolean NOT NULL DEFAULT true,
    activation_code  text CHECK (activation_code ~ '^[0-9]{6}$'),
    activated_at     timestamptz,
    claim_expires_at timestamptz,
    capture_until    timestamptz,
    created_at       timestamptz NOT NULL DEFAULT now(),
    created_by       text,
    updated_at       timestamptz NOT NULL DEFAULT now(),
    updated_by       text
);

CREATE INDEX idx_device_tenant ON miot_teltonika.device (tenant_code, is_active);

CREATE TABLE miot_teltonika.device_assignment (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    imei            text NOT NULL REFERENCES miot_teltonika.device (imei) ON DELETE CASCADE,
    asset_id        text NOT NULL CHECK (length(asset_id) BETWEEN 1 AND 255),
    valid_from      timestamptz NOT NULL,
    valid_until     timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    created_by      text,
    CHECK (valid_until IS NULL OR valid_until > valid_from)
);

CREATE INDEX idx_assignment_imei ON miot_teltonika.device_assignment (imei, valid_from DESC);
-- A lo más una asignación abierta por equipo.
CREATE UNIQUE INDEX uq_assignment_open ON miot_teltonika.device_assignment (imei) WHERE valid_until IS NULL;

-- Una fila por equipo, actualizada cada pocos segundos: espacio libre en cada página
-- para actualizaciones HOT y menos bloat.
CREATE TABLE miot_teltonika.device_status (
    imei                    text PRIMARY KEY REFERENCES miot_teltonika.device (imei) ON DELETE CASCADE,
    first_seen_at           timestamptz,
    last_seen_at            timestamptz,
    last_record_at          timestamptz,
    last_remote_address     text,
    connections             bigint NOT NULL DEFAULT 0,
    packets                 bigint NOT NULL DEFAULT 0,
    records_published       bigint NOT NULL DEFAULT 0,
    crc_errors              bigint NOT NULL DEFAULT 0,
    quarantined_packets     bigint NOT NULL DEFAULT 0,
    records_without_position bigint NOT NULL DEFAULT 0,
    records_out_of_time     bigint NOT NULL DEFAULT 0,
    last_latitude           double precision,
    last_longitude          double precision,
    last_fix_at             timestamptz,
    last_gnss_status        integer,
    last_satellites         integer,
    last_gsm_signal         integer,
    last_external_voltage_mv integer,
    last_battery_voltage_mv integer,
    last_sleep_mode         integer,
    last_data_mode          integer,
    last_ignition           boolean,
    ignition_on_seen_at     timestamptz,
    ignition_off_seen_at    timestamptz,
    last_ibutton            text,
    last_ibutton_at         timestamptz,
    last_record_interval_s  integer,
    -- Ignition and iButton sightings before this time do not count (reassignment, reinstallation).
    sightings_reset_at      timestamptz,
    updated_at              timestamptz NOT NULL DEFAULT now()
) WITH (fillfactor = 70);

CREATE TABLE miot_teltonika.packet_log (
    id              bigint GENERATED ALWAYS AS IDENTITY,
    imei            text NOT NULL,
    tenant_code     text,
    received_at     timestamptz NOT NULL,
    remote_address  text,
    outcome         text NOT NULL CHECK (outcome IN
                        ('published', 'quarantined', 'crc_error', 'partial', 'command_response',
                         'pending_activation', 'replayed')),
    reason          text,
    codec_id        integer,
    record_count    integer,
    -- teltonika_tcp: paquete AVL TCP completo; teltonika_udp: datagrama; teltonika_mqtt: mensaje MQTT
    -- (Codec JSON o datos AVL Codec 8/8E); traccar_json: posición reenviada por Traccar.
    format          text NOT NULL DEFAULT 'teltonika_tcp'
                        CHECK (format IN ('teltonika_tcp', 'teltonika_udp', 'teltonika_mqtt', 'traccar_json')),
    packet          bytea NOT NULL,
    PRIMARY KEY (id, received_at)
) PARTITION BY RANGE (received_at);

CREATE INDEX idx_packet_log_imei ON miot_teltonika.packet_log (imei, received_at DESC);
CREATE INDEX idx_packet_log_pending ON miot_teltonika.packet_log (imei, received_at)
    WHERE outcome = 'pending_activation';

SELECT partman.create_parent(
    p_parent_table := 'miot_teltonika.packet_log',
    p_control      := 'received_at',
    p_type         := 'range',
    p_interval     := '1 day',
    p_premake      := 3
);

UPDATE partman.part_config
SET retention = '7 days', retention_keep_table = false, infinite_time_partitions = true
WHERE parent_table = 'miot_teltonika.packet_log';

CREATE TABLE miot_teltonika.device_command (
    id              uuid PRIMARY KEY,
    -- Order of arrival: commands queued in the same instant go to the device in this order.
    seq             bigint GENERATED ALWAYS AS IDENTITY,
    imei            text NOT NULL REFERENCES miot_teltonika.device (imei) ON DELETE CASCADE,
    tenant_code     text NOT NULL,
    command         text NOT NULL CHECK (length(command) BETWEEN 1 AND 512),
    purpose         text NOT NULL DEFAULT 'manual' CHECK (purpose IN
                        ('manual', 'activation', 'intensive_read', 'intensive_start', 'intensive_end', 'profile')),
    status          text NOT NULL DEFAULT 'pending' CHECK (status IN
                        ('pending', 'sent', 'answered', 'failed', 'expired')),
    response        text,
    requested_by    text,
    requested_at    timestamptz NOT NULL DEFAULT now(),
    sent_at         timestamptz,
    answered_at     timestamptz,
    expires_at      timestamptz NOT NULL
);

CREATE INDEX idx_command_pending ON miot_teltonika.device_command (imei, seq) WHERE status = 'pending';
CREATE INDEX idx_command_imei ON miot_teltonika.device_command (imei, seq DESC);

-- previous_params: lo que el equipo tenía antes (respuestas a getparam), para devolverlo.
-- restored_at: el equipo confirmó la vuelta ("New value ..."); hasta entonces se reintenta.
CREATE TABLE miot_teltonika.intensive_tracking (
    imei            text PRIMARY KEY REFERENCES miot_teltonika.device (imei) ON DELETE CASCADE,
    tenant_code     text NOT NULL,
    started_at      timestamptz NOT NULL,
    until           timestamptz NOT NULL,
    reason          text,
    requested_by    text,
    previous_params text,
    ended_at        timestamptz,
    restored_at     timestamptz
);
