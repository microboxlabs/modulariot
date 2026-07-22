-- Interaction episodes: append-only telemetry of user<->agent sessions (spotlight
-- search + CLI chat) for the semantic-layer continual-learning loop. Raw signal —
-- the query, the run's route/tools/answer, ground-or-flag assumptions, and the
-- user-side reaction (clicked result / rephrase / correction / remember). A
-- background distiller (later phase) mines these into candidate business-semantics
-- facts. NOT a job ledger: write-once, no retry/claim/lease. See the semantic-layer
-- continual-learning design.
CREATE TABLE miot_integrations.interaction_episodes (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    BIGINT REFERENCES miot_core.tenants(id),
    tenant_code  VARCHAR(128) NOT NULL,
    user_id      VARCHAR(256),
    surface      VARCHAR(32)  NOT NULL,
    run_id       VARCHAR(128),
    signal       VARCHAR(32),
    payload      JSONB        NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_interaction_episodes_surface CHECK (
        surface IN ('spotlight', 'cli')
    )
);

-- Distiller + review listing: newest episodes per tenant.
CREATE INDEX idx_interaction_episodes_tenant_created
    ON miot_integrations.interaction_episodes(tenant_code, created_at DESC);
-- Correlate an episode back to its harness run (route/tools/assumptions).
CREATE INDEX idx_interaction_episodes_run
    ON miot_integrations.interaction_episodes(run_id)
    WHERE run_id IS NOT NULL;
