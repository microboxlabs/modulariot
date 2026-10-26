-- ============================================================
-- V0.10.18 — the team that confirms each milestone of a monitor's trips.
--   One row per tenant, monitor and milestone. Not versioned with the
--   monitor: changing a team applies to its open trips at once. No row
--   means anyone with trips:milestone.confirm confirms.
-- ============================================================

CREATE TABLE miot_trips.milestone_confirmer (
    tenant_code   VARCHAR(128) NOT NULL,
    monitor_key   VARCHAR(64)  NOT NULL,
    milestone     VARCHAR(16)  NOT NULL CHECK (milestone IN ('departure', 'arrival', 'closure')),
    team_id       UUID         NOT NULL,
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by    VARCHAR(255),
    PRIMARY KEY (tenant_code, monitor_key, milestone)
);
