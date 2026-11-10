-- conv_template.teams: the Adaptive Card a Teams step sends (ConvTemplate.Teams); null sends the plain card of
--   title and text, as before.
-- conv_external_event_type: the event types a system outside the modulith declared for an organization, so its
--   rules can start on them. A source's declaration replaces its rows; each type starts with "<source>.".

ALTER TABLE miot_conversational.conv_template
    ADD COLUMN teams JSONB;

CREATE TABLE miot_conversational.conv_external_event_type (
    tenant_code  VARCHAR(128) NOT NULL,
    type         VARCHAR(128) NOT NULL,
    source       VARCHAR(64)  NOT NULL,
    context_kind VARCHAR(32),
    description  TEXT,
    fields       JSONB        NOT NULL DEFAULT '[]'::jsonb,
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_code, type)
);

CREATE INDEX idx_conv_external_event_type_source
    ON miot_conversational.conv_external_event_type (tenant_code, source);

-- An event delivered again starts only the rules it has not started yet; this finds them.
CREATE INDEX idx_conv_run_event
    ON miot_conversational.conv_run (event_id);
