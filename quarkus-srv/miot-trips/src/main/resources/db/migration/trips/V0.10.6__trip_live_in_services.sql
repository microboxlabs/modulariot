-- ============================================================
-- Propósito:  V0.10.6 — la proyección trip_live la reconstruye TripLiveProjector, llamado por los
--             services antes del commit. Se eliminan sus triggers y funciones.
-- ============================================================

DROP TRIGGER trg_trip_live_trip ON miot_trips.trip;
DROP TRIGGER trg_trip_live_assignment ON miot_trips.trip_resource_assignment;
DROP TRIGGER trg_trip_live_stage ON miot_trips.stage;
DROP TRIGGER trg_trip_live_tm ON miot_trips.trip_mandate;
DROP TRIGGER trg_trip_live_tc ON miot_trips.trip_cargo;
DROP TRIGGER trg_trip_live_location ON miot_trips.location;
DROP TRIGGER trg_trip_live_cargo ON miot_trips.cargo_unit;

DROP FUNCTION miot_trips.fn_trip_live_from_trip();
DROP FUNCTION miot_trips.fn_trip_live_from_child();
DROP FUNCTION miot_trips.fn_trip_live_from_reference();
DROP FUNCTION miot_trips.fn_trip_live_refresh(UUID);
