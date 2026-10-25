-- Validate the expanded enqueue source after the constraint change has committed,
-- without holding the previous migration's ACCESS EXCLUSIVE lock during the scan.
ALTER TABLE miot_integrations.async_jobs VALIDATE CONSTRAINT chk_async_jobs_enqueued_by;
