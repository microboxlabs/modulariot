-- Per-domain branding owned by the modulith, independent of any ECM repository.
-- One row per host. No row (or active = false) means the caller falls back to
-- the application's bundled default logo.
CREATE TABLE miot_core.domain_branding (
    id           BIGSERIAL     PRIMARY KEY,
    -- 253 is the maximum length of a DNS name. Stored already normalized:
    -- lower-cased, port stripped, no trailing dot.
    domain       VARCHAR(253)  NOT NULL UNIQUE,
    logo_content BYTEA         NOT NULL,
    logo_mime    VARCHAR(64)   NOT NULL,
    -- Hex SHA-256 of logo_mime, a newline, then logo_content -- see
    -- LogoImage.etagOf. The mime is part of the digest because it is part of
    -- the response, so the same bytes served as a different Content-Type must
    -- not reuse a validator. Anything backfilling this column has to hash the
    -- same input. Served as the ETag, and busts the browser cache when the
    -- image changes but the URL does not.
    logo_etag    VARCHAR(64)   NOT NULL,
    home_url     VARCHAR(2048),
    active       BOOLEAN       NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_by   VARCHAR(255),
    CONSTRAINT chk_domain_branding_mime
        CHECK (logo_mime IN ('image/svg+xml', 'image/png', 'image/jpeg', 'image/webp'))
);
