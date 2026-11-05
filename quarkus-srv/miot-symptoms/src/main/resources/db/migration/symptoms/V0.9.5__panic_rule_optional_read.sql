-- The panic-button rule reads the button with .? instead of a has() per level:
-- has(signal.frame.sensors) && has(signal.frame.sensors.panic_button) && signal.frame.sensors.panic_button [== true]
-- becomes signal.frame.?sensors.?panic_button == TRUE. A spec stored as a JSON string stays a string.

UPDATE miot_symptoms.symptom_version
SET spec = regexp_replace(spec::text,
           'has\(\s*signal\.frame\.sensors\s*\)(\s|\\+n)*&&(\s|\\+n)*has\(\s*signal\.frame\.sensors\.panic_button\s*\)(\s|\\+n)*&&(\s|\\+n)*signal\.frame\.sensors\.panic_button(\s*==\s*true)?\M',
           'signal.frame.?sensors.?panic_button == TRUE', 'g')::jsonb
WHERE spec::text ~ 'has\(\s*signal\.frame\.sensors\.panic_button\s*\)';
