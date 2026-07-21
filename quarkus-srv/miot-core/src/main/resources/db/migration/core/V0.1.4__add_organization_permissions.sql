-- Modulith-owned organization permission settings and role assignments.
-- Alfresco is a projection target only; these tables are authoritative.
CREATE TABLE miot_core.organization_permission_settings (
    organization_id   BIGINT       NOT NULL REFERENCES miot_core.organizations(id) ON DELETE CASCADE,
    permission_code   VARCHAR(96)  NOT NULL,
    enabled           BOOLEAN      NOT NULL DEFAULT false,
    projection_status VARCHAR(16)  NOT NULL DEFAULT 'PENDING',
    projection_error  VARCHAR(500),
    projected_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (organization_id, permission_code),
    CONSTRAINT chk_org_permission_projection_status
        CHECK (projection_status IN ('PENDING', 'SYNCED', 'FAILED'))
);

CREATE TABLE miot_core.organization_role_assignments (
    organization_id BIGINT       NOT NULL REFERENCES miot_core.organizations(id) ON DELETE CASCADE,
    role_code       VARCHAR(96)  NOT NULL,
    person_id       VARCHAR(255) NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (organization_id, role_code, person_id)
);

CREATE INDEX idx_org_role_assignments_role
    ON miot_core.organization_role_assignments(role_code, organization_id);
