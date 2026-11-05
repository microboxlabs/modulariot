-- Managed telephony: a TELNYX connection of the platform used by every organization
-- without its own, metered per call, and a plan with prices and monthly minutes.

-- The plan; one row, set by the platform owner. Prices are USD.
--   minutes_per_month: the quota of an organization without its own.
--   price_*: per billed minute (each call rounded up to a whole minute), or per
--     WhatsApp template sent through the platform's account.
--   enforced: off, no call is refused; on, an organization past its minutes
--     cannot place a managed call.
CREATE TABLE miot_integrations.telephony_plan (
    id                          SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    minutes_per_month           INTEGER NOT NULL CHECK (minutes_per_month >= 0),
    price_cl_mobile_usd         NUMERIC(12, 6) NOT NULL CHECK (price_cl_mobile_usd >= 0),
    price_cl_landline_usd       NUMERIC(12, 6) NOT NULL CHECK (price_cl_landline_usd >= 0),
    price_other_usd             NUMERIC(12, 6) NOT NULL CHECK (price_other_usd >= 0),
    price_whatsapp_call_usd     NUMERIC(12, 6) NOT NULL CHECK (price_whatsapp_call_usd >= 0),
    price_whatsapp_template_usd NUMERIC(12, 6) NOT NULL CHECK (price_whatsapp_template_usd >= 0),
    enforced                    BOOLEAN NOT NULL DEFAULT false,
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by                  VARCHAR(256)
);

-- PLACEHOLDER prices: set them with PUT /api/v1/platform/telephony-plan.
INSERT INTO miot_integrations.telephony_plan (minutes_per_month, price_cl_mobile_usd, price_cl_landline_usd,
    price_other_usd, price_whatsapp_call_usd, price_whatsapp_template_usd)
VALUES (0, 0, 0, 0, 0, 0);

-- An organization's own monthly minutes; no row uses the plan's.
CREATE TABLE miot_integrations.telephony_subscriptions (
    tenant_code     VARCHAR(128) PRIMARY KEY,
    monthly_minutes INTEGER CHECK (monthly_minutes >= 0),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      VARCHAR(256)
);

-- Each operator's Telnyx telephony credential (SIP login). Telnyx detail records name
-- the SIP username, so a call is charged to the organization that owns the login.
CREATE TABLE miot_integrations.telephony_operator_credentials (
    sip_username  VARCHAR(128) PRIMARY KEY,
    tenant_code   VARCHAR(128) NOT NULL,
    credential_id VARCHAR(128) NOT NULL,
    connection_id VARCHAR(64)  NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- One row per call or WhatsApp template.
--   status: STARTED when the operator got a token (holds a channel), ENDED when the
--     browser or a webhook says it ended, CONFIRMED when Telnyx's webhook or detail
--     record gave the seconds, EXPIRED when a STARTED row had no news for 2 hours.
--   Only CONFIRMED rows are charged. seconds and billed_minutes come from Telnyx.
--   external_id: Telnyx call_control_id, WhatsApp call id or message id.
CREATE TABLE miot_integrations.telephony_usage (
    id                UUID PRIMARY KEY,
    tenant_code       VARCHAR(128) NOT NULL,
    channel           VARCHAR(24)  NOT NULL CHECK (channel IN ('VOICE', 'WHATSAPP_CALL', 'WHATSAPP_TEMPLATE')),
    managed           BOOLEAN      NOT NULL,
    connection_id     VARCHAR(64),
    external_id       VARCHAR(160),
    case_ref          VARCHAR(64),
    callee_number     VARCHAR(32),
    destination_type  VARCHAR(16),
    status            VARCHAR(16)  NOT NULL CHECK (status IN ('STARTED', 'ENDED', 'CONFIRMED', 'EXPIRED')),
    answered_at       TIMESTAMPTZ,
    seconds           INTEGER CHECK (seconds >= 0),
    billed_minutes    INTEGER CHECK (billed_minutes >= 0),
    provider_cost     NUMERIC(14, 6),
    provider_currency VARCHAR(8),
    source            VARCHAR(16),
    started_at        TIMESTAMPTZ  NOT NULL,
    ended_at          TIMESTAMPTZ,
    confirmed_at      TIMESTAMPTZ,
    UNIQUE (channel, external_id)
);

CREATE INDEX telephony_usage_tenant_started_idx ON miot_integrations.telephony_usage (tenant_code, started_at);
CREATE INDEX telephony_usage_connection_status_idx ON miot_integrations.telephony_usage (connection_id, status);
CREATE INDEX telephony_usage_callee_started_idx ON miot_integrations.telephony_usage (callee_number, started_at);
