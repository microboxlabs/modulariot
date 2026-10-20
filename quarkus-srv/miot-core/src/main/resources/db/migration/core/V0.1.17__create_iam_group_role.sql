-- Which module role an Alfresco group stands for, per top-level organization.
-- The import turns group members into role bindings. When projected is true,
-- the role's holders are kept in the group, for the BPM candidate groups.
-- Members of excluded_group_id are skipped by the import.
CREATE TABLE miot_iam.iam_group_role (
    id              BIGSERIAL    PRIMARY KEY,
    organization_id BIGINT       NOT NULL REFERENCES miot_core.organizations (id) ON DELETE CASCADE,
    group_id        VARCHAR(255) NOT NULL,
    role_key        VARCHAR(96)  NOT NULL,
    projected       BOOLEAN      NOT NULL DEFAULT false,
    excluded_group_id VARCHAR(255),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by      VARCHAR(320),
    UNIQUE (organization_id, group_id, role_key)
);
