-- An ACTIVE OPENED transition is a Control Tower case; its id, negated, is the case's symptom id in
-- treatment and audit_event, so it never meets a GPS database symptom id. Where the signal was, so
-- the case shows its trip and its point on the map, and who closed it.

ALTER TABLE miot_symptoms.signal_transitions
    ADD COLUMN trip_id   VARCHAR(64),
    ADD COLUMN latitude  DOUBLE PRECISION,
    ADD COLUMN longitude DOUBLE PRECISION,
    ADD COLUMN speed_kmh DOUBLE PRECISION,
    ADD COLUMN closed_by VARCHAR(255);

CREATE INDEX idx_signal_transitions_case
    ON miot_symptoms.signal_transitions (tenant_code, definition_id, asset_id, at);
