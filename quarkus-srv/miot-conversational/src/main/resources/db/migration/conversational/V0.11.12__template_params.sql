-- A template's parameters: values each rule step that uses it writes. An organization may own templates too.
ALTER TABLE miot_conversational.conv_template
    ADD COLUMN params JSONB;
