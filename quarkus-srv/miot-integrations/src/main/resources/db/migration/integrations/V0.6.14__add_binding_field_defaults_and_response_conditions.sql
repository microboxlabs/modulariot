-- Two binding-level knobs for dispatch-shaped events, both operator data:
--
-- field_defaults: fieldId -> literal used when that field's template renders
-- empty. Lets a mapping express "use the context value, else this stand-in"
-- without extending the template grammar (which must stay a strict Handlebars
-- subset so the UI preview and the runtime can never disagree).
--
-- response_conditions: how to classify a 2xx response whose BODY carries the
-- verdict ({"success": {...}, "retry": {...}} of response-path -> expected
-- value, same flat-match vocabulary as match_condition). Partners that answer
-- HTTP 200 with an application-level rejection park or retry instead of
-- reading as delivered. Empty means today's status-code-only behavior.
ALTER TABLE miot_integrations.integration_event_bindings
    ADD COLUMN field_defaults JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN response_conditions JSONB NOT NULL DEFAULT '{}'::jsonb;
