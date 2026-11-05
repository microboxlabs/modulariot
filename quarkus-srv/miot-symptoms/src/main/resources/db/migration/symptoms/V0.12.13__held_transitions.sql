-- HELD: a case opening the evaluator kept back because an "Ignorar condición" hold covered the symptom. It is
-- evidence only: no case opens and nothing is sent. The holds themselves are treatments (type IGNORE_CONDITION,
-- an IGNORE action with the duration and, in details, scope and until_trip_end); no table is added.
-- NOT VALID: the existing rows already meet the new check, so they are not scanned.

ALTER TABLE miot_symptoms.signal_transitions DROP CONSTRAINT IF EXISTS chk_signal_transitions_kind;
ALTER TABLE miot_symptoms.signal_transitions
    ADD CONSTRAINT chk_signal_transitions_kind CHECK (kind IN ('OPENED', 'LEVEL_CHANGED', 'CLOSED', 'HELD'))
    NOT VALID;
