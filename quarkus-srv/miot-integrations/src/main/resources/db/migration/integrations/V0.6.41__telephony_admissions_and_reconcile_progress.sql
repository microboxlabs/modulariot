-- A browser JWT can create parked legs only. A reservation authorizes exactly
-- one transfer, with a private correlation value for its PSTN leg.
CREATE TABLE miot_integrations.telephony_call_admissions (
    call_ref UUID PRIMARY KEY REFERENCES miot_integrations.telephony_usage(id),
    parked_call_id VARCHAR(160) NOT NULL UNIQUE,
    target_state UUID NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bounded reconciliation continues after restarts and across replicas.
CREATE TABLE miot_integrations.telephony_reconcile_progress (
    connection_id VARCHAR(64) PRIMARY KEY,
    next_page INTEGER NOT NULL CHECK (next_page >= 1),
    started_at TIMESTAMPTZ NOT NULL
);
