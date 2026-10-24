-- ============================================================
-- Propósito:  V0.9.10 — cada UPDATE de los stores de fleet escribe updated_at = now().
--             Se eliminan los triggers set_resource_updated_at y su función.
-- ============================================================

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['carrier','truck','trailer','driver','resource_attribute']
    LOOP
        EXECUTE format('DROP TRIGGER trg_fleet_%s_updated ON miot_fleet.%I', t, t);
    END LOOP;
END $$;

DROP FUNCTION miot_fleet.set_resource_updated_at();
