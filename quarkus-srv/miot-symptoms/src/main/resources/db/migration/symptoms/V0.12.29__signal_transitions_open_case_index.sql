-- The open-case queries (Control Tower map positions and conditions) find each opening's CLOSED transition with
-- kind = 'CLOSED' AND id > o.id ORDER BY id LIMIT 1. idx_signal_transitions_case ends in at, so Postgres read
-- every transition of the asset and sorted them, for each historical opening.
CREATE INDEX IF NOT EXISTS idx_signal_transitions_case_state_kind
    ON miot_symptoms.signal_transitions (tenant_code, definition_id, asset_id, state, kind, id);
