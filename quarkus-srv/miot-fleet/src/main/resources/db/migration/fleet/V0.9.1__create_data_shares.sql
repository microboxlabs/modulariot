-- Data shares: which organization sees another organization's GPS assets. Only platform owners create or revoke
-- them. asset_client_map in the GPS database is rebuilt from the active ones.

CREATE TABLE miot_fleet.data_share (
    id          UUID         PRIMARY KEY,
    source_org  VARCHAR(128) NOT NULL,
    target_org  VARCHAR(128) NOT NULL,
    scope       VARCHAR(16)  NOT NULL,
    -- FILTER only: the signal's owner and type values to match; an empty list matches any value.
    owners      JSONB        NOT NULL DEFAULT '[]',
    kinds       JSONB        NOT NULL DEFAULT '[]',
    origin      VARCHAR(16)  NOT NULL,
    valid_from  TIMESTAMPTZ  NOT NULL,
    valid_to    TIMESTAMPTZ,
    note        TEXT,
    created_by  VARCHAR(255) NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    revoked_at  TIMESTAMPTZ,
    revoked_by  VARCHAR(255),
    CONSTRAINT chk_data_share_scope CHECK (scope IN ('ALL', 'FILTER', 'ASSETS')),
    CONSTRAINT chk_data_share_origin CHECK (origin IN ('MANUAL', 'TRIP', 'ACCREDITATION')),
    CONSTRAINT chk_data_share_orgs CHECK (source_org <> target_org),
    CONSTRAINT chk_data_share_dates CHECK (valid_to IS NULL OR valid_to > valid_from)
);

CREATE INDEX idx_data_share_source ON miot_fleet.data_share (source_org);
CREATE INDEX idx_data_share_target ON miot_fleet.data_share (target_org);

-- ASSETS only: the listed assets.
CREATE TABLE miot_fleet.data_share_asset (
    share_id UUID         NOT NULL REFERENCES miot_fleet.data_share (id) ON DELETE CASCADE,
    asset_id VARCHAR(255) NOT NULL,
    PRIMARY KEY (share_id, asset_id)
);
