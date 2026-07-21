-- Per-tenant, per-job-type opt-in failure notifications: when an async job parks
-- as FAILED, matching enabled rules fire a notification job on the configured
-- channel. Configured from the jobs console; matched by the park hook in
-- AsyncJobService. See docs/job-failure-notifications.md.
CREATE TABLE miot_integrations.job_notification_rules (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_code      VARCHAR(128) NOT NULL,
    job_type         VARCHAR(64)  NOT NULL,
    channel          VARCHAR(32)  NOT NULL DEFAULT 'whatsapp',
    -- JSON array of E.164 recipient phone numbers ("+569...").
    recipients       JSONB        NOT NULL DEFAULT '[]'::jsonb,
    enabled          BOOLEAN      NOT NULL DEFAULT TRUE,
    -- Minimum gap between notifications for this rule; a burst of parks inside
    -- the window coalesces into the one already sent. 0 = no throttle.
    throttle_seconds INTEGER      NOT NULL DEFAULT 300,
    -- Optional pre-approved Meta template; absent = free-form text (only
    -- delivered inside an open 24h session window).
    template_name    VARCHAR(128),
    language         VARCHAR(16),
    -- Throttle state, claimed atomically (UPDATE ... WHERE window elapsed).
    last_notified_at TIMESTAMPTZ,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_job_notification_rules_channel CHECK (channel IN ('whatsapp')),
    CONSTRAINT chk_job_notification_rules_throttle CHECK (throttle_seconds >= 0)
);

-- One rule per (tenant, job type, channel) — also serves the park-hook lookup.
CREATE UNIQUE INDEX idx_job_notification_rules_key
    ON miot_integrations.job_notification_rules(tenant_code, job_type, channel);
