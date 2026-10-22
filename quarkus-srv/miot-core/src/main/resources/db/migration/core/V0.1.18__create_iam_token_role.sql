-- Role ids that a sign-in token carries (for example Entra ID app roles), per
-- top-level organization. role_key is a module role, or OWNER / ADMIN / MEMBER
-- for the base role.
CREATE TABLE miot_iam.iam_token_role (
    id              BIGSERIAL    PRIMARY KEY,
    organization_id BIGINT       NOT NULL REFERENCES miot_core.organizations (id) ON DELETE CASCADE,
    external_id     VARCHAR(64)  NOT NULL,
    role_key        VARCHAR(96)  NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by      VARCHAR(320),
    UNIQUE (organization_id, external_id)
);

-- Where a binding or membership came from. TOKEN rows are rewritten from the
-- caller's token at sign-in; the others are managed by people.
ALTER TABLE miot_iam.iam_role_binding ADD COLUMN source VARCHAR(16) NOT NULL DEFAULT 'MANUAL';

ALTER TABLE miot_iam.iam_membership DROP CONSTRAINT chk_iam_membership_source;
ALTER TABLE miot_iam.iam_membership ADD CONSTRAINT chk_iam_membership_source
    CHECK (source IN ('NATIVE', 'ALFRESCO', 'INVITE', 'SCIM', 'TOKEN'));
