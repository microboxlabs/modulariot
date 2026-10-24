-- A reply on the platform's WhatsApp number names no organization. Without a quoted message it goes to the
-- organization of the newest message sent to that phone through the platform's connection, so that lookup
-- runs on every such reply. This index makes it a probe on (address, newest first).
--
-- wa_message.address and channel come from V0.9.6, which a new database applies after this version. There
-- the index is skipped; on a database that has them (out-of-order apply) it is created.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'miot_conversational' AND table_name = 'wa_message'
                 AND column_name = 'address') THEN
        CREATE INDEX IF NOT EXISTS idx_wa_message_whatsapp_outbound_address
            ON miot_conversational.wa_message (address, created_at DESC)
            WHERE channel = 'whatsapp' AND direction = 'OUTBOUND';
    END IF;
END
$$;
