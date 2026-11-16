-- The newest event of a type, for the rule editor's preview with a real event.
CREATE INDEX IF NOT EXISTS idx_conv_event_tenant_type_received
    ON miot_conversational.conv_event (tenant_code, type, received_at DESC);
