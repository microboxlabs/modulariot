-- Files the modules keep: photos, signed documents, attachments. The bytes
-- live in a content store; content_url names it by its scheme (fs://, gcs://).
-- A row without an owner is deleted by the cleanup after a grace period.
CREATE TABLE miot_core.content (
    id           UUID          PRIMARY KEY,
    tenant_code  VARCHAR(128)  NOT NULL,
    content_url  VARCHAR(1024) NOT NULL,
    name         VARCHAR(255),
    mimetype     VARCHAR(128)  NOT NULL,
    size         BIGINT        NOT NULL,
    sha256       CHAR(64)      NOT NULL,
    owner        VARCHAR(255),
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_by   VARCHAR(255)
);
CREATE INDEX idx_content_tenant ON miot_core.content (tenant_code, created_at);
CREATE INDEX idx_content_unowned ON miot_core.content (created_at) WHERE owner IS NULL;
