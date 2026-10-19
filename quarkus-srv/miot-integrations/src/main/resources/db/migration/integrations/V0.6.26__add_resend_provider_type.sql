-- RESEND: transactional email through the Resend API.
-- Replaces both provider_type allow-lists (never edit an applied migration).
ALTER TABLE miot_integrations.integration_connections
    DROP CONSTRAINT chk_integration_connections_provider_type;

ALTER TABLE miot_integrations.integration_connections
    ADD CONSTRAINT chk_integration_connections_provider_type CHECK (
        provider_type IN (
            'POSTGREST',
            'ALERCE_TMS',
            'N8N',
            'AUTH0',
            'ECM',
            'CUSTOM_HTTP',
            'WHATSAPP',
            'GPS_WEBHOOK',
            'RESEND'
        )
    );

ALTER TABLE miot_integrations.integration_templates
    DROP CONSTRAINT chk_integration_templates_provider_type;

ALTER TABLE miot_integrations.integration_templates
    ADD CONSTRAINT chk_integration_templates_provider_type CHECK (
        provider_type IN (
            'POSTGREST',
            'ALERCE_TMS',
            'N8N',
            'AUTH0',
            'ECM',
            'CUSTOM_HTTP',
            'WHATSAPP',
            'GPS_WEBHOOK',
            'RESEND'
        )
    );
