-- Fleet directory. GPS signals and trips stay in the GPS database; this schema keeps what people set by hand
-- and the activity computed from the signals.

CREATE SCHEMA IF NOT EXISTS miot_fleet;

-- Field overrides ({"label": "...", "carrier": "..."}) and document expiry dates ({"insurance": "2027-03-31"})
-- per organization and asset.
CREATE TABLE miot_fleet.asset_profile (
    organization_id VARCHAR(128) NOT NULL,
    asset_id        VARCHAR(255) NOT NULL,
    fields          JSONB        NOT NULL DEFAULT '{}',
    documents       JSONB        NOT NULL DEFAULT '{}',
    updated_by      VARCHAR(255),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (organization_id, asset_id)
);

CREATE TABLE miot_fleet.asset_change (
    id              BIGSERIAL    PRIMARY KEY,
    organization_id VARCHAR(128) NOT NULL,
    asset_id        VARCHAR(255) NOT NULL,
    field           VARCHAR(64)  NOT NULL,
    old_value       TEXT,
    new_value       TEXT,
    origin          VARCHAR(16)  NOT NULL,
    changed_by      VARCHAR(255),
    changed_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_asset_change_origin CHECK (origin IN ('MANUAL', 'SUGGESTION'))
);

CREATE INDEX idx_asset_change_asset ON miot_fleet.asset_change (organization_id, asset_id, changed_at DESC);

-- A dismissed suggestion is not shown again for the same value ("USUAL_TRAILER=JX-4471").
CREATE TABLE miot_fleet.asset_suggestion_dismissal (
    organization_id VARCHAR(128) NOT NULL,
    asset_id        VARCHAR(255) NOT NULL,
    suggestion      VARCHAR(300) NOT NULL,
    dismissed_by    VARCHAR(255),
    dismissed_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (organization_id, asset_id, suggestion)
);

-- Activity per asset and UTC hour, from GPS signals. Kept a little longer than the backfill window.
CREATE TABLE miot_fleet.asset_activity_hour (
    asset_id VARCHAR(255) NOT NULL,
    hour     TIMESTAMPTZ  NOT NULL,
    signals  INTEGER      NOT NULL,
    engine_s INTEGER      NOT NULL,
    idle_s   INTEGER      NOT NULL,
    moving_s INTEGER      NOT NULL,
    km       NUMERIC(10, 2) NOT NULL,
    PRIMARY KEY (asset_id, hour)
);

CREATE INDEX idx_asset_activity_hour_hour ON miot_fleet.asset_activity_hour (hour);

-- The same activity per asset and local day, summed from the hours.
CREATE TABLE miot_fleet.asset_activity_day (
    asset_id VARCHAR(255) NOT NULL,
    day      DATE         NOT NULL,
    signals  INTEGER      NOT NULL,
    engine_s INTEGER      NOT NULL,
    idle_s   INTEGER      NOT NULL,
    moving_s INTEGER      NOT NULL,
    km       NUMERIC(10, 2) NOT NULL,
    PRIMARY KEY (asset_id, day)
);

CREATE INDEX idx_asset_activity_day_day ON miot_fleet.asset_activity_day (day);

CREATE TABLE miot_fleet.activity_cursor (
    name  VARCHAR(64) PRIMARY KEY,
    value TIMESTAMPTZ NOT NULL
);
