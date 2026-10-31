-- GEOCODING: forward geocoding through Mapbox or Google (metadata.provider).
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
            'RESEND',
            'CAR_IMAGES',
            'GEOCODING'
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
            'RESEND',
            'CAR_IMAGES',
            'GEOCODING'
        )
    );
