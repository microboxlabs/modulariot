-- Fetch-shaped event bindings + job results.
--
-- A binding so far only pushed: render field_templates, send, done. A fetch-shaped
-- consumer (the calendar's resource enrichment) also needs the return trip — which
-- response fields to write back, under which names. response_templates carries that
-- mapping (targetKey -> handlebars-subset template over {response}); notify-shaped
-- bindings simply leave it empty. Same sentence, one more clause — NOT a new table.
ALTER TABLE miot_integrations.integration_event_bindings
    ADD COLUMN response_templates JSONB NOT NULL DEFAULT '{}'::jsonb;

-- What a job's last successful run produced (e.g. the resolved assignment ids), for
-- the jobs console and for rollout verification. Nullable: most jobs have nothing to
-- say beyond their outcome line.
ALTER TABLE miot_integrations.async_jobs
    ADD COLUMN result JSONB;
