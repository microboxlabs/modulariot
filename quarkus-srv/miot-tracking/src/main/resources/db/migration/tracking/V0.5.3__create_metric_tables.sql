-- Metric tables for vehicle telemetry persistence.
-- Consolidated from db-writer V1.30.0-V1.30.3, V1.34.0, V1.35.0.

-- ============================================================================
-- asset_metric_core: core OBD2/J1939 telemetry (partitioned monthly)
-- ============================================================================
CREATE TABLE miot_tracking.asset_metric_core (
    id                      BIGSERIAL NOT NULL,
    shared_client_id        VARCHAR(32) NOT NULL,
    asset_id                VARCHAR(255) NOT NULL,
    device_id               VARCHAR(255),
    ts                      TIMESTAMPTZ NOT NULL,
    asset_data_id           BIGINT,

    -- POWERTRAIN
    engine_rpm              INT4,
    vehicle_speed_kph       INT2,
    engine_load_pct         INT2,
    throttle_pos_pct        INT2,
    coolant_temp_c          INT2,
    intake_air_temp_c       INT2,
    engine_runtime_s        INT4,
    engine_total_runtime_h  INT4,

    -- FUEL
    fuel_level_pct          INT2,
    fuel_volume_ml          INT4,
    fuel_rate_mlph          INT4,
    fuel_used_ml            INT8,
    battery_voltage_mv      INT4,
    engine_torque_pct       INT2,

    -- MOTION
    odometer_km             INT8,
    idle_state              BOOLEAN,
    accelerator_pos_pct     INT2,
    brake_state             BOOLEAN,

    -- DIAGNOSTICS
    mil_on                  BOOLEAN,
    dtc_count               INT2,

    -- EMISSIONS
    fuel_trim_short_pct     INT2,
    fuel_trim_long_pct      INT2,
    lambda_ratio            INT2,
    catalyst_temp_c         INT2,

    -- ELECTRICAL
    battery_current_ma      INT4,
    pto_state               BOOLEAN,
    engine_fan_state        BOOLEAN,

    -- PROVENANCE
    payload_schema          VARCHAR(32) NOT NULL DEFAULT 'miot.metrics@1.0',
    src                     VARCHAR(16),
    quality                 VARCHAR(16),
    seq                     INT8,
    request_id              VARCHAR(32),
    request_timestamp       TIMESTAMPTZ NOT NULL,
    created_datetime        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (shared_client_id, asset_id, ts)
) PARTITION BY RANGE (ts);

CREATE INDEX ON miot_tracking.asset_metric_core (shared_client_id, asset_id, ts DESC);

COMMENT ON TABLE miot_tracking.asset_metric_core IS 'Core vehicle telemetry metrics — append only, monthly partitions';

SELECT partman.create_parent(
    p_parent_table := 'miot_tracking.asset_metric_core',
    p_control      := 'ts',
    p_type         := 'range',
    p_interval     := '1 month',
    p_start_partition := '2026-02-01'
);

UPDATE partman.part_config
SET premake = 1
WHERE parent_table = 'miot_tracking.asset_metric_core';

-- ============================================================================
-- asset_metric_dtc: diagnostic trouble codes (partitioned monthly)
-- ============================================================================
CREATE TABLE miot_tracking.asset_metric_dtc (
    id                  BIGSERIAL NOT NULL,
    shared_client_id    VARCHAR(32) NOT NULL,
    asset_id            VARCHAR(255) NOT NULL,
    device_id           VARCHAR(255),
    ts                  TIMESTAMPTZ NOT NULL,
    asset_data_id       BIGINT,
    dtc_codes           TEXT[],
    engine_freeze_frame TEXT,
    payload_schema      VARCHAR(32) NOT NULL DEFAULT 'miot.metrics@1.0',
    src                 VARCHAR(16),
    request_id          VARCHAR(32),
    request_timestamp   TIMESTAMPTZ NOT NULL,
    created_datetime    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (shared_client_id, asset_id, ts)
) PARTITION BY RANGE (ts);

ALTER TABLE miot_tracking.asset_metric_dtc
    ADD CONSTRAINT dtc_codes_size_limit CHECK (array_length(dtc_codes, 1) <= 100);

CREATE INDEX ON miot_tracking.asset_metric_dtc (shared_client_id, asset_id, ts DESC);

COMMENT ON TABLE miot_tracking.asset_metric_dtc IS 'Diagnostic Trouble Code events — sparse, insert only on change';

SELECT partman.create_parent(
    p_parent_table := 'miot_tracking.asset_metric_dtc',
    p_control      := 'ts',
    p_type         := 'range',
    p_interval     := '1 month',
    p_start_partition := '2026-02-01'
);

UPDATE partman.part_config
SET premake = 1
WHERE parent_table = 'miot_tracking.asset_metric_dtc';

-- ============================================================================
-- asset_metric_ext: extension metrics (x.* keys) with bounded JSONB
-- ============================================================================
CREATE TABLE miot_tracking.asset_metric_ext (
    id                  BIGSERIAL NOT NULL,
    shared_client_id    VARCHAR(32) NOT NULL,
    asset_id            VARCHAR(255) NOT NULL,
    device_id           VARCHAR(255),
    ts                  TIMESTAMPTZ NOT NULL,
    asset_data_id       BIGINT,
    ext                 JSONB NOT NULL,
    payload_schema      VARCHAR(32) NOT NULL DEFAULT 'miot.metrics@1.0',
    src                 VARCHAR(16),
    request_id          VARCHAR(32),
    request_timestamp   TIMESTAMPTZ NOT NULL,
    created_datetime    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (shared_client_id, asset_id, ts)
) PARTITION BY RANGE (ts);

ALTER TABLE miot_tracking.asset_metric_ext
    ADD CONSTRAINT ext_size_limit CHECK (octet_length(ext::text) <= 4096);

CREATE INDEX ON miot_tracking.asset_metric_ext (shared_client_id, asset_id, ts DESC);

COMMENT ON TABLE miot_tracking.asset_metric_ext IS 'Extension metrics (x.* keys) — bounded JSONB, sparse writes';

SELECT partman.create_parent(
    p_parent_table := 'miot_tracking.asset_metric_ext',
    p_control      := 'ts',
    p_type         := 'range',
    p_interval     := '1 month',
    p_start_partition := '2026-02-01'
);

UPDATE partman.part_config
SET premake = 1
WHERE parent_table = 'miot_tracking.asset_metric_ext';

-- ============================================================================
-- ingest_ledger_metrics: idempotency ledger
-- ============================================================================
CREATE TABLE miot_tracking.ingest_ledger_metrics (
    client_id           VARCHAR(32) NOT NULL,
    device_id           VARCHAR(255) NOT NULL,
    request_id          VARCHAR(32) NOT NULL,
    request_timestamp   TIMESTAMPTZ,
    created_datetime    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (client_id, device_id, request_id)
);

COMMENT ON TABLE miot_tracking.ingest_ledger_metrics IS 'Idempotency ledger for metrics ingestion — check before insert';
