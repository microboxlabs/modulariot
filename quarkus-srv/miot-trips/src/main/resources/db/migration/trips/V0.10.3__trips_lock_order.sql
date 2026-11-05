-- ============================================================
-- Propósito:  V0.10.3 — triggers de trips compatibles con las transacciones de dominio.
--             Con cada operación en una transacción, los locks quedan tomados hasta el commit:
--             - el estado del mandato se lee con FOR SHARE, así un vínculo espera a un cierre
--               o anulación concurrente y ve su resultado;
--             - trip_live se refresca por cambios de ubicación o carga solo cuando cambia lo que
--               muestra (nombre, descripción): un cambio de estado de la carga al cerrar una
--               etapa no toma el lock de otros viajes.
-- ============================================================

CREATE OR REPLACE FUNCTION miot_trips.fn_trip_mandate_open() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_status VARCHAR(16);
BEGIN
    IF NEW.version_of IS NOT NULL THEN
        RETURN NEW;
    END IF;
    SELECT m.status INTO v_status FROM miot_trips.mandate m
    WHERE m.id = NEW.mandate_id AND m.tenant_code = NEW.tenant_code
    FOR SHARE;
    IF v_status IN ('cerrado', 'anulado') THEN
        RAISE EXCEPTION 'mandate % is %', NEW.mandate_id, v_status;
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER trg_trip_live_location ON miot_trips.location;
CREATE TRIGGER trg_trip_live_location AFTER UPDATE ON miot_trips.location
FOR EACH ROW WHEN (OLD.name IS DISTINCT FROM NEW.name)
EXECUTE FUNCTION miot_trips.fn_trip_live_from_reference();

DROP TRIGGER trg_trip_live_cargo ON miot_trips.cargo_unit;
CREATE TRIGGER trg_trip_live_cargo AFTER UPDATE ON miot_trips.cargo_unit
FOR EACH ROW WHEN (OLD.description IS DISTINCT FROM NEW.description)
EXECUTE FUNCTION miot_trips.fn_trip_live_from_reference();
