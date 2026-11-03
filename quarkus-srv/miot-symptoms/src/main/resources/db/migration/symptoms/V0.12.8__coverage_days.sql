-- The lost-signal shadow map, one row per sender, grid cell and UTC day, written by the daily coverage job from
-- asset_data. A day is replaced whole. The detector reads the last 30 days.

CREATE TABLE miot_symptoms.coverage_day (
    sender  VARCHAR(64)      NOT NULL,
    cell    VARCHAR(32)      NOT NULL,
    day     DATE             NOT NULL,
    frames  INTEGER          NOT NULL,
    delayed INTEGER          NOT NULL,
    missing DOUBLE PRECISION NOT NULL,
    CONSTRAINT pk_coverage_day PRIMARY KEY (sender, cell, day)
);

CREATE INDEX idx_coverage_day_day ON miot_symptoms.coverage_day (day);

CREATE TABLE miot_symptoms.coverage_sender_day (
    sender            VARCHAR(64)      NOT NULL,
    day               DATE             NOT NULL,
    frames            INTEGER          NOT NULL,
    delayed           INTEGER          NOT NULL,
    missing           DOUBLE PRECISION NOT NULL,
    median_delay_s    DOUBLE PRECISION,
    median_interval_s DOUBLE PRECISION,
    anomalous         BOOLEAN          NOT NULL DEFAULT false,
    CONSTRAINT pk_coverage_sender_day PRIMARY KEY (sender, day)
);

CREATE INDEX idx_coverage_sender_day_day ON miot_symptoms.coverage_sender_day (day);

-- The days the job finished, with or without frames, so a day with no frames is not read again.
CREATE TABLE miot_symptoms.coverage_run (
    day         DATE        NOT NULL,
    frames      BIGINT      NOT NULL,
    finished_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_coverage_run PRIMARY KEY (day)
);
