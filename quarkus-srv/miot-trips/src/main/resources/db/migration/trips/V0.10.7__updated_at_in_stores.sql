-- ============================================================
-- Propósito:  V0.10.7 — cada UPDATE de los stores de trips escribe updated_at = now().
--             Se eliminan los triggers set_updated_at y su función.
-- ============================================================

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['location','mandate','mandate_line',
                             'cargo_unit','trip','trip_mandate','stage','stage_activity',
                             'trip_resource_assignment','trip_cargo','trip_live']
    LOOP
        EXECUTE format('DROP TRIGGER trg_%s_updated ON miot_trips.%I', t, t);
    END LOOP;
END $$;

DROP FUNCTION miot_trips.set_updated_at();
