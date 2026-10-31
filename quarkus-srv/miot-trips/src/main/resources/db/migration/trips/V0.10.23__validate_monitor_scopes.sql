-- Validate scopes after the original V0.10.22, which is already applied.
-- Configuration is preserved; ambiguous latest published scopes abort deployment
-- with the tenant and monitor keys to adjust before retrying.
DO $$
DECLARE
    pair RECORD;
    dimension TEXT;
    left_values TEXT[];
    right_values TEXT[];
    has_intersection BOOLEAN;
    left_inside BOOLEAN;
    right_inside BOOLEAN;
BEGIN
    FOR pair IN
        WITH latest AS (
            SELECT DISTINCT ON (tenant_code, monitor_key) tenant_code, monitor_key, scope
              FROM miot_trips.trip_monitor
             WHERE status = 'published'
             ORDER BY tenant_code, monitor_key, version DESC
        )
        SELECT a.tenant_code, a.monitor_key AS left_key, b.monitor_key AS right_key,
               a.scope AS left_scope, b.scope AS right_scope
          FROM latest a JOIN latest b
            ON a.tenant_code = b.tenant_code AND a.monitor_key < b.monitor_key
         WHERE a.scope IS NOT NULL AND b.scope IS NOT NULL
    LOOP
        has_intersection := true;
        left_inside := true;
        right_inside := true;
        FOREACH dimension IN ARRAY ARRAY['feeds', 'orderTypes', 'origins', 'destinations'] LOOP
            SELECT ARRAY(SELECT DISTINCT btrim(value)
                           FROM jsonb_array_elements_text(pair.left_scope -> dimension) value
                          WHERE btrim(value) <> '') INTO left_values;
            SELECT ARRAY(SELECT DISTINCT btrim(value)
                           FROM jsonb_array_elements_text(pair.right_scope -> dimension) value
                          WHERE btrim(value) <> '') INTO right_values;
            IF cardinality(left_values) > 0 AND cardinality(right_values) > 0
                    AND NOT left_values && right_values THEN
                has_intersection := false;
                EXIT;
            END IF;
            left_inside := left_inside AND (cardinality(right_values) = 0
                OR (cardinality(left_values) > 0 AND right_values @> left_values));
            right_inside := right_inside AND (cardinality(left_values) = 0
                OR (cardinality(right_values) > 0 AND left_values @> right_values));
        END LOOP;
        IF has_intersection AND left_inside = right_inside THEN
            RAISE EXCEPTION 'Cannot validate monitor scopes: tenant %, monitors % and % have equal or partly overlapping scopes. Adjust monitor scopes to be disjoint or nested before retrying.',
                pair.tenant_code, pair.left_key, pair.right_key;
        END IF;
    END LOOP;
END $$;

