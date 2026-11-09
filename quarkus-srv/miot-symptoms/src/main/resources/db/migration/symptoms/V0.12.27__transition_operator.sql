-- Whether the case goes to the operators at the level an OPENED or LEVEL_CHANGED row sets: the level's
-- response.operator and, when it has one, its operatorWhen on the signal of that row. Decided once when the row
-- is written. Null on older rows and on other kinds; readers then take response.operator from the version.

ALTER TABLE miot_symptoms.signal_transitions
    ADD COLUMN IF NOT EXISTS operator_required BOOLEAN;
