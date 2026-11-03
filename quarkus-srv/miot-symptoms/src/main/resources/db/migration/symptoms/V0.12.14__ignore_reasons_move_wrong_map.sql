-- "Falso positivo — mapa/límite incorrecto" is not a reason to ignore: a symptom raised by a wrong map or limit
-- is not real, so it is invalidated ("Mapa/límite incorrecto" in invalidate_reason, already there). It leaves
-- ignore_reason. "Indefinidamente" in ignore_duration becomes "Hasta que termine el viaje".
-- Only the lists each organization was seeded with and never edited (updated_by = 'system:defaults'); a list an
-- organization edited keeps its options. Actions recorded with ignore_reason_1 keep their stored label.

DO $$
BEGIN
    IF to_regclass('miot_core.selectables') IS NULL THEN
        RETURN;
    END IF;

    UPDATE miot_core.selectables s
       SET options = (SELECT COALESCE(jsonb_agg(x.o ORDER BY x.n), '[]'::jsonb)
                        FROM jsonb_array_elements(s.options) WITH ORDINALITY AS x(o, n)
                       WHERE x.o->>'value' IS DISTINCT FROM 'ignore_reason_1'),
           updated_at = now()
     WHERE s.key = 'ignore_reason' AND s.updated_by = 'system:defaults'
       AND jsonb_typeof(s.options) = 'array'
       AND s.options @> '[{"value": "ignore_reason_1"}]';

    UPDATE miot_core.selectables s
       SET options = (SELECT jsonb_agg(CASE WHEN x.o->>'value' = 'ignore_duration_5'
                                            THEN jsonb_set(x.o, '{label}',
                                                 '{"es": "Hasta que termine el viaje", "en": "Until the trip ends"}')
                                            ELSE x.o END ORDER BY x.n)
                        FROM jsonb_array_elements(s.options) WITH ORDINALITY AS x(o, n)),
           updated_at = now()
     WHERE s.key = 'ignore_duration' AND s.updated_by = 'system:defaults'
       AND jsonb_typeof(s.options) = 'array'
       AND s.options @> '[{"value": "ignore_duration_5"}]';
END $$;
