-- A learning thread is a trainer's session that edits the harness's knowledge;
-- the app lists it apart from ordinary chats.
ALTER TABLE miot_integrations.harness_thread
    ADD COLUMN kind VARCHAR(16) NOT NULL DEFAULT 'chat',
    ADD CONSTRAINT chk_harness_thread_kind CHECK (kind IN ('chat', 'learning'));
