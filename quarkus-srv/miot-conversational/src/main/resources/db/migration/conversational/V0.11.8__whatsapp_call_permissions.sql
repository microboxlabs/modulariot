-- WhatsApp Business Calling: the permission a contact gave a business number to call it, and the permission
-- requests sent, which Meta limits to 1 per 24 hours and 2 per 7 days for each number and contact.

CREATE TABLE IF NOT EXISTS miot_conversational.conv_call_permission (
    business_phone_number_id VARCHAR(64)  NOT NULL,
    contact_e164             VARCHAR(32)  NOT NULL,
    status                   VARCHAR(16)  NOT NULL,
    expires_at               TIMESTAMPTZ,
    responded_at             TIMESTAMPTZ,
    response_source          VARCHAR(32),
    consecutive_unanswered   INTEGER      NOT NULL DEFAULT 0,
    last_connected_call_at   TIMESTAMPTZ,
    updated_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (business_phone_number_id, contact_e164),
    CONSTRAINT chk_conv_call_permission_status
        CHECK (status IN ('NONE', 'TEMPORARY', 'PERMANENT', 'DECLINED', 'REVOKED'))
);

CREATE TABLE IF NOT EXISTS miot_conversational.conv_call_permission_request (
    id                       UUID         PRIMARY KEY,
    tenant_code              VARCHAR(128) NOT NULL,
    business_phone_number_id VARCHAR(64)  NOT NULL,
    contact_e164             VARCHAR(32)  NOT NULL,
    origin                   VARCHAR(16)  NOT NULL,
    wamid                    VARCHAR(255),
    requested_by             VARCHAR(255),
    sent_at                  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_conv_call_permission_request_origin CHECK (origin IN ('rule', 'manual'))
);

CREATE INDEX IF NOT EXISTS idx_conv_call_permission_request_pair
    ON miot_conversational.conv_call_permission_request (business_phone_number_id, contact_e164, sent_at DESC);

-- The Meta template that carries the call permission request. Create it in Meta with a body and a
-- call_permission_request component; its name must match metaName.
INSERT INTO miot_conversational.conv_template
    (id, tenant_code, key, name, base_text, whatsapp, updated_by, version)
VALUES (gen_random_uuid(), '_platform', 'miot_call_permission_request', 'Permiso de llamada por WhatsApp',
    'Hola {{nombre}}, somos el equipo que monitorea tu viaje. Si surge algo en ruta, queremos poder llamarte por WhatsApp. ¿Nos das permiso?',
    '{"metaName":"miot_call_permission_request","language":"es","params":["nombre"],"callPermission":true}'::jsonb,
    'migration', '0.1.0')
ON CONFLICT (tenant_code, key) DO NOTHING;
