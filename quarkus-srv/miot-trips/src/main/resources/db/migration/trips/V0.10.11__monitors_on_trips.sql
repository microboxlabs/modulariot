-- ============================================================
-- V0.10.11 — trip monitors run on trips.
--   trip_monitor_state: the monitor version a trip follows and its epoch,
--                       raised on every evaluation so stale timers are dropped.
--   trip_timer:         due times of the monitor's timer rules; the clock
--                       claims the due ones with SKIP LOCKED. A fired row stays,
--                       so the same rule and time do not fire twice.
--   trip_transition:    what each event did: the rules that matched, the
--                       stage before and after, the actions, the error.
-- ============================================================

CREATE TABLE miot_trips.trip_monitor_state (
    trip_id          UUID         PRIMARY KEY REFERENCES miot_trips.trip (id) ON DELETE CASCADE,
    tenant_code      VARCHAR(128) NOT NULL,
    monitor_key      VARCHAR(64)  NOT NULL,
    monitor_version  INT          NOT NULL,
    epoch            INT          NOT NULL DEFAULT 0,
    bound_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    bound_by         VARCHAR(255),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_trip_monitor_state_monitor ON miot_trips.trip_monitor_state (tenant_code, monitor_key);

CREATE TABLE miot_trips.trip_timer (
    id               BIGSERIAL    PRIMARY KEY,
    tenant_code      VARCHAR(128) NOT NULL,
    trip_id          UUID         NOT NULL REFERENCES miot_trips.trip (id) ON DELETE CASCADE,
    rule_key         VARCHAR(64)  NOT NULL,
    monitor_version  INT          NOT NULL,
    due_at           TIMESTAMPTZ  NOT NULL,
    epoch            INT          NOT NULL,
    claimed_until    TIMESTAMPTZ,
    fired_at         TIMESTAMPTZ,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_trip_timer_due ON miot_trips.trip_timer (due_at) WHERE fired_at IS NULL;
CREATE INDEX idx_trip_timer_trip ON miot_trips.trip_timer (trip_id);

CREATE TABLE miot_trips.trip_transition (
    id               BIGSERIAL    PRIMARY KEY,
    tenant_code      VARCHAR(128) NOT NULL,
    trip_id          UUID         NOT NULL REFERENCES miot_trips.trip (id) ON DELETE CASCADE,
    monitor_key      VARCHAR(64)  NOT NULL,
    monitor_version  INT          NOT NULL,
    event            JSONB        NOT NULL,
    depth            INT          NOT NULL DEFAULT 0,
    matched          VARCHAR(64)[] NOT NULL DEFAULT '{}',
    rule_key         VARCHAR(64),
    from_stage       VARCHAR(32),
    to_stage         VARCHAR(32),
    actions          JSONB        NOT NULL DEFAULT '[]',
    error            TEXT,
    at               TIMESTAMPTZ  NOT NULL,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_trip_transition_trip ON miot_trips.trip_transition (trip_id, id);
