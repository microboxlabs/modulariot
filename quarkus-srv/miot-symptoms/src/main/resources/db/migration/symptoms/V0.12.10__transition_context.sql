-- What the rules read when a case opened or changed level, so the Control Tower can say why the case is at
-- its level. For a trip check, the check without its trip: {"check": {"signal_lost_minutes": ..., "loss": {...}}}.
-- Null on rows written before this column and on GPS signal symptoms.

ALTER TABLE miot_symptoms.signal_transitions
    ADD COLUMN context JSONB;
