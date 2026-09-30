-- The panel titles a thread from its first exchange. Once a person names the
-- thread themselves, that generated title must not replace theirs.
ALTER TABLE miot_integrations.harness_thread
    ADD COLUMN title_edited BOOLEAN NOT NULL DEFAULT false;
