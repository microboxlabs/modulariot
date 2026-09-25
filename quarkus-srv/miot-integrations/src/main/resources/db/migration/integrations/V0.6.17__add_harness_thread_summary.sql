-- The harness compacts a long conversation into a summary and clears the
-- turns it covered. Its memory is in-process, so after a restart the panel's
-- replay of recent messages cannot restore what the summary held; storing it
-- with the thread lets the panel hand it back too.
ALTER TABLE miot_integrations.harness_thread
    ADD COLUMN summary TEXT;
