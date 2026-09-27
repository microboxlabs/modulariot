-- Tokens each harness run used, per model, for charging organizations.
-- The harness reports once per run; (run_id, provider, model) is unique so a
-- retried report is not counted twice.
--
-- Prices are copied from model_providers when the row is written, so a later
-- price change does not alter past charges. cost_usd is null when the model
-- had no price at that time.
CREATE TABLE miot_integrations.model_usage (
    id                  BIGSERIAL PRIMARY KEY,
    run_id              VARCHAR(128) NOT NULL,
    organization        VARCHAR(128),
    tenant_id           VARCHAR(128) NOT NULL,
    user_id             VARCHAR(256),
    provider            VARCHAR(32) NOT NULL,
    model               VARCHAR(128) NOT NULL,
    calls               INTEGER NOT NULL,
    input_tokens        BIGINT NOT NULL,
    output_tokens       BIGINT NOT NULL,
    cache_read_tokens   BIGINT NOT NULL,
    cache_write_tokens  BIGINT NOT NULL,
    input_per_mtok      NUMERIC(12, 6),
    output_per_mtok     NUMERIC(12, 6),
    cost_usd            NUMERIC(16, 8),
    recorded_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (run_id, provider, model)
);

CREATE INDEX model_usage_org_recorded_idx
    ON miot_integrations.model_usage (organization, recorded_at);
