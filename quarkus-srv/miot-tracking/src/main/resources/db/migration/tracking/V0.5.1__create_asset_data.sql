-- Raw incoming asset position/telemetry data (one row per message).
-- Consolidated from db-writer V1 through V1.32.x.
CREATE TABLE miot_tracking.asset_data (
    id                          BIGSERIAL PRIMARY KEY,
    request_id                  VARCHAR(32),
    request_timestamp           TIMESTAMPTZ,
    client_id                   VARCHAR(32) NOT NULL,
    asset_id                    VARCHAR(255) NOT NULL,
    type                        VARCHAR(255),
    owner                       VARCHAR(255),
    year                        INTEGER,
    timestamp                   TIMESTAMPTZ,
    location                    geography(point, 4326),
    altitude                    DOUBLE PRECISION,
    speed                       DOUBLE PRECISION,
    heading                     DOUBLE PRECISION,
    telcom_iccid                VARCHAR(255),
    telcom_imsi                 VARCHAR(255),
    telcom_operator             VARCHAR(255),
    telcom_mcc                  VARCHAR(255),
    telcom_mnc                  VARCHAR(255),
    telcom_cell_id              VARCHAR(255),
    telcom_lac                  VARCHAR(255),
    telcom_signal_strength      INTEGER,
    telcom_gps_provider         VARCHAR(255),
    driver_info_driver_id       VARCHAR(255),
    driver_info_name            VARCHAR(255),
    driver_info_license_number  VARCHAR(255),
    driver_info_contact_phone   VARCHAR(255),
    driver_info_contact_email   VARCHAR(255),
    driver_info_id_button       VARCHAR(255),
    co_driver_info_driver_id    VARCHAR(255),
    co_driver_info_name         VARCHAR(255),
    co_driver_info_license_number VARCHAR(255),
    co_driver_info_contact_phone  VARCHAR(255),
    co_driver_info_contact_email  VARCHAR(255),
    sensors                     JSONB,
    peripherals                 JSONB,
    events                      JSONB,
    s2tokens                    JSONB,
    created_datetime            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_asset_data_location ON miot_tracking.asset_data USING GIST (location);
CREATE INDEX idx_asset_data_request_id ON miot_tracking.asset_data (request_id);
CREATE INDEX idx_asset_data_request_timestamp ON miot_tracking.asset_data (request_timestamp);
CREATE INDEX idx_asset_data_created_datetime ON miot_tracking.asset_data (created_datetime);
CREATE INDEX idx_asset_data_timestamp_asset ON miot_tracking.asset_data (timestamp, asset_id);
