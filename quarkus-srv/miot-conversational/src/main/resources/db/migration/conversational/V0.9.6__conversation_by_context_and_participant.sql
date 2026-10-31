-- A conversation is one context plus one participant, on any channel (#2004).
--
-- wa_conversation:
--   context_kind / context_key: what the conversation is about (service, symptom_case, document,
--     job), or both null for a conversation without context.
--   participant_*: who the other side is. participant_address is an E.164 phone or an email.
--   channel_state: per-channel state (for example an email thread reference). The WhatsApp 24 h
--     window stays in session_expires_at, which inbound updates already keep.
--   context_service_code stays as a copy of context_key for service conversations.
--   phone_e164 becomes nullable for participants without a phone; WhatsApp rows keep it.
-- wa_message:
--   channel, address: where the message went or came from.
--   provider_message_id (was meta_message_id): unique per channel.
--   in_reply_to: the message this one answers, when the provider says so.
--   run_id, step: set on rule-started messages (runs come later, no FK yet).

ALTER TABLE miot_conversational.wa_conversation
    ADD COLUMN context_kind           VARCHAR(32),
    ADD COLUMN context_key            VARCHAR(255),
    ADD COLUMN participant_address    VARCHAR(320),
    ADD COLUMN participant_contact_id VARCHAR(128),
    ADD COLUMN participant_role       VARCHAR(64),
    ADD COLUMN display_name           VARCHAR(255),
    ADD COLUMN channel_state          JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE miot_conversational.wa_conversation
   SET context_kind = CASE WHEN context_service_code IS NOT NULL THEN 'service' END,
       context_key = context_service_code,
       participant_address = phone_e164,
       participant_role = CASE WHEN driver_id IS NOT NULL THEN 'driver' END,
       display_name = wa_contact_name;

ALTER TABLE miot_conversational.wa_conversation
    ALTER COLUMN participant_address SET NOT NULL,
    ALTER COLUMN phone_e164 DROP NOT NULL,
    ADD CONSTRAINT chk_wa_conversation_context_kind CHECK (
        context_kind IS NULL OR context_kind IN ('service', 'symptom_case', 'document', 'job')),
    ADD CONSTRAINT chk_wa_conversation_context_pair CHECK (
        (context_kind IS NULL) = (context_key IS NULL));

DROP INDEX IF EXISTS miot_conversational.idx_wa_conversation_tenant_service;
DROP INDEX IF EXISTS miot_conversational.idx_wa_conversation_tenant_phone_unassigned;
DROP INDEX IF EXISTS miot_conversational.idx_wa_conversation_tenant_phone_recent;

CREATE UNIQUE INDEX idx_wa_conversation_context_participant
    ON miot_conversational.wa_conversation (tenant_code, context_kind, context_key, participant_address)
    WHERE context_kind IS NOT NULL;

-- At most one open conversation without context per address.
CREATE UNIQUE INDEX idx_wa_conversation_address_unassigned
    ON miot_conversational.wa_conversation (tenant_code, participant_address)
    WHERE context_kind IS NULL AND status = 'OPEN';

-- Inbound attachment: newest conversation for an address.
CREATE INDEX idx_wa_conversation_address_recent
    ON miot_conversational.wa_conversation (
        tenant_code, participant_address, last_message_at DESC NULLS LAST, created_at DESC);

ALTER TABLE miot_conversational.wa_message
    ADD COLUMN channel     VARCHAR(32) NOT NULL DEFAULT 'whatsapp',
    ADD COLUMN address     VARCHAR(320),
    ADD COLUMN in_reply_to UUID REFERENCES miot_conversational.wa_message(id) ON DELETE SET NULL,
    ADD COLUMN run_id      UUID,
    ADD COLUMN step        INTEGER,
    ADD CONSTRAINT chk_wa_message_channel CHECK (channel IN ('whatsapp', 'email'));

UPDATE miot_conversational.wa_message m
   SET address = c.phone_e164
  FROM miot_conversational.wa_conversation c
 WHERE c.id = m.conversation_id;

ALTER TABLE miot_conversational.wa_message RENAME COLUMN meta_message_id TO provider_message_id;

DROP INDEX IF EXISTS miot_conversational.idx_wa_message_meta_message_id;

CREATE UNIQUE INDEX idx_wa_message_channel_provider_id
    ON miot_conversational.wa_message (channel, provider_message_id)
    WHERE provider_message_id IS NOT NULL;

CREATE INDEX idx_wa_message_run
    ON miot_conversational.wa_message (run_id)
    WHERE run_id IS NOT NULL;
