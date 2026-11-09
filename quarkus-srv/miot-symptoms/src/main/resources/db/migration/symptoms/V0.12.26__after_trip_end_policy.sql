-- Trip facts survive deletion from the trips module. No event payload is kept here.
CREATE TABLE miot_symptoms.trip_end_state (
    tenant_code varchar(128) NOT NULL,
    trip_id uuid NOT NULL,
    started_at timestamptz,
    ended_at timestamptz NOT NULL,
    interval_known boolean NOT NULL DEFAULT false,
    PRIMARY KEY (tenant_code, trip_id)
);

-- New platform copies opt in only for these two templates; all other templates default to ignore.
WITH template_policy (symptom_key, policy) AS (VALUES
    ('panic-button', 'open_and_keep'),
    ('gps-sabotage', 'open_and_close')
), documents AS (
    SELECT v.definition_id, v.version, d.tenant_code, d.symptom_key,
           CASE jsonb_typeof(v.spec) WHEN 'string' THEN (v.spec #>> '{}')::jsonb ELSE v.spec END AS doc
      FROM miot_symptoms.symptom_version v
      JOIN miot_symptoms.symptom_definition d ON d.id = v.definition_id AND d.tenant_code = v.tenant_code
), policies AS (
    SELECT d.*, CASE WHEN d.tenant_code = '_platform' THEN COALESCE(t.policy, 'ignore')
           -- Preserve existing organizations' event-driven rules, without hard-coding event types in Java.
           WHEN EXISTS (SELECT 1 FROM unnest(ARRAY['signal.frame.events', 'signal.frame.sensors.panic_button',
                'signal.derived.power_disconnected', 'signal.derived.jamming']) AS p(path)
                WHERE strpos(replace(concat_ws(' ', d.doc ->> 'activation', d.doc #>> '{measure,expression}',
                    d.doc #>> '{lifecycle,open}', d.doc #>> '{lifecycle,close}', d.doc #>> '{lifecycle,note}',
                    (SELECT string_agg(level ->> 'when', ' ') FROM jsonb_array_elements(
                        CASE WHEN jsonb_typeof(d.doc -> 'levels') = 'array' THEN d.doc -> 'levels' ELSE '[]'::jsonb END
                    ) AS level)), '.?', '.'), p.path) > 0) THEN 'open_and_keep'
           ELSE 'ignore' END AS policy
      FROM documents d LEFT JOIN template_policy t ON t.symptom_key = d.symptom_key
     WHERE jsonb_typeof(d.doc -> 'lifecycle') = 'object' AND NOT (d.doc -> 'lifecycle' ? 'after_trip_end')
)
UPDATE miot_symptoms.symptom_version v
   SET spec = jsonb_set(p.doc, '{lifecycle,after_trip_end}', to_jsonb(p.policy))
  FROM policies p WHERE v.definition_id = p.definition_id AND v.version = p.version AND v.tenant_code = p.tenant_code;
