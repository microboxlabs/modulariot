-- ============================================================
-- V0.10.10 — trip monitors: versioned rules that say which event moves which
-- stage of a trip, for one class of trip of a tenant.
--   trip_monitor:          one row per version; at most one draft per monitor.
--   trip_monitor_selector: ordered (condition, monitor) pairs that pick the
--                          monitor of a trip created without one.
-- ============================================================

CREATE TABLE miot_trips.trip_monitor (
    tenant_code   VARCHAR(128) NOT NULL,
    monitor_key   VARCHAR(64)  NOT NULL CHECK (monitor_key ~ '^[a-z0-9][a-z0-9-]*$'),
    version       INT          NOT NULL CHECK (version > 0),
    status        VARCHAR(16)  NOT NULL CHECK (status IN ('draft', 'published')),
    name          VARCHAR(255) NOT NULL,
    description   TEXT,
    plan          JSONB        NOT NULL DEFAULT '[]',
    params        JSONB        NOT NULL DEFAULT '{}',
    rules         JSONB        NOT NULL DEFAULT '[]',
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by    VARCHAR(255) NOT NULL,
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by    VARCHAR(255),
    published_at  TIMESTAMPTZ,
    published_by  VARCHAR(255),
    PRIMARY KEY (tenant_code, monitor_key, version)
);
CREATE UNIQUE INDEX uq_trip_monitor_draft ON miot_trips.trip_monitor (tenant_code, monitor_key)
    WHERE status = 'draft';

CREATE TABLE miot_trips.trip_monitor_selector (
    tenant_code  VARCHAR(128) NOT NULL,
    seq          INT          NOT NULL CHECK (seq > 0),
    condition    TEXT         NOT NULL,
    monitor_key  VARCHAR(64)  NOT NULL,
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by   VARCHAR(255),
    PRIMARY KEY (tenant_code, seq)
);
