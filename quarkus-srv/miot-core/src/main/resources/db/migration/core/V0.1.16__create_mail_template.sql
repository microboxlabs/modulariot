-- Email templates written in Handlebars. organization_id NULL is the platform's
-- template, used by organizations without their own. Without either, the
-- built-in template is sent.
CREATE TABLE miot_core.mail_template (
    id              BIGSERIAL    PRIMARY KEY,
    organization_id BIGINT       REFERENCES miot_core.organizations (id) ON DELETE CASCADE,
    kind            VARCHAR(32)  NOT NULL,
    lang            VARCHAR(8)   NOT NULL,
    subject         VARCHAR(255) NOT NULL,
    html            TEXT         NOT NULL,
    updated_by      VARCHAR(255),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
-- One template per organization (or the platform), kind and language.
CREATE UNIQUE INDEX ux_mail_template_scope
    ON miot_core.mail_template (COALESCE(organization_id, 0), kind, lang);
