-- WHATSAPP_TEMPLATE is 17 characters. Preserve already applied ledger migrations.
ALTER TABLE miot_integrations.telephony_usage ALTER COLUMN destination_type TYPE VARCHAR(32);
