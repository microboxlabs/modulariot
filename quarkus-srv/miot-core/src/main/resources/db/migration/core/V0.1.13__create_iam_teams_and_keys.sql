-- Teams: groups of members inside one organization. A role binding with
-- principal_kind TEAM grants its role to every member of the team.
CREATE TABLE miot_iam.iam_team (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id BIGINT       NOT NULL REFERENCES miot_core.organizations (id) ON DELETE CASCADE,
    name            VARCHAR(120) NOT NULL,
    description     TEXT,
    source          VARCHAR(16)  NOT NULL DEFAULT 'NATIVE',
    external_ref    VARCHAR(255),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by      VARCHAR(255),
    CONSTRAINT chk_iam_team_source CHECK (source IN ('NATIVE', 'ALFRESCO', 'SCIM'))
);
CREATE UNIQUE INDEX ux_iam_team_name ON miot_iam.iam_team (organization_id, lower(name));

CREATE TABLE miot_iam.iam_team_member (
    team_id UUID NOT NULL REFERENCES miot_iam.iam_team (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES miot_iam.iam_user (id) ON DELETE CASCADE,
    PRIMARY KEY (team_id, user_id)
);
CREATE INDEX idx_iam_team_member_user ON miot_iam.iam_team_member (user_id);

-- Service accounts: machine principals owned by an organization. They hold
-- module roles through bindings (principal_kind SERVICE_ACCOUNT) and
-- authenticate with API keys.
CREATE TABLE miot_iam.iam_service_account (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id BIGINT       NOT NULL REFERENCES miot_core.organizations (id) ON DELETE CASCADE,
    name            VARCHAR(120) NOT NULL,
    description     TEXT,
    disabled        BOOLEAN      NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by      VARCHAR(255)
);
CREATE UNIQUE INDEX ux_iam_service_account_name ON miot_iam.iam_service_account (organization_id, lower(name));

-- An API key is miot_sk_<key_id>_<secret>. Only the SHA-256 of the secret is
-- stored; the key is shown once when created.
CREATE TABLE miot_iam.iam_api_key (
    id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    service_account_id UUID         NOT NULL REFERENCES miot_iam.iam_service_account (id) ON DELETE CASCADE,
    key_id             VARCHAR(16)  NOT NULL UNIQUE,
    secret_hash        VARCHAR(64)  NOT NULL,
    name               VARCHAR(120),
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by         VARCHAR(255),
    expires_at         TIMESTAMPTZ,
    last_used_at       TIMESTAMPTZ,
    revoked_at         TIMESTAMPTZ
);
CREATE INDEX idx_iam_api_key_account ON miot_iam.iam_api_key (service_account_id);
