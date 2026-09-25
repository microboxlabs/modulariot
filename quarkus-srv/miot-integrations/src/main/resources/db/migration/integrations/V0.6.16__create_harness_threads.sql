-- Durable transcripts for the harness chat panel. The panel used to keep its
-- sessions in component state, so every reload started from an empty chat.
--
-- The thread id is minted by the client and doubles as the harness
-- `conversation_id`, which is what lets a reloaded thread keep its multi-turn
-- context instead of starting over.
CREATE TABLE miot_integrations.harness_thread (
    id              UUID PRIMARY KEY,
    tenant_code     VARCHAR(128) NOT NULL,
    owner_id        VARCHAR(256) NOT NULL,
    title           VARCHAR(280),
    -- NULL means the thread never expires, which is the default. A value is
    -- set by the owner (or by a future org-level retention policy) and the
    -- purge job deletes the row once it passes.
    expires_at      TIMESTAMPTZ,
    last_message_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

-- The history panel: one owner's live threads, newest activity first.
CREATE INDEX idx_harness_thread_owner
    ON miot_integrations.harness_thread(tenant_code, owner_id, last_message_at DESC)
    WHERE deleted_at IS NULL;
-- The purge job's two driving branches: threads past their expiry, and
-- threads a user deleted once the grace window closes.
CREATE INDEX idx_harness_thread_expiry
    ON miot_integrations.harness_thread(expires_at)
    WHERE expires_at IS NOT NULL;
CREATE INDEX idx_harness_thread_deleted
    ON miot_integrations.harness_thread(deleted_at)
    WHERE deleted_at IS NOT NULL;

-- One row per assistant-ui message. `payload` is the message as the client
-- serialized it, opaque here: the modulith stores and returns it without
-- interpreting its shape. `format` names that shape so a future assistant-ui
-- change is detectable instead of silently undecodable.
--
-- The id is the client's message id (assistant-ui's `generateId()`, not a
-- UUID), and (thread_id, id) is the upsert key — the history adapter may
-- rewrite a message it already appended, e.g. when a run resumes.
CREATE TABLE miot_integrations.harness_thread_message (
    thread_id  UUID         NOT NULL REFERENCES miot_integrations.harness_thread(id) ON DELETE CASCADE,
    id         VARCHAR(128) NOT NULL,
    parent_id  VARCHAR(128),
    seq        BIGSERIAL    NOT NULL,
    format     VARCHAR(32)  NOT NULL,
    payload    JSONB        NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (thread_id, id)
);

-- Replaying a thread reads it in append order; `seq` rather than `created_at`
-- because a run appends several messages inside the same millisecond.
CREATE INDEX idx_harness_thread_message_seq
    ON miot_integrations.harness_thread_message(thread_id, seq);

-- A thread is private to its author. Sharing is explicit, per principal, and
-- read-only: a reader can open the transcript but cannot append to it, which
-- keeps the harness conversation single-writer.
CREATE TABLE miot_integrations.harness_thread_share (
    thread_id  UUID         NOT NULL REFERENCES miot_integrations.harness_thread(id) ON DELETE CASCADE,
    principal  VARCHAR(256) NOT NULL,
    permission VARCHAR(16)  NOT NULL DEFAULT 'read',
    created_by VARCHAR(256) NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (thread_id, principal),
    CONSTRAINT chk_harness_thread_share_permission CHECK (permission IN ('read'))
);

-- "Shared with me" listing.
CREATE INDEX idx_harness_thread_share_principal
    ON miot_integrations.harness_thread_share(principal);
