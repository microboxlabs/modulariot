-- Closes a rollout window opened by V0.6.9.
--
-- V0.6.9 left credential_type and environment NOT NULL with no default. The release
-- that populates them ships alongside it, but Flyway runs before the new pods serve
-- and the previous image stays up for the whole rolling deploy — and that image
-- INSERTs into credential_profiles without naming either column:
--
--     INSERT INTO miot_integrations.credential_profiles (
--         id, tenant_code, display_name, auth_type, public_config,
--         encrypted_secret_json, secret_preview, secret_version, created_at, updated_at)
--
-- so every write it attempts during the rollout fails on a not-null violation. In
-- practice that is the WhatsApp channel silently unable to store an access token for
-- the length of the deploy.
--
-- The defaults are what make the schema tolerate both images at once. BEARER_TOKEN is
-- what the previous image creates (an access token), so its inserts land on the type
-- it would have chosen anyway, and PRODUCTION matches how V0.6.9 backfilled the rows
-- that predate the column. Nothing depends on either default: the current service
-- always states both values explicitly.
--
-- This is a separate migration rather than an edit to V0.6.9 because V0.6.9 is already
-- applied — editing it would fail validation with a checksum mismatch everywhere it
-- has run.
ALTER TABLE miot_integrations.credential_profiles
    ALTER COLUMN credential_type SET DEFAULT 'BEARER_TOKEN',
    ALTER COLUMN environment SET DEFAULT 'PRODUCTION';
