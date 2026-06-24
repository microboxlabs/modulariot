-- Extend the integration_connections provider_type allow-list with WHATSAPP
-- (Meta WhatsApp Cloud API channel). New migration on purpose — never mutate the
-- already-applied V0.6.0 (Flyway checksum).
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
            'WHATSAPP'
        )
    );
