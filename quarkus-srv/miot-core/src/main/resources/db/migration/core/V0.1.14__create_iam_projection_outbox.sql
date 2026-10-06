-- Changes to send to Alfresco for organizations whose membership is native
-- but whose Alfresco group must stay in step (BPM pooled tasks, document
-- permissions). A worker sends PENDING rows and retries failures.
CREATE TABLE miot_iam.iam_projection_outbox (
    id              BIGSERIAL    PRIMARY KEY,
    organization_id BIGINT       NOT NULL REFERENCES miot_core.organizations (id) ON DELETE CASCADE,
    kind            VARCHAR(32)  NOT NULL,
    group_id        VARCHAR(255) NOT NULL,
    subject         VARCHAR(320) NOT NULL,
    status          VARCHAR(16)  NOT NULL DEFAULT 'PENDING',
    attempts        INTEGER      NOT NULL DEFAULT 0,
    last_error      VARCHAR(1000),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_iam_projection_kind CHECK (kind IN ('MEMBER_ADDED', 'MEMBER_REMOVED')),
    CONSTRAINT chk_iam_projection_status CHECK (status IN ('PENDING', 'SYNCED', 'FAILED'))
);
CREATE INDEX idx_iam_projection_pending ON miot_iam.iam_projection_outbox (status, id) WHERE status = 'PENDING';
