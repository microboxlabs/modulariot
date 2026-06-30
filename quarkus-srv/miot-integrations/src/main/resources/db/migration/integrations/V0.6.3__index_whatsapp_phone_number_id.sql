-- Inbound Meta webhooks carry only a phone_number_id; the channel must map that to the org
-- that owns the WHATSAPP connection (see findActiveWhatsAppByPhoneNumberId). A Meta number is
-- 1:1 with a connection, so this index is UNIQUE: at most one ACTIVE WhatsApp connection may
-- advertise a given phone_number_id. That enforces unambiguous inbound routing at the DB
-- boundary — a second org claiming the same number fails when the connection is written, instead
-- of silently leaking one org's conversations into another's inbox at read time. It also keeps
-- the reverse lookup a single indexed probe.
CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_connections_whatsapp_phone_number_id
    ON miot_integrations.integration_connections ((metadata->>'phone_number_id'))
    WHERE provider_type = 'WHATSAPP' AND active;
