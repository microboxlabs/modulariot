-- Email domains whose people become members of a top-level organization when
-- they first sign in with a verified email. A domain belongs to one organization.
CREATE TABLE miot_iam.iam_member_domain (
    id              BIGSERIAL    PRIMARY KEY,
    organization_id BIGINT       NOT NULL REFERENCES miot_core.organizations (id) ON DELETE CASCADE,
    domain          VARCHAR(253) NOT NULL UNIQUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by      VARCHAR(320)
);

ALTER TABLE miot_iam.iam_membership DROP CONSTRAINT chk_iam_membership_source;
ALTER TABLE miot_iam.iam_membership ADD CONSTRAINT chk_iam_membership_source
    CHECK (source IN ('NATIVE', 'ALFRESCO', 'INVITE', 'SCIM', 'TOKEN', 'DOMAIN'));
