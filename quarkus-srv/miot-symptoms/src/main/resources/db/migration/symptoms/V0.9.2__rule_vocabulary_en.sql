-- Rule vocabulary in English, like the source fields: caso.* -> case.*, medida -> measure, sostenido_s -> held_s,
-- and the recurrence entity patente/conductor -> vehicle/driver. Only the rule fields change (activation, each
-- level's when, lifecycle open and close); scripts and other text keep their words. A spec stored as a JSON string
-- stays a string.

CREATE FUNCTION pg_temp.rule_en(e TEXT) RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
    SELECT regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
           regexp_replace(e,
           '(^|[^\w.])caso\.condicion_s\M', '\1case.condition_s', 'g'),
           '(^|[^\w.])caso\.edad_h\M', '\1case.age_h', 'g'),
           '(^|[^\w.])caso\.nivel\M', '\1case.level', 'g'),
           '(^|[^\w.])caso\.cerrado_por_operador\M', '\1case.closed_by_operator', 'g'),
           '(^|[^\w.])caso\.normal_s\M', '\1case.normal_s', 'g'),
           '(^|[^\w.])medida\M', '\1measure', 'g'),
           '(^|[^\w.])sostenido_s\M', '\1held_s', 'g')
$$;

CREATE FUNCTION pg_temp.spec_en(j JSONB) RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
    SELECT j
        || CASE WHEN jsonb_typeof(j -> 'activation') = 'string'
                THEN jsonb_build_object('activation', pg_temp.rule_en(j ->> 'activation'))
                ELSE '{}'::jsonb END
        || CASE WHEN jsonb_typeof(j -> 'levels') = 'array'
                THEN jsonb_build_object('levels', (
                    SELECT coalesce(jsonb_agg(CASE WHEN jsonb_typeof(l -> 'when') = 'string'
                                                   THEN jsonb_set(l, '{when}', to_jsonb(pg_temp.rule_en(l ->> 'when')))
                                                   ELSE l END ORDER BY n), '[]'::jsonb)
                    FROM jsonb_array_elements(j -> 'levels') WITH ORDINALITY AS a(l, n)))
                ELSE '{}'::jsonb END
        || CASE WHEN jsonb_typeof(j -> 'lifecycle') = 'object'
                THEN jsonb_build_object('lifecycle', j -> 'lifecycle'
                    || CASE WHEN jsonb_typeof(j -> 'lifecycle' -> 'open') = 'string'
                            THEN jsonb_build_object('open', pg_temp.rule_en(j -> 'lifecycle' ->> 'open'))
                            ELSE '{}'::jsonb END
                    || CASE WHEN jsonb_typeof(j -> 'lifecycle' -> 'close') = 'string'
                            THEN jsonb_build_object('close', pg_temp.rule_en(j -> 'lifecycle' ->> 'close'))
                            ELSE '{}'::jsonb END)
                ELSE '{}'::jsonb END
        || CASE WHEN j -> 'recurrence' ->> 'entity' IN ('patente', 'conductor')
                THEN jsonb_build_object('recurrence', j -> 'recurrence' || jsonb_build_object('entity',
                    CASE j -> 'recurrence' ->> 'entity' WHEN 'patente' THEN 'vehicle' ELSE 'driver' END))
                ELSE '{}'::jsonb END
$$;

WITH parsed AS (
    SELECT id,
           jsonb_typeof(spec) = 'string' AS as_text,
           CASE WHEN jsonb_typeof(spec) = 'string' THEN (spec #>> '{}')::jsonb ELSE spec END AS j
    FROM miot_symptoms.symptom_version
), renamed AS (
    SELECT id, as_text, j, pg_temp.spec_en(j) AS en FROM parsed WHERE jsonb_typeof(j) = 'object'
)
UPDATE miot_symptoms.symptom_version v
SET spec = CASE WHEN r.as_text THEN to_jsonb(r.en::text) ELSE r.en END
FROM renamed r
WHERE v.id = r.id AND r.en <> r.j;

DROP FUNCTION pg_temp.spec_en(JSONB);
DROP FUNCTION pg_temp.rule_en(TEXT);
