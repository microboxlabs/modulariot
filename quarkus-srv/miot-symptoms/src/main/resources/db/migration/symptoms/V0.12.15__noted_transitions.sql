-- NOTED: a timeline entry the symptom's note rule (lifecycle.note) wrote on an open case, such as a GPS event
-- that does not close it. context holds {"note": {"event_type", "description", "at"}}. The case does not change
-- and nothing is sent.
-- NOT VALID: the existing rows already meet the new check, so they are not scanned.

ALTER TABLE miot_symptoms.signal_transitions DROP CONSTRAINT IF EXISTS chk_signal_transitions_kind;
ALTER TABLE miot_symptoms.signal_transitions
    ADD CONSTRAINT chk_signal_transitions_kind CHECK (kind IN ('OPENED', 'LEVEL_CHANGED', 'CLOSED', 'HELD', 'NOTED'))
    NOT VALID;

-- Concurrent redeliveries must also write only one note per symptom, vehicle and frame time.
CREATE UNIQUE INDEX uq_signal_transitions_note
    ON miot_symptoms.signal_transitions (tenant_code, definition_id, asset_id, at)
    WHERE kind = 'NOTED';
