-- Geocoding plan. An organization's subscription gives it a monthly quota of
-- provider calls for the calendar month (UTC). Only a call to the provider
-- counts: a geofence, a Plus Code, coordinates, the internal source and the
-- cache are free.

-- The plan every organization subscribes to; one row, set by the platform owner.
--   resolutions_per_month: the quota of a subscription without its own.
--   overage_price_usd: price of one provider call over the quota, charged only
--     to a subscription with on_exhausted = 'overage'.
--   alert_pct: share of the quota at which the organization is warned, once a month.
CREATE TABLE miot_integrations.geocoding_plan (
    id                    SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    monthly_price_usd     NUMERIC(10, 2) NOT NULL CHECK (monthly_price_usd >= 0),
    resolutions_per_month INTEGER NOT NULL CHECK (resolutions_per_month >= 0),
    overage_price_usd     NUMERIC(12, 6) NOT NULL CHECK (overage_price_usd >= 0),
    alert_pct             INTEGER NOT NULL DEFAULT 80 CHECK (alert_pct > 0 AND alert_pct <= 100),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by            VARCHAR(256)
);

-- PLACEHOLDER pricing: the price per plan, the quota and the overage price are
-- a pending decision. Change them with PUT /api/v1/platform/geocoding-plan.
INSERT INTO miot_integrations.geocoding_plan (monthly_price_usd, resolutions_per_month, overage_price_usd)
VALUES (0.00, 1000, 0.005000);

-- An organization's subscription.
--   monthly_quota: overrides the plan's resolutions_per_month; null uses it.
--   on_exhausted: 'review' stops calling the provider and sends sites to
--     review; 'overage' keeps calling and charges the overage price.
--   alerted_month: the first day of the last month the alert was sent, so it
--     goes out once per month.
CREATE TABLE miot_integrations.geocoding_subscriptions (
    organization    VARCHAR(128) PRIMARY KEY,
    monthly_quota   INTEGER CHECK (monthly_quota >= 0),
    on_exhausted    VARCHAR(8) NOT NULL DEFAULT 'review' CHECK (on_exhausted IN ('review', 'overage')),
    alerted_month   DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      VARCHAR(256)
);

-- The quota is per organization; usage rows written before this have none and
-- count for no one. provider_called marks the rows that count.
ALTER TABLE miot_integrations.geocode_usage
    ADD COLUMN organization    VARCHAR(128),
    ADD COLUMN provider_called BOOLEAN NOT NULL DEFAULT false;

UPDATE miot_integrations.geocode_usage SET provider_called = true WHERE cost_usd IS NOT NULL;

CREATE INDEX geocode_usage_org_recorded_idx
    ON miot_integrations.geocode_usage (organization, recorded_at);
