-- A second, optional logo for dark backgrounds.
--
-- One logo cannot serve both: a wordmark drawn in dark ink disappears on the
-- dark sign-in navbar, and its light counterpart disappears on the light one.
-- Brands that care ship two files. The column is nullable because most domains
-- do not: a row without it serves the same logo on both, which is what every
-- existing row does today.
ALTER TABLE miot_core.domain_branding
    ADD COLUMN logo_dark_content BYTEA,
    ADD COLUMN logo_dark_mime    VARCHAR(64),
    -- Same digest as logo_etag, over this variant's mime and bytes.
    ADD COLUMN logo_dark_etag    VARCHAR(64);

-- All three together or none of them. Bytes with no mime cannot be served with
-- a Content-Type, and bytes with no digest cannot be given a validator, so a
-- half-written variant would be worse than an absent one.
ALTER TABLE miot_core.domain_branding
    ADD CONSTRAINT chk_domain_branding_dark_complete CHECK (
        (logo_dark_content IS NULL
            AND logo_dark_mime IS NULL
            AND logo_dark_etag IS NULL)
        OR (logo_dark_content IS NOT NULL
            AND logo_dark_mime IS NOT NULL
            AND logo_dark_etag IS NOT NULL));

ALTER TABLE miot_core.domain_branding
    ADD CONSTRAINT chk_domain_branding_dark_mime CHECK (
        logo_dark_mime IS NULL
        OR logo_dark_mime IN ('image/svg+xml', 'image/png', 'image/jpeg', 'image/webp'));
