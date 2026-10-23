-- A case that stayed unattended past its level's SLA: one row per case and level, so the SLA timer publishes
-- symptom.case.sla_expired once. case_id is the case's OPENED transition id (signal_transitions.id).

CREATE TABLE miot_symptoms.sla_expiry (
    tenant_code VARCHAR(128) NOT NULL,
    case_id     BIGINT       NOT NULL,
    level       INTEGER      NOT NULL,
    sla_minutes INTEGER      NOT NULL,
    expired_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT pk_sla_expiry PRIMARY KEY (tenant_code, case_id, level)
);

-- The timer reads the recent ACTIVE OPENED rows on every run.
CREATE INDEX idx_signal_transitions_active_opened
    ON miot_symptoms.signal_transitions (at) WHERE kind = 'OPENED' AND state = 'ACTIVE';
