-- Messages a rule step sent through an integration connection (webhook, Slack, Teams).
--
-- Such a message is stored on the conversation about the run's context with the connection:
-- participant_address and wa_message.address hold the connection id, display_name its name,
-- phone_e164 is null. provider_message_id stays null (the call returns no id), so the
-- (channel, provider_message_id) unique index does not apply. Only the channel check changes.
--
-- The check comes from V0.9.6, so this version sorts after it. It was first applied as V0.7.2,
-- which a new database runs before V0.9.6; IF EXISTS lets it run again where that happened.

ALTER TABLE miot_conversational.wa_message DROP CONSTRAINT IF EXISTS chk_wa_message_channel;
ALTER TABLE miot_conversational.wa_message ADD CONSTRAINT chk_wa_message_channel CHECK (
    channel IN ('whatsapp', 'email', 'webhook', 'slack', 'teams'));
