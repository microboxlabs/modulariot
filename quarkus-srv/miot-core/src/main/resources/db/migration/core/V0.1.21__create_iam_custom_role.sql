-- Roles an organization defines for itself: a name and a set of permissions
-- from the access catalog. role_key is 'custom:<slug>', so it never equals a
-- module role key (UPPER_SNAKE). Bindings name it in iam_role_binding.role_key
-- like any other role. Custom roles belong to the top-level organization.
-- permission_keys is a comma-separated list of permission keys.
CREATE TABLE miot_iam.iam_custom_role (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id BIGINT       NOT NULL REFERENCES miot_core.organizations (id) ON DELETE CASCADE,
    role_key        VARCHAR(96)  NOT NULL,
    name_es         VARCHAR(80)  NOT NULL,
    name_en         VARCHAR(80)  NOT NULL,
    description_es  VARCHAR(500),
    description_en  VARCHAR(500),
    permission_keys TEXT         NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by      VARCHAR(320),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by      VARCHAR(320),
    UNIQUE (organization_id, role_key),
    CONSTRAINT chk_iam_custom_role_key CHECK (role_key ~ '^custom:[a-z0-9]+(-[a-z0-9]+)*$')
);
CREATE UNIQUE INDEX ux_iam_custom_role_name_es ON miot_iam.iam_custom_role (organization_id, lower(name_es));
CREATE UNIQUE INDEX ux_iam_custom_role_name_en ON miot_iam.iam_custom_role (organization_id, lower(name_en));
