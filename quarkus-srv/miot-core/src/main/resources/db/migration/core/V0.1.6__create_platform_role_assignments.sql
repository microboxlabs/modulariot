-- Platform-scope roles, which belong to no organization.
-- organization_role_assignments cannot hold these: its organization_id is NOT
-- NULL with an FK, and a platform role spans every organization.
CREATE TABLE miot_core.platform_role_assignments (
    role_code  VARCHAR(96)  NOT NULL,
    -- The caller's email, lower-cased, matching the JWT claim PlatformAuthorizer reads.
    person_id  VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by VARCHAR(255),
    PRIMARY KEY (role_code, person_id)
);
