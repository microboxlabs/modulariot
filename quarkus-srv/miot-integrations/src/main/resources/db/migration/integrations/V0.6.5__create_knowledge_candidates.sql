-- Knowledge candidates: the human-gated STAGING store of the semantic-layer
-- continual-learning loop. A candidate is a proposed business-semantics fact —
-- authored via /remember, elicited on a grounding.gap, or (later) distilled from
-- interaction_episodes — awaiting review. On APPROVE the app writes it to the
-- harness as a connection-scoped card (the harness POST /connections/{c}/knowledge
-- seam); this table only holds the proposal + its review decision. The `body`
-- records the MEANING of a term (which task_def_keys count as "entregas"), never
-- row-level secret values. See the semantic-layer continual-learning design.
CREATE TABLE miot_integrations.knowledge_candidates (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     BIGINT REFERENCES miot_core.tenants(id),
    tenant_code   VARCHAR(128) NOT NULL,
    connection    VARCHAR(128) NOT NULL,
    term          VARCHAR(256) NOT NULL,
    kind          VARCHAR(32),
    scope         VARCHAR(64)  NOT NULL DEFAULT 'tenant',
    confidence    DOUBLE PRECISION,
    body          TEXT         NOT NULL,
    provenance    JSONB        NOT NULL DEFAULT '{}'::jsonb,
    status        VARCHAR(16)  NOT NULL DEFAULT 'pending',
    created_by    VARCHAR(256),
    reviewed_by   VARCHAR(256),
    reviewed_at   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_knowledge_candidates_status CHECK (
        status IN ('pending', 'approved', 'rejected')
    )
);

-- Review queue: pending candidates per tenant, newest first (the review UI's
-- default listing). The status prefix keeps the approved/rejected history out of
-- the hot path.
CREATE INDEX idx_knowledge_candidates_tenant_status
    ON miot_integrations.knowledge_candidates(tenant_code, status, created_at DESC);
