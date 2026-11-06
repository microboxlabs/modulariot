-- WhatsApp voice calls over SIP (Meta <-> Telnyx Call Control). Additive.

-- The WhatsApp leg bridged to an operator's parked WebRTC leg, and why Meta
-- refused it (whatsapp_no_permission on SIP 403).
CREATE TABLE miot_integrations.telephony_whatsapp_legs (
    call_ref    UUID PRIMARY KEY REFERENCES miot_integrations.telephony_usage(id),
    leg_call_id VARCHAR(160),
    failure     VARCHAR(64),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Calls contacts place to the business number. tenant_code is null when no
-- organization knows the caller. call_ref is the operator's ledger row.
CREATE TABLE miot_integrations.whatsapp_inbound_calls (
    id              UUID PRIMARY KEY,
    connection_id   VARCHAR(64)  NOT NULL,
    call_control_id VARCHAR(160) NOT NULL UNIQUE,
    tenant_code     VARCHAR(128),
    caller_number   VARCHAR(32)  NOT NULL,
    caller_name     VARCHAR(256),
    case_ref        VARCHAR(64),
    status          VARCHAR(16)  NOT NULL CHECK (status IN ('RINGING', 'CLAIMED', 'ANSWERED', 'MISSED', 'ENDED')),
    call_ref        UUID UNIQUE REFERENCES miot_integrations.telephony_usage(id),
    created_at      TIMESTAMPTZ  NOT NULL,
    updated_at      TIMESTAMPTZ  NOT NULL
);

CREATE INDEX ix_whatsapp_inbound_calls_ringing
    ON miot_integrations.whatsapp_inbound_calls (tenant_code, created_at) WHERE status = 'RINGING';
