-- Per-organization option lists behind form fields, and which field uses which
-- list (SelectableService). Keyed by the tenant code the request resolves to.

-- A row means the tenant already got the default lists. It stays when every
-- list is deleted, so the defaults come back only through an explicit reset.
CREATE TABLE miot_core.selectable_tenants (
    tenant_code VARCHAR(255) PRIMARY KEY,
    seeded_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE miot_core.selectables (
    -- Creation order; a replace keeps it, so lists do not move when edited.
    id          BIGSERIAL    NOT NULL UNIQUE,
    tenant_code VARCHAR(255) NOT NULL,
    key         VARCHAR(64)  NOT NULL,
    name        TEXT         NOT NULL,
    description TEXT,
    mode        VARCHAR(16)  NOT NULL,
    -- [{"id", "name", "description"}], replaced whole on every write.
    options     JSONB        NOT NULL DEFAULT '[]',
    updated_by  VARCHAR(255),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_code, key),
    CONSTRAINT chk_selectables_mode CHECK (mode IN ('SINGLE', 'MULTIPLE'))
);

-- A binding cannot outlive its list: deleting a list removes the bindings that
-- pointed at it, and binding to a list that does not exist fails.
CREATE TABLE miot_core.selectable_bindings (
    tenant_code    VARCHAR(255) NOT NULL,
    field_key      VARCHAR(64)  NOT NULL,
    selectable_key VARCHAR(64)  NOT NULL,
    PRIMARY KEY (tenant_code, field_key),
    CONSTRAINT fk_selectable_bindings_selectable
        FOREIGN KEY (tenant_code, selectable_key)
        REFERENCES miot_core.selectables (tenant_code, key) ON DELETE CASCADE
);
