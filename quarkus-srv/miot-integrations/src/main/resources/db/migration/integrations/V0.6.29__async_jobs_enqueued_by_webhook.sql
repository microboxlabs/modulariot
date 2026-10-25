-- The Meta WhatsApp webhook enqueues one job per event it receives, as 'webhook'.

ALTER TABLE miot_integrations.async_jobs DROP CONSTRAINT IF EXISTS chk_async_jobs_enqueued_by;
ALTER TABLE miot_integrations.async_jobs ADD CONSTRAINT chk_async_jobs_enqueued_by CHECK (
    enqueued_by IN ('listener', 'reconciler', 'manual', 'webhook')
) NOT VALID;
