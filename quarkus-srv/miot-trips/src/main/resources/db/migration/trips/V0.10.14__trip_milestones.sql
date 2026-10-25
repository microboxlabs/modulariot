-- ============================================================
-- V0.10.14 — trip milestones: departure, arrival and closure.
--   A detection (GPS, ETA) leaves a milestone pending; a person
--   confirms or rejects it (feed, notice reply, UI). Only a
--   confirmation reaches the trip's monitor as a command event.
--   No row means the milestone is still open.
-- ============================================================

CREATE TABLE miot_trips.trip_milestone (
    trip_id       UUID         NOT NULL REFERENCES miot_trips.trip (id) ON DELETE CASCADE,
    milestone     VARCHAR(16)  NOT NULL CHECK (milestone IN ('departure', 'arrival', 'closure')),
    tenant_code   VARCHAR(128) NOT NULL,
    status        VARCHAR(16)  NOT NULL CHECK (status IN ('pending', 'confirmed', 'rejected')),
    source        VARCHAR(32),
    proposed_at   TIMESTAMPTZ,
    evidence      JSONB        NOT NULL DEFAULT '{}',
    confirmed_at  TIMESTAMPTZ,
    confirmed_by  VARCHAR(255),
    channel       VARCHAR(16),
    note          TEXT,
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by    VARCHAR(255),
    PRIMARY KEY (trip_id, milestone)
);
CREATE INDEX idx_trip_milestone_pending ON miot_trips.trip_milestone (tenant_code, status)
    WHERE status = 'pending';
