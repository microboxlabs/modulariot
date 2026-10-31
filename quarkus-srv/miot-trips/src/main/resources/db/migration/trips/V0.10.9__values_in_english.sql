-- ============================================================
-- V0.10.9 — status values, stage and location types in English, like the rest of the API
-- (field names, fleet statuses, resource types). History rows are translated too; the
-- versioning triggers stay off while the values change, so no version rows are written.
--   mandate        activo/en_ejecucion/cerrado/anulado      → active/in_progress/closed/cancelled
--   trip           planificado/en_ruta/realizado/anulado    → planned/in_progress/completed/cancelled
--   stage          pendiente/en_curso/cerrada               → pending/in_progress/completed
--   stage type     preparacion/carga/transito/parada/descarga/cierre
--                                                           → preparation/loading/transit/stop/unloading/closing
--   activity       pendiente/en_curso/hecha/no_aplica       → pending/in_progress/done/not_applicable
--   cargo          anunciada/lista/retirada/entregada/recibida/rechazada
--                                                           → announced/ready/picked_up/delivered/received/rejected
--   receipt        conforme/diferencia                      → conforming/discrepancy
--   location type  planta/puerto/cd/cliente/zona            → plant/port/distribution_center/customer/zone
--   feed action    alta/cambios/cierre/omitir/reportar/pendiente → create/update/close/skip/report/pending
-- ============================================================

ALTER TABLE miot_trips.mandate DISABLE TRIGGER trg_mandate_zversion;
ALTER TABLE miot_trips.trip DISABLE TRIGGER trg_trip_zversion;
ALTER TABLE miot_trips.stage DISABLE TRIGGER trg_stage_zversion;
ALTER TABLE miot_trips.stage_activity DISABLE TRIGGER trg_stage_activity_zversion;
ALTER TABLE miot_trips.cargo_unit DISABLE TRIGGER trg_cargo_unit_zversion;
ALTER TABLE miot_trips.location DISABLE TRIGGER trg_location_zversion;

ALTER TABLE miot_trips.mandate DROP CONSTRAINT mandate_status_check;
ALTER TABLE miot_trips.trip DROP CONSTRAINT trip_status_check;
ALTER TABLE miot_trips.stage DROP CONSTRAINT stage_status_check;
ALTER TABLE miot_trips.stage DROP CONSTRAINT stage_stage_type_check;
ALTER TABLE miot_trips.stage_activity DROP CONSTRAINT stage_activity_status_check;
ALTER TABLE miot_trips.cargo_unit DROP CONSTRAINT cargo_unit_status_check;
ALTER TABLE miot_trips.cargo_unit DROP CONSTRAINT cargo_unit_receipt_result_check;
ALTER TABLE miot_trips.location DROP CONSTRAINT location_type_check;
DROP INDEX miot_trips.uq_stage_one_running;

UPDATE miot_trips.mandate SET status = CASE status
    WHEN 'activo' THEN 'active' WHEN 'en_ejecucion' THEN 'in_progress'
    WHEN 'cerrado' THEN 'closed' WHEN 'anulado' THEN 'cancelled' ELSE status END;
UPDATE miot_trips.trip SET status = CASE status
    WHEN 'planificado' THEN 'planned' WHEN 'en_ruta' THEN 'in_progress'
    WHEN 'realizado' THEN 'completed' WHEN 'anulado' THEN 'cancelled' ELSE status END;
UPDATE miot_trips.stage SET
    status = CASE status
        WHEN 'pendiente' THEN 'pending' WHEN 'en_curso' THEN 'in_progress' WHEN 'cerrada' THEN 'completed'
        ELSE status END,
    stage_type = CASE stage_type
        WHEN 'preparacion' THEN 'preparation' WHEN 'carga' THEN 'loading' WHEN 'transito' THEN 'transit'
        WHEN 'parada' THEN 'stop' WHEN 'descarga' THEN 'unloading' WHEN 'cierre' THEN 'closing'
        ELSE stage_type END;
UPDATE miot_trips.stage_activity SET status = CASE status
    WHEN 'pendiente' THEN 'pending' WHEN 'en_curso' THEN 'in_progress'
    WHEN 'hecha' THEN 'done' WHEN 'no_aplica' THEN 'not_applicable' ELSE status END;
UPDATE miot_trips.cargo_unit SET
    status = CASE status
        WHEN 'anunciada' THEN 'announced' WHEN 'lista' THEN 'ready' WHEN 'retirada' THEN 'picked_up'
        WHEN 'entregada' THEN 'delivered' WHEN 'recibida' THEN 'received' WHEN 'rechazada' THEN 'rejected'
        ELSE status END,
    receipt_result = CASE receipt_result
        WHEN 'conforme' THEN 'conforming' WHEN 'diferencia' THEN 'discrepancy' ELSE receipt_result END;
UPDATE miot_trips.location SET type = CASE type
    WHEN 'planta' THEN 'plant' WHEN 'puerto' THEN 'port' WHEN 'cd' THEN 'distribution_center'
    WHEN 'cliente' THEN 'customer' WHEN 'zona' THEN 'zone' ELSE type END;

UPDATE miot_trips.feed_profile SET
    stages = replace(replace(replace(replace(replace(replace(stages::text,
        '"preparacion"', '"preparation"'), '"carga"', '"loading"'), '"transito"', '"transit"'),
        '"parada"', '"stop"'), '"descarga"', '"unloading"'), '"cierre"', '"closing"')::jsonb,
    departure_stage = CASE departure_stage
        WHEN 'preparacion' THEN 'preparation' WHEN 'carga' THEN 'loading' WHEN 'transito' THEN 'transit'
        WHEN 'parada' THEN 'stop' WHEN 'descarga' THEN 'unloading' WHEN 'cierre' THEN 'closing'
        ELSE departure_stage END,
    close_stage = CASE close_stage
        WHEN 'preparacion' THEN 'preparation' WHEN 'carga' THEN 'loading' WHEN 'transito' THEN 'transit'
        WHEN 'parada' THEN 'stop' WHEN 'descarga' THEN 'unloading' WHEN 'cierre' THEN 'closing'
        ELSE close_stage END;
UPDATE miot_trips.feed_service SET last_action = CASE last_action
    WHEN 'alta' THEN 'create' WHEN 'cambios' THEN 'update' WHEN 'cierre' THEN 'close'
    WHEN 'omitir' THEN 'skip' WHEN 'reportar' THEN 'report' WHEN 'pendiente' THEN 'pending'
    ELSE last_action END;

ALTER TABLE miot_trips.mandate ADD CONSTRAINT mandate_status_check
    CHECK (status IN ('active', 'in_progress', 'closed', 'cancelled'));
ALTER TABLE miot_trips.mandate ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE miot_trips.trip ADD CONSTRAINT trip_status_check
    CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled'));
ALTER TABLE miot_trips.trip ALTER COLUMN status SET DEFAULT 'planned';
ALTER TABLE miot_trips.stage ADD CONSTRAINT stage_status_check
    CHECK (status IN ('pending', 'in_progress', 'completed'));
ALTER TABLE miot_trips.stage ADD CONSTRAINT stage_stage_type_check
    CHECK (stage_type IN ('preparation', 'loading', 'transit', 'stop', 'unloading', 'closing'));
ALTER TABLE miot_trips.stage ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE miot_trips.stage_activity ADD CONSTRAINT stage_activity_status_check
    CHECK (status IN ('pending', 'in_progress', 'done', 'not_applicable'));
ALTER TABLE miot_trips.stage_activity ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE miot_trips.cargo_unit ADD CONSTRAINT cargo_unit_status_check
    CHECK (status IN ('announced', 'ready', 'picked_up', 'delivered', 'received', 'rejected'));
ALTER TABLE miot_trips.cargo_unit ADD CONSTRAINT cargo_unit_receipt_result_check
    CHECK (receipt_result IN ('conforming', 'discrepancy'));
ALTER TABLE miot_trips.cargo_unit ALTER COLUMN status SET DEFAULT 'announced';
ALTER TABLE miot_trips.location ADD CONSTRAINT location_type_check
    CHECK (type IN ('plant', 'port', 'distribution_center', 'customer', 'zone'));
CREATE UNIQUE INDEX uq_stage_one_running ON miot_trips.stage (subject_type, subject_id)
    WHERE status = 'in_progress' AND version_of IS NULL AND is_active;

ALTER TABLE miot_trips.mandate ENABLE TRIGGER trg_mandate_zversion;
ALTER TABLE miot_trips.trip ENABLE TRIGGER trg_trip_zversion;
ALTER TABLE miot_trips.stage ENABLE TRIGGER trg_stage_zversion;
ALTER TABLE miot_trips.stage_activity ENABLE TRIGGER trg_stage_activity_zversion;
ALTER TABLE miot_trips.cargo_unit ENABLE TRIGGER trg_cargo_unit_zversion;
ALTER TABLE miot_trips.location ENABLE TRIGGER trg_location_zversion;
