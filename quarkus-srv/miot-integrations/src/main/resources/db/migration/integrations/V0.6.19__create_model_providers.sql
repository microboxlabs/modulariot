-- AI model providers the harness may call, set by the platform owner. One row
-- per provider, platform-wide: tenants use them and are charged per token.
--
-- The API key is encrypted with the integrations secret key and never read
-- back through the API; `key_preview` is what the settings page shows.
-- `models` is a JSON array of {id, inputPerMtok, outputPerMtok, default}: the
-- models offered to runs, their price per million tokens, and at most one
-- default across every provider.
CREATE TABLE miot_integrations.model_providers (
    provider        VARCHAR(32) PRIMARY KEY,
    base_url        TEXT,
    encrypted_key   TEXT NOT NULL,
    key_preview     VARCHAR(16) NOT NULL,
    models          JSONB NOT NULL DEFAULT '[]'::jsonb,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      VARCHAR(256)
);
