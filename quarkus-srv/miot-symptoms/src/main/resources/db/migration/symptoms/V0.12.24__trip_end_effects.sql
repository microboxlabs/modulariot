-- Cleanup and event delivery survive a process/Redis/observer failure after the case closes.
CREATE TABLE miot_symptoms.trip_end_effects (
    opened_id BIGINT PRIMARY KEY REFERENCES miot_symptoms.signal_transitions(id) ON DELETE CASCADE,
    closed_id BIGINT NOT NULL UNIQUE REFERENCES miot_symptoms.signal_transitions(id) ON DELETE CASCADE
);
