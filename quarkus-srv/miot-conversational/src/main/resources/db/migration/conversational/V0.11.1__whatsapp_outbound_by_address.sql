-- A reply on the platform's WhatsApp number names no organization. Without a quoted message it goes to the
-- organization of the newest message sent to that phone through the platform's connection, so that lookup
-- runs on every such reply. This index makes it a probe on (address, newest first).
--
-- wa_message.address and channel come from V0.9.6, so this version sorts after it.

CREATE INDEX IF NOT EXISTS idx_wa_message_whatsapp_outbound_address
    ON miot_conversational.wa_message (address, created_at DESC)
    WHERE channel = 'whatsapp' AND direction = 'OUTBOUND';
