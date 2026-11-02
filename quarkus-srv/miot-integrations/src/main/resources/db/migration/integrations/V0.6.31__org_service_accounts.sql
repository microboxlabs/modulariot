-- One Google service account per organization, created by the platform in the
-- organizations' project. It has no key: the platform impersonates it for a
-- short-lived token. `tenant_code` is the organization's tenant client id.
CREATE TABLE miot_integrations.org_service_accounts (
    tenant_code VARCHAR(128) PRIMARY KEY,
    project_id  VARCHAR(30)  NOT NULL,
    account_id  VARCHAR(30)  NOT NULL,
    email       VARCHAR(256) NOT NULL UNIQUE,
    unique_id   VARCHAR(32)  NOT NULL,
    disabled    BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by  VARCHAR(256),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by  VARCHAR(256),
    UNIQUE (project_id, account_id)
);
