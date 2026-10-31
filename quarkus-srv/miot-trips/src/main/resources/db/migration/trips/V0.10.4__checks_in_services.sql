-- ============================================================
-- Propósito:  V0.10.4 — dos reglas pasan de triggers a los services de trips:
--             - un mandato cerrado o anulado no toma viajes nuevos (MandateService.requireOpen);
--             - una asignación apunta a un recurso vigente de fleet (FleetResources, implementado por fleet).
-- ============================================================

DROP TRIGGER trg_trip_mandate_open ON miot_trips.trip_mandate;
DROP FUNCTION miot_trips.fn_trip_mandate_open();

DROP TRIGGER trg_assignment_resource_check ON miot_trips.trip_resource_assignment;
DROP FUNCTION miot_trips.fn_assignment_resource_check();
