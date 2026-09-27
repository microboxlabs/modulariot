-- Seat plan for the harness. Each seat costs a monthly price and adds tokens to
-- an organization's shared monthly pool. A model's tokens count against the
-- pool times its multiplier (`multiplier` in model_providers.models, 1 when
-- unset), so dearer models use the pool faster.

-- The plan every organization buys seats on; one row, set by the platform owner.
CREATE TABLE miot_integrations.harness_plan (
    id                  SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    seat_price_usd      NUMERIC(10, 2) NOT NULL,
    tokens_per_seat     BIGINT NOT NULL CHECK (tokens_per_seat >= 0),
    yearly_discount_pct NUMERIC(5, 2) NOT NULL DEFAULT 0
        CHECK (yearly_discount_pct >= 0 AND yearly_discount_pct < 100),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by          VARCHAR(256)
);

INSERT INTO miot_integrations.harness_plan (seat_price_usd, tokens_per_seat, yearly_discount_pct)
VALUES (25.00, 10000000, 20.00);

-- An organization's seats and who may use the harness. access_mode 'some'
-- limits it to the emails in harness_seat_members.
CREATE TABLE miot_integrations.harness_subscriptions (
    organization    VARCHAR(128) PRIMARY KEY,
    seats           INTEGER NOT NULL CHECK (seats >= 0),
    billing_cycle   VARCHAR(16) NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
    access_mode     VARCHAR(8) NOT NULL CHECK (access_mode IN ('all', 'some', 'none')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      VARCHAR(256)
);

CREATE TABLE miot_integrations.harness_seat_members (
    organization    VARCHAR(128) NOT NULL
        REFERENCES miot_integrations.harness_subscriptions (organization) ON DELETE CASCADE,
    email           VARCHAR(256) NOT NULL,
    PRIMARY KEY (organization, email)
);

-- Tokens a usage row takes from the pool, fixed when the row is written so a
-- later multiplier change does not alter past months.
ALTER TABLE miot_integrations.model_usage ADD COLUMN pool_tokens BIGINT;

UPDATE miot_integrations.model_usage
   SET pool_tokens = input_tokens + output_tokens + cache_read_tokens + cache_write_tokens;

ALTER TABLE miot_integrations.model_usage ALTER COLUMN pool_tokens SET NOT NULL;
