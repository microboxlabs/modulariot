-- Which account an organization's rules send WhatsApp and email from: the platform's (PLATFORM) or the
-- organization's own connection (OWN). No row means PLATFORM.
--
-- Rule emails went through the organization's RESEND connection when it had an active one, so those
-- organizations start in OWN. Rule WhatsApp messages always went through the platform's account.

CREATE TABLE IF NOT EXISTS miot_conversational.conv_channel_account (
    tenant_code VARCHAR(128) NOT NULL,
    channel     VARCHAR(16) NOT NULL,
    mode        VARCHAR(16) NOT NULL,
    updated_by  VARCHAR(255),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_code, channel),
    CONSTRAINT chk_conv_channel_account_channel CHECK (channel IN ('whatsapp', 'email')),
    CONSTRAINT chk_conv_channel_account_mode CHECK (mode IN ('PLATFORM', 'OWN'))
);

INSERT INTO miot_conversational.conv_channel_account (tenant_code, channel, mode, updated_by)
SELECT DISTINCT tenant_code, 'email', 'OWN', 'migration'
FROM miot_integrations.integration_connections
WHERE provider_type = 'RESEND' AND active AND tenant_code NOT LIKE '\_%'
ON CONFLICT DO NOTHING;
