-- ============================================================
-- Propósito:  V0.10.5 — dos efectos laterales pasan de triggers al código de trips:
--             - crear un mandato crea su línea seq 1 (PgMandateStore.insertOrGet);
--             - montar una carga vincula su mandato al viaje (TripCargoService.mount).
-- ============================================================

DROP TRIGGER trg_mandate_autoline ON miot_trips.mandate;
DROP FUNCTION miot_trips.fn_mandate_autoline();

DROP TRIGGER trg_trip_cargo_consistency ON miot_trips.trip_cargo;
DROP FUNCTION miot_trips.fn_trip_cargo_consistency();
