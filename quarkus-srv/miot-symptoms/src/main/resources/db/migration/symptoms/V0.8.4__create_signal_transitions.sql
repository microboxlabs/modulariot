-- Case changes the symptom evaluator found on GPS signals: opened, level changed or closed.
-- TEST rows are shadow counts; ACTIVE rows are the ones that open cases.

CREATE TABLE miot_symptoms.signal_transitions (
    id             BIGSERIAL PRIMARY KEY,
    tenant_code    VARCHAR(128)     NOT NULL,
    definition_id  UUID             NOT NULL,
    version        VARCHAR(32)      NOT NULL,
    state          VARCHAR(16)      NOT NULL,
    kind           VARCHAR(16)      NOT NULL,
    asset_id       VARCHAR(64)      NOT NULL,
    at             TIMESTAMPTZ      NOT NULL,
    level          INTEGER          NOT NULL,
    previous_level INTEGER          NOT NULL,
    measure        DOUBLE PRECISION NOT NULL,
    created_at     TIMESTAMPTZ      NOT NULL DEFAULT now(),
    CONSTRAINT chk_signal_transitions_kind CHECK (kind IN ('OPENED', 'LEVEL_CHANGED', 'CLOSED'))
);

CREATE INDEX idx_signal_transitions_tenant_at ON miot_symptoms.signal_transitions (tenant_code, at DESC);
CREATE INDEX idx_signal_transitions_definition_at ON miot_symptoms.signal_transitions (definition_id, at DESC);
