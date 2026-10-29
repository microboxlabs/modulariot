-- One row per location resolution, for charging organizations by use.
--   source: the resolver step that placed the site (geofence, plus_code,
--     coordinates, internal, provider), or null when none did.
--   result: resolved or needs_review.
--   provider: the geocoding provider asked or whose cached result was used.
--   cost_usd: only when the provider was called; copied from the connection's
--     price at that moment, null when it had none.
CREATE TABLE miot_integrations.geocode_usage (
    id           BIGSERIAL PRIMARY KEY,
    tenant_id    VARCHAR(128) NOT NULL,
    user_id      VARCHAR(256),
    source       VARCHAR(16),
    result       VARCHAR(16) NOT NULL,
    provider     VARCHAR(32),
    cache_hit    BOOLEAN NOT NULL DEFAULT false,
    cost_usd     NUMERIC(16, 8),
    recorded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (NOT cache_hit OR cost_usd IS NULL)
);

CREATE INDEX geocode_usage_tenant_recorded_idx
    ON miot_integrations.geocode_usage (tenant_id, recorded_at);
