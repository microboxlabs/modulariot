-- Outbox for StreamHub signal retransmit (MEL/Gauss and future named configs).
-- Match evaluation lives on the GPS DB (process_enriched_position_retransmit);
-- durable HTTP delivery lives here so Pulsar ack is decoupled from destination latency.

CREATE TABLE miot_integrations.retransmit_deliveries (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id         VARCHAR(128) NOT NULL,
    asset_id          TEXT         NOT NULL,
    dedupe_key        VARCHAR(640),
    destination_url   TEXT         NOT NULL,
    payload           JSONB        NOT NULL DEFAULT '{}'::jsonb,
    state             VARCHAR(32)  NOT NULL DEFAULT 'PENDING',
    attempts          INTEGER      NOT NULL DEFAULT 0,
    max_attempts      INTEGER      NOT NULL DEFAULT 5,
    next_retry_at     TIMESTAMPTZ,
    last_status_code  INTEGER,
    last_error        TEXT,
    locked_by         VARCHAR(128),
    locked_until      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_retransmit_deliveries_state CHECK (
        state IN ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'DEAD')
    )
);

CREATE UNIQUE INDEX idx_retransmit_deliveries_dedupe
    ON miot_integrations.retransmit_deliveries(dedupe_key)
    WHERE dedupe_key IS NOT NULL;

CREATE INDEX idx_retransmit_deliveries_claim
    ON miot_integrations.retransmit_deliveries(state, next_retry_at)
    WHERE state IN ('PENDING', 'RUNNING');

CREATE INDEX idx_retransmit_deliveries_config_created
    ON miot_integrations.retransmit_deliveries(config_id, created_at DESC);

CREATE INDEX idx_retransmit_deliveries_asset_created
    ON miot_integrations.retransmit_deliveries(asset_id, created_at DESC);
