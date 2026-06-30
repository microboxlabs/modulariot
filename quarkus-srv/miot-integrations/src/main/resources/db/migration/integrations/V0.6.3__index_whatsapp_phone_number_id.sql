-- Inbound Meta webhooks carry only a phone_number_id; the channel must map that to the org
-- that owns the WHATSAPP connection (see findActiveWhatsAppByPhoneNumberId). A partial
-- expression index on the JSONB phone_number_id keeps that reverse lookup a single indexed
-- probe instead of a scan over every connection.
CREATE INDEX IF NOT EXISTS idx_integration_connections_whatsapp_phone_number_id
    ON miot_integrations.integration_connections ((metadata->>'phone_number_id'))
    WHERE provider_type = 'WHATSAPP';
