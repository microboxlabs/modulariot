-- Correct derived values left untranslated by V0.10.9, which is already applied.
-- Preserve stage-defined service statuses and every engine-owned projection field.
UPDATE miot_trips.trip_live live
SET status = trip.status
FROM miot_trips.trip trip
WHERE trip.id = live.trip_id AND trip.tenant_code = live.tenant_code
  AND trip.version_of IS NULL AND trip.is_active
  AND live.status = CASE trip.status
      WHEN 'planned' THEN 'planificado'
      WHEN 'in_progress' THEN 'en_ruta'
      WHEN 'completed' THEN 'realizado'
      WHEN 'cancelled' THEN 'anulado'
  END
  AND NOT EXISTS (
      SELECT 1 FROM miot_trips.stage stage
      WHERE stage.tenant_code = trip.tenant_code AND stage.subject_type = 'trip'
        AND stage.subject_id = trip.id AND stage.version_of IS NULL AND stage.is_active
        AND stage.status <> 'pending' AND stage.service_status IS NOT NULL
  );

-- Only the action is an enum; operation messages, warnings and errors are free text.
UPDATE miot_trips.feed_service
SET last_result = jsonb_set(last_result, '{action}', to_jsonb(CASE last_result->>'action'
    WHEN 'alta' THEN 'create' WHEN 'cambios' THEN 'update' WHEN 'cierre' THEN 'close'
    WHEN 'omitir' THEN 'skip' WHEN 'reportar' THEN 'report' WHEN 'pendiente' THEN 'pending'
END), false)
WHERE last_result->>'action' IN ('alta', 'cambios', 'cierre', 'omitir', 'reportar', 'pendiente');
