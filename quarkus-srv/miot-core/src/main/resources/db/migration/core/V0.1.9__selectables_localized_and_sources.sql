-- Selectables v2: texts per language, option values separate from labels,
-- groups, field settings, and where the options come from.
--
-- Rows written by V0.1.8 are converted in place: their texts become Spanish,
-- and each option's id becomes its value.

ALTER TABLE miot_core.selectables
    ALTER COLUMN name TYPE JSONB USING jsonb_build_object('es', name),
    ALTER COLUMN description TYPE JSONB USING
        CASE WHEN description IS NULL OR description = '' THEN '{}'::jsonb
             ELSE jsonb_build_object('es', description) END;

ALTER TABLE miot_core.selectables
    ALTER COLUMN description SET DEFAULT '{}',
    ALTER COLUMN description SET NOT NULL,
    -- {searchable, creatable, dependsOn, maxSelections, placeholder}
    ADD COLUMN settings JSONB NOT NULL DEFAULT '{}',
    -- [{key, label}]; options name one by key in "group".
    ADD COLUMN groups   JSONB NOT NULL DEFAULT '[]',
    -- {kind: STATIC | SYSTEM | CONNECTION, ref, config}. Only STATIC lists keep options here.
    ADD COLUMN source   JSONB NOT NULL DEFAULT '{"kind": "STATIC", "config": {}}';

-- Options were [{id, name, description}]; they become
-- [{value, label: {es}, description: {es}, disabled}].
UPDATE miot_core.selectables s
SET options = COALESCE((
        SELECT jsonb_agg(
                   jsonb_build_object(
                       'value', o ->> 'id',
                       'label', jsonb_build_object('es', o ->> 'name'),
                       'description',
                       CASE WHEN COALESCE(o ->> 'description', '') = '' THEN '{}'::jsonb
                            ELSE jsonb_build_object('es', o ->> 'description') END,
                       'disabled', false)
                   ORDER BY ord)
        FROM jsonb_array_elements(s.options) WITH ORDINALITY AS t(o, ord)), '[]'::jsonb)
WHERE jsonb_array_length(s.options) > 0
  AND s.options -> 0 ->> 'id' IS NOT NULL;
