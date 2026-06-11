-- Async job ledger: durable record + control plane for jobs executed by external
-- workers (e.g. ECM delivery integrations). The source system's state remains the
-- source of truth; this table is the auditable ledger that drives retries and the
-- babysitter UI. See ecm-coordinator docs/architecture/integration-outbox.md.
CREATE TABLE miot_integrations.async_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       BIGINT REFERENCES miot_core.tenants(id),
    tenant_code     VARCHAR(128) NOT NULL,
    source_instance VARCHAR(128) NOT NULL,
    executor        VARCHAR(64)  NOT NULL DEFAULT 'ecm',
    job_type        VARCHAR(64)  NOT NULL,
    correlation_key VARCHAR(255),
    chain_key       VARCHAR(512),
    chain_sequence  INTEGER      NOT NULL DEFAULT 0,
    dedupe_key      VARCHAR(640),
    payload         JSONB        NOT NULL DEFAULT '{}'::jsonb,
    state           VARCHAR(32)  NOT NULL DEFAULT 'PENDING',
    attempts        INTEGER      NOT NULL DEFAULT 0,
    max_attempts    INTEGER      NOT NULL DEFAULT 5,
    next_retry_at   TIMESTAMPTZ,
    locked_by       VARCHAR(128),
    locked_until    TIMESTAMPTZ,
    last_error      TEXT,
    attempt_history JSONB        NOT NULL DEFAULT '[]'::jsonb,
    enqueued_by     VARCHAR(32)  NOT NULL DEFAULT 'listener',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_async_jobs_state CHECK (
        state IN ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED')
    ),
    CONSTRAINT chk_async_jobs_enqueued_by CHECK (
        enqueued_by IN ('listener', 'reconciler', 'manual')
    )
);

-- Idempotent enqueue: listener and reconciler converge on the same deterministic key.
CREATE UNIQUE INDEX idx_async_jobs_dedupe
    ON miot_integrations.async_jobs(dedupe_key)
    WHERE dedupe_key IS NOT NULL;
-- Worker claim scan.
CREATE INDEX idx_async_jobs_claim
    ON miot_integrations.async_jobs(executor, state, next_retry_at)
    WHERE state IN ('PENDING', 'RUNNING');
-- Chain-ordering gate.
CREATE INDEX idx_async_jobs_chain
    ON miot_integrations.async_jobs(chain_key, chain_sequence)
    WHERE chain_key IS NOT NULL;
CREATE INDEX idx_async_jobs_correlation
    ON miot_integrations.async_jobs(correlation_key);
-- Babysitter UI listing.
CREATE INDEX idx_async_jobs_tenant_created
    ON miot_integrations.async_jobs(tenant_code, created_at DESC);
