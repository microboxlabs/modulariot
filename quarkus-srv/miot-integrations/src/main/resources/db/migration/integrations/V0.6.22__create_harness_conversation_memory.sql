-- The harness's memory of each conversation: its turns with the tool calls
-- and results they ran, and its summary. The harness held this in process
-- memory only, so a restart or deploy left it with the answer text the panel
-- replays. It now saves the whole memory here after each run and loads it
-- when a conversation arrives that it does not hold.
--
-- conversation_key is the harness's own key (tenant, user and conversation),
-- so a caller cannot read another tenant's memory by naming its id.
CREATE TABLE miot_integrations.harness_conversation (
    conversation_key TEXT PRIMARY KEY,
    tenant_id        TEXT NOT NULL,
    user_id          TEXT,
    conversation_id  TEXT NOT NULL,
    model            TEXT,
    memory           JSONB NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_harness_conversation_tenant_updated
    ON miot_integrations.harness_conversation (tenant_id, updated_at);

-- The conversation model a thread runs on, so reopening it starts on the same
-- model. Null means the harness default.
ALTER TABLE miot_integrations.harness_thread
    ADD COLUMN model TEXT;
