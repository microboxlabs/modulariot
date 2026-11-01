ALTER TABLE miot_integrations.geocoding_plan
    ADD COLUMN whatsapp_recipients TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE miot_integrations.geocoding_subscriptions
    ADD COLUMN whatsapp_recipients TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE miot_integrations.geocoding_quota_alerts (
    organization VARCHAR(128) NOT NULL,
    month DATE NOT NULL CHECK (extract(day FROM month) = 1),
    level VARCHAR(16) NOT NULL CHECK (level IN ('threshold', 'exhausted')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (organization, month, level)
);

INSERT INTO miot_integrations.geocoding_quota_alerts (organization, month, level)
SELECT organization, alerted_month, 'threshold'
FROM miot_integrations.geocoding_subscriptions WHERE alerted_month IS NOT NULL;
