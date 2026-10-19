-- Organization access (IAM): users, memberships with one base role, and role
-- bindings that grant module roles. Replaces organization_role_assignments,
-- which is copied here and no longer written.

CREATE SCHEMA IF NOT EXISTS miot_iam;

-- A person, matched by email until their first sign-in records the subject.
CREATE TABLE miot_iam.iam_user (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    subject      VARCHAR(255) UNIQUE,
    email        VARCHAR(320) NOT NULL,
    name         VARCHAR(255),
    status       VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE',
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ,
    CONSTRAINT chk_iam_user_status CHECK (status IN ('ACTIVE', 'DISABLED'))
);
CREATE UNIQUE INDEX ux_iam_user_email ON miot_iam.iam_user (lower(email));

-- A user belongs to an organization with exactly one base role.
CREATE TABLE miot_iam.iam_membership (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id BIGINT       NOT NULL REFERENCES miot_core.organizations (id) ON DELETE CASCADE,
    user_id         UUID         NOT NULL REFERENCES miot_iam.iam_user (id) ON DELETE CASCADE,
    base_role       VARCHAR(16)  NOT NULL,
    status          VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE',
    source          VARCHAR(16)  NOT NULL DEFAULT 'NATIVE',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by      VARCHAR(255),
    UNIQUE (organization_id, user_id),
    CONSTRAINT chk_iam_membership_role CHECK (base_role IN ('OWNER', 'ADMIN', 'MEMBER')),
    CONSTRAINT chk_iam_membership_status CHECK (status IN ('ACTIVE', 'SUSPENDED')),
    CONSTRAINT chk_iam_membership_source CHECK (source IN ('NATIVE', 'ALFRESCO', 'INVITE', 'SCIM'))
);
CREATE INDEX idx_iam_membership_user ON miot_iam.iam_membership (user_id);

-- A principal holds a module role on a scope. principal_id is the user or team
-- uuid, the service account uuid, or an M2M client id.
CREATE TABLE miot_iam.iam_role_binding (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id BIGINT       NOT NULL REFERENCES miot_core.organizations (id) ON DELETE CASCADE,
    principal_kind  VARCHAR(16)  NOT NULL,
    principal_id    VARCHAR(255) NOT NULL,
    role_key        VARCHAR(96)  NOT NULL,
    scope_kind      VARCHAR(16)  NOT NULL DEFAULT 'ORGANIZATION',
    scope_id        VARCHAR(255) NOT NULL DEFAULT '',
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by      VARCHAR(255),
    UNIQUE (organization_id, principal_kind, principal_id, role_key, scope_kind, scope_id),
    CONSTRAINT chk_iam_binding_principal CHECK (principal_kind IN ('USER', 'TEAM', 'SERVICE_ACCOUNT', 'CLIENT')),
    CONSTRAINT chk_iam_binding_scope CHECK (scope_kind IN ('ORGANIZATION', 'SUB_ACCOUNT', 'RESOURCE'))
);
CREATE INDEX idx_iam_binding_principal ON miot_iam.iam_role_binding (principal_kind, principal_id);

-- Every change to memberships, roles, invitations and keys.
CREATE TABLE miot_iam.iam_audit_event (
    id              BIGSERIAL    PRIMARY KEY,
    organization_id BIGINT,
    actor           VARCHAR(255),
    action          VARCHAR(64)  NOT NULL,
    target          VARCHAR(320),
    detail          JSONB        NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_iam_audit_org ON miot_iam.iam_audit_event (organization_id, created_at DESC);

-- Where membership comes from: ALFRESCO (the org's group, as before) or NATIVE.
ALTER TABLE miot_core.organizations
    ADD COLUMN membership_source VARCHAR(16) NOT NULL DEFAULT 'ALFRESCO',
    ADD CONSTRAINT chk_organizations_membership_source CHECK (membership_source IN ('ALFRESCO', 'NATIVE'));

-- Copy organization_role_assignments. Email assignees become users; other
-- assignees (M2M client ids) become CLIENT bindings.
INSERT INTO miot_iam.iam_user (email)
SELECT DISTINCT lower(person_id)
FROM miot_core.organization_role_assignments
WHERE position('@' IN person_id) > 0
ON CONFLICT DO NOTHING;

INSERT INTO miot_iam.iam_membership (organization_id, user_id, base_role, source, created_by)
SELECT a.organization_id, u.id, 'OWNER', 'NATIVE', 'migration'
FROM miot_core.organization_role_assignments a
JOIN miot_iam.iam_user u ON lower(u.email) = lower(a.person_id)
WHERE a.role_code = 'ORGANIZATION_OWNER'
ON CONFLICT (organization_id, user_id) DO UPDATE SET base_role = 'OWNER';

INSERT INTO miot_iam.iam_membership (organization_id, user_id, base_role, source, created_by)
SELECT DISTINCT a.organization_id, u.id, 'MEMBER', 'NATIVE', 'migration'
FROM miot_core.organization_role_assignments a
JOIN miot_iam.iam_user u ON lower(u.email) = lower(a.person_id)
WHERE a.role_code <> 'ORGANIZATION_OWNER'
ON CONFLICT (organization_id, user_id) DO NOTHING;

INSERT INTO miot_iam.iam_role_binding (organization_id, principal_kind, principal_id, role_key, created_by)
SELECT a.organization_id, 'USER', u.id::text, a.role_code, 'migration'
FROM miot_core.organization_role_assignments a
JOIN miot_iam.iam_user u ON lower(u.email) = lower(a.person_id)
WHERE a.role_code <> 'ORGANIZATION_OWNER'
ON CONFLICT DO NOTHING;

INSERT INTO miot_iam.iam_role_binding (organization_id, principal_kind, principal_id, role_key, created_by)
SELECT a.organization_id, 'CLIENT', a.person_id, a.role_code, 'migration'
FROM miot_core.organization_role_assignments a
WHERE position('@' IN a.person_id) = 0 AND a.role_code <> 'ORGANIZATION_OWNER'
ON CONFLICT DO NOTHING;
