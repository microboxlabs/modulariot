-- Invitations: a pending membership for an email. The token is stored as a
-- SHA-256 hash; the link with the token is shown once, when created or resent.
CREATE TABLE miot_iam.iam_invitation (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id BIGINT       NOT NULL REFERENCES miot_core.organizations (id) ON DELETE CASCADE,
    email           VARCHAR(320) NOT NULL,
    base_role       VARCHAR(16)  NOT NULL,
    role_keys       TEXT         NOT NULL DEFAULT '', -- comma-separated module role keys
    token_hash      VARCHAR(64)  NOT NULL UNIQUE,
    status          VARCHAR(16)  NOT NULL DEFAULT 'PENDING',
    expires_at      TIMESTAMPTZ  NOT NULL,
    invited_by      VARCHAR(255),
    accepted_by     UUID         REFERENCES miot_iam.iam_user (id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_iam_invitation_role CHECK (base_role IN ('OWNER', 'ADMIN', 'MEMBER')),
    CONSTRAINT chk_iam_invitation_status CHECK (status IN ('PENDING', 'ACCEPTED', 'REVOKED'))
);
-- One pending invitation per email and organization.
CREATE UNIQUE INDEX ux_iam_invitation_pending
    ON miot_iam.iam_invitation (organization_id, lower(email)) WHERE status = 'PENDING';
CREATE INDEX idx_iam_invitation_email ON miot_iam.iam_invitation (lower(email)) WHERE status = 'PENDING';
