-- Messages a rule step sent through an integration connection (webhook, Slack, Teams).
--
-- Such a message is stored on the conversation about the run's context with the connection:
-- participant_address and wa_message.address hold the connection id, display_name its name,
-- phone_e164 is null. provider_message_id stays null (the call returns no id), so the
-- (channel, provider_message_id) unique index does not apply. Only the channel check changes.

ALTER TABLE miot_conversational.wa_message DROP CONSTRAINT chk_wa_message_channel;
ALTER TABLE miot_conversational.wa_message ADD CONSTRAINT chk_wa_message_channel CHECK (
    channel IN ('whatsapp', 'email', 'webhook', 'slack', 'teams'));
