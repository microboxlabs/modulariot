-- One shared checkpoint for the scheduler, including skipped or failed organizations.
-- No foreign key: progress remains valid when a caller or organization disappears.
CREATE TABLE miot_symptoms.teams_reconcile_cursor (
    id smallint PRIMARY KEY CHECK (id = 1),
    tenant_code text NOT NULL,
    performed_by text NOT NULL
);
