-- The GPS signal drops its gps part, which repeated the frame: signal.gps.speed_kmh -> signal.frame.gps.speed,
-- signal.gps.engine_on -> signal.frame.sensors.engine_status, signal.gps.moving -> signal.derived.moving.
-- A has() of a moved field also tests the new parent, which the frame can leave out. The frame is always present,
-- so a has(signal.frame) guard that starts a conjunction is dropped. Only the rule fields change (activation,
-- measure, each level's when, lifecycle open and close). A spec stored as a JSON string stays a string.

CREATE FUNCTION pg_temp.rule_frame(e TEXT) RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
    SELECT regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(e,
           'has\(\s*signal\.gps\.speed_kmh\s*\)', 'has(signal.frame.gps)', 'g'),
           'has\(\s*signal\.gps\.engine_on\s*\)',
           '(has(signal.frame.sensors) && has(signal.frame.sensors.engine_status))', 'g'),
           '(^|[^\w.])signal\.gps\.speed_kmh\M', '\1signal.frame.gps.speed', 'g'),
           '(^|[^\w.])signal\.gps\.engine_on\M', '\1signal.frame.sensors.engine_status', 'g'),
           '(^|[^\w.])signal\.gps\.moving\M', '\1signal.derived.moving', 'g'),
           '(^|[(&|]\s*)has\(\s*signal\.frame\s*\)\s*&&\s*', '\1', 'g')
$$;

CREATE FUNCTION pg_temp.spec_frame(j JSONB) RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
    SELECT j
        || CASE WHEN jsonb_typeof(j -> 'activation') = 'string'
                THEN jsonb_build_object('activation', pg_temp.rule_frame(j ->> 'activation'))
                ELSE '{}'::jsonb END
        || CASE WHEN jsonb_typeof(j -> 'measure' -> 'expression') = 'string'
                THEN jsonb_build_object('measure', j -> 'measure'
                    || jsonb_build_object('expression', pg_temp.rule_frame(j -> 'measure' ->> 'expression')))
                ELSE '{}'::jsonb END
        || CASE WHEN jsonb_typeof(j -> 'levels') = 'array'
                THEN jsonb_build_object('levels', (
                    SELECT coalesce(jsonb_agg(CASE WHEN jsonb_typeof(l -> 'when') = 'string'
                                                   THEN jsonb_set(l, '{when}', to_jsonb(pg_temp.rule_frame(l ->> 'when')))
                                                   ELSE l END ORDER BY n), '[]'::jsonb)
                    FROM jsonb_array_elements(j -> 'levels') WITH ORDINALITY AS a(l, n)))
                ELSE '{}'::jsonb END
        || CASE WHEN jsonb_typeof(j -> 'lifecycle') = 'object'
                THEN jsonb_build_object('lifecycle', j -> 'lifecycle'
                    || CASE WHEN jsonb_typeof(j -> 'lifecycle' -> 'open') = 'string'
                            THEN jsonb_build_object('open', pg_temp.rule_frame(j -> 'lifecycle' ->> 'open'))
                            ELSE '{}'::jsonb END
                    || CASE WHEN jsonb_typeof(j -> 'lifecycle' -> 'close') = 'string'
                            THEN jsonb_build_object('close', pg_temp.rule_frame(j -> 'lifecycle' ->> 'close'))
                            ELSE '{}'::jsonb END)
                ELSE '{}'::jsonb END
$$;

WITH parsed AS (
    SELECT id,
           jsonb_typeof(spec) = 'string' AS as_text,
           CASE WHEN jsonb_typeof(spec) = 'string' THEN (spec #>> '{}')::jsonb ELSE spec END AS j
    FROM miot_symptoms.symptom_version
), rewritten AS (
    SELECT id, as_text, j, pg_temp.spec_frame(j) AS r FROM parsed WHERE jsonb_typeof(j) = 'object'
)
UPDATE miot_symptoms.symptom_version v
SET spec = CASE WHEN w.as_text THEN to_jsonb(w.r::text) ELSE w.r END
FROM rewritten w
WHERE v.id = w.id AND w.r <> w.j;

DROP FUNCTION pg_temp.spec_frame(JSONB);
DROP FUNCTION pg_temp.rule_frame(TEXT);
