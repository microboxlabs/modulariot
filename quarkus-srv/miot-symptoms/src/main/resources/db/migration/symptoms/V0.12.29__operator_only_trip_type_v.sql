-- Cases go to the operators only on trips of type v, or on signals without a trip type (off-trip: panic button,
-- GPS sabotage, road assistance). Other cases are still recorded, without SLA, steps or escalation.
-- For every symptom (organizations and platform templates) whose version in force has a level that applies and
-- has response.operator true, this publishes a PATCH version that copies that spec and sets the level's
-- response.operatorWhen to the condition below; an existing operatorWhen is kept and AND-ed with it. Only the
-- gps_signal and trip_check sources carry the trip type; symptoms of other sources are left as they are.
-- A symptom whose operator levels already carry the condition is skipped, so the file can run again.

WITH conditions (source_key, rule) AS (VALUES
    ('gps_signal', 'signal.?trip.?type.orValue("v") == "v"'),
    ('trip_check', 'check.?trip.?type.orValue("v") == "v"')
), current_versions AS (
    SELECT d.id, d.tenant_code, d.state, d.source_key, d.current_version,
           CASE jsonb_typeof(v.spec) WHEN 'string' THEN (v.spec #>> '{}')::jsonb ELSE v.spec END AS doc
      FROM miot_symptoms.symptom_definition d
      JOIN miot_symptoms.symptom_version v
        ON v.definition_id = d.id AND v.tenant_code = d.tenant_code AND v.version = d.current_version
     WHERE v.status = 'PUBLISHED'
), targets AS (
    SELECT c.*, k.rule
      FROM current_versions c
      JOIN conditions k ON k.source_key = COALESCE(NULLIF(c.doc ->> 'source', ''), c.source_key)
     WHERE jsonb_typeof(c.doc -> 'levels') = 'array'
       AND EXISTS (SELECT 1 FROM jsonb_array_elements(c.doc -> 'levels') AS l(level)
                    WHERE l.level -> 'applies' = 'true'::jsonb
                      AND l.level #> '{response,operator}' = 'true'::jsonb
                      AND strpos(COALESCE(l.level #>> '{response,operatorWhen}', ''), k.rule) = 0)
), rewritten AS (
    SELECT t.id, t.tenant_code, t.state,
           split_part(t.current_version, '.', 1) || '.' || split_part(t.current_version, '.', 2) || '.'
               || (split_part(t.current_version, '.', 3)::int + 1) AS version,
           jsonb_set(t.doc, '{levels}', (
               SELECT jsonb_agg(CASE
                          WHEN l.level -> 'applies' = 'true'::jsonb
                               AND l.level #> '{response,operator}' = 'true'::jsonb
                               AND strpos(COALESCE(l.level #>> '{response,operatorWhen}', ''), t.rule) = 0
                          THEN jsonb_set(l.level, '{response,operatorWhen}', to_jsonb(
                               CASE WHEN NULLIF(btrim(l.level #>> '{response,operatorWhen}'), '') IS NULL THEN t.rule
                                    ELSE '(' || (l.level #>> '{response,operatorWhen}') || ') && ' || t.rule END))
                          ELSE l.level END ORDER BY l.ord)
                 FROM jsonb_array_elements(t.doc -> 'levels') WITH ORDINALITY AS l(level, ord))) AS spec
      FROM targets t
), published AS (
    INSERT INTO miot_symptoms.symptom_version
        (definition_id, tenant_code, version, status, spec, bump, reason, created_by, published_by, published_at)
    SELECT r.id, r.tenant_code, r.version, 'PUBLISHED', r.spec, 'PATCH',
           'Solo los viajes tipo v, o sin tipo, van a la bandeja del operador', 'platform-seed', 'platform-seed',
           now()
      FROM rewritten r
    ON CONFLICT DO NOTHING
    RETURNING definition_id, tenant_code, version
), moved AS (
    UPDATE miot_symptoms.symptom_definition d
       SET current_version = p.version, updated_by = 'platform-seed', updated_at = now()
      FROM published p
     WHERE d.id = p.definition_id AND d.tenant_code = p.tenant_code
    RETURNING d.id, d.tenant_code, d.state, d.current_version
)
INSERT INTO miot_symptoms.audit_event (tenant_code, actor, action, entity_type, entity_id, details)
SELECT m.tenant_code, 'platform-seed', 'symptom.published', 'symptom', m.id::text,
       jsonb_build_object('version', m.current_version, 'bump', 'PATCH', 'state', m.state)
  FROM moved m;
