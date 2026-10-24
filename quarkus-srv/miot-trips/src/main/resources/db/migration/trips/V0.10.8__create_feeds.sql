-- ============================================================
-- V0.10.8 — trip feeds: an external source (a spreadsheet, a TMS) sends the
-- desired state of each service and the trips module reconciles it.
--   feed_profile: the rules of one feed of one tenant (stage plan, when the
--                 trip departs and closes, which resources are required).
--   feed_service: the last desired state accepted per external service, and
--                 the mandate and trip it maps to; open rows are re-checked
--                 by the clock (departure, close) without a new send.
-- ============================================================

CREATE TABLE miot_trips.feed_profile (
    tenant_code              VARCHAR(128) NOT NULL,
    feed_key                 VARCHAR(64)  NOT NULL CHECK (feed_key ~ '^[a-z0-9][a-z0-9-]*$'),
    name                     VARCHAR(255) NOT NULL,
    stages                   JSONB        NOT NULL,
    departure_stage          VARCHAR(32)  NOT NULL,
    close_stage              VARCHAR(32)  NOT NULL,
    close_tolerance_minutes  INT          NOT NULL DEFAULT 120 CHECK (close_tolerance_minutes >= 0),
    required_resources       VARCHAR(16)[] NOT NULL DEFAULT '{truck,driver}',
    active                   BOOLEAN      NOT NULL DEFAULT true,
    created_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by               VARCHAR(255) NOT NULL,
    updated_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by               VARCHAR(255),
    PRIMARY KEY (tenant_code, feed_key)
);

CREATE TABLE miot_trips.feed_service (
    tenant_code         VARCHAR(128) NOT NULL,
    feed_key            VARCHAR(64)  NOT NULL,
    external_code       VARCHAR(128) NOT NULL,
    desired             JSONB        NOT NULL,
    desired_hash        VARCHAR(64)  NOT NULL,
    mandate_id          UUID,
    trip_id             UUID,
    open                BOOLEAN      NOT NULL DEFAULT true,
    last_action         VARCHAR(32),
    last_result         JSONB,
    last_reconciled_at  TIMESTAMPTZ,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_code, feed_key, external_code),
    FOREIGN KEY (tenant_code, feed_key) REFERENCES miot_trips.feed_profile (tenant_code, feed_key)
);
CREATE INDEX idx_feed_service_open ON miot_trips.feed_service (last_reconciled_at) WHERE open;
