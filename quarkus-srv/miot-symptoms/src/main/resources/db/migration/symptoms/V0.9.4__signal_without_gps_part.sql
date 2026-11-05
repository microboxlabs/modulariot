-- The GPS signal drops its gps part, which repeated the frame: signal.gps.speed_kmh -> signal.frame.gps.speed,
-- signal.gps.engine_on -> signal.frame.sensors.engine_status, signal.gps.moving -> signal.derived.moving.
-- The frame is always present, so a has(signal.frame) guard is dropped. The rules are rewritten in the stored
-- text, so a spec stored as a JSON string stays a string.

UPDATE miot_symptoms.symptom_version
SET spec = regexp_replace(regexp_replace(regexp_replace(regexp_replace(spec::text,
           'signal\.gps\.speed_kmh\M', 'signal.frame.gps.speed', 'g'),
           'signal\.gps\.engine_on\M', 'signal.frame.sensors.engine_status', 'g'),
           'signal\.gps\.moving\M', 'signal.derived.moving', 'g'),
           'has\(signal\.frame\)(\s|\\+n)*&&(\s|\\+n)*', '', 'g')::jsonb
WHERE spec::text ~ 'signal\.gps\.(speed_kmh|engine_on|moving)\M|has\(signal\.frame\)';
