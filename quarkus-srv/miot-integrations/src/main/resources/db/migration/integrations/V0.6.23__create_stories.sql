-- Stories: documents a user keeps from a chat session (a report, a deck, a
-- chart), versioned, and shareable like chat threads.
CREATE TABLE miot_integrations.story (
    id                 UUID PRIMARY KEY,
    tenant_code        VARCHAR(128) NOT NULL,
    owner_id           VARCHAR(256) NOT NULL,
    title              VARCHAR(280) NOT NULL,
    description        VARCHAR(2000),
    kind               VARCHAR(16)  NOT NULL,
    source_thread_id   UUID,
    source_message_id  VARCHAR(128),
    -- No foreign key: the version row references the story, and a cycle would
    -- make every insert and purge order-sensitive. The service only ever sets
    -- it to a version of the same story.
    current_version_id UUID,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by         VARCHAR(256) NOT NULL,
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by         VARCHAR(256) NOT NULL,
    deleted_at         TIMESTAMPTZ,
    CONSTRAINT chk_story_kind CHECK (kind IN ('markdown', 'html', 'svg', 'deck', 'pdf', 'sections'))
);

CREATE INDEX idx_story_owner
    ON miot_integrations.story(tenant_code, owner_id, updated_at DESC)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_story_deleted
    ON miot_integrations.story(deleted_at)
    WHERE deleted_at IS NOT NULL;

-- Versions form a tree through parent_id. A PDF is stored base64-encoded in
-- `content`, so every kind travels the same way through JSON. Structured
-- kinds (deck, sections) keep their shape in `metadata`.
CREATE TABLE miot_integrations.story_version (
    id           UUID PRIMARY KEY,
    story_id     UUID         NOT NULL REFERENCES miot_integrations.story(id) ON DELETE CASCADE,
    parent_id    UUID REFERENCES miot_integrations.story_version(id),
    label        VARCHAR(120) NOT NULL,
    summary      VARCHAR(2000),
    content_type VARCHAR(128) NOT NULL,
    content      TEXT,
    metadata     JSONB,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by   VARCHAR(256) NOT NULL
);

CREATE INDEX idx_story_version_story
    ON miot_integrations.story_version(story_id, created_at);

CREATE TABLE miot_integrations.story_share (
    story_id   UUID         NOT NULL REFERENCES miot_integrations.story(id) ON DELETE CASCADE,
    principal  VARCHAR(256) NOT NULL,
    permission VARCHAR(16)  NOT NULL DEFAULT 'read',
    created_by VARCHAR(256) NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (story_id, principal),
    CONSTRAINT chk_story_share_permission CHECK (permission IN ('read', 'write'))
);

CREATE INDEX idx_story_share_principal
    ON miot_integrations.story_share(principal);

-- A link lets any member of the organization open a read-only snapshot of a
-- story or a chat thread. The target is polymorphic, so it carries no foreign
-- key; resolving a link re-checks that the target is still live.
CREATE TABLE miot_integrations.share_link (
    token       VARCHAR(64)  PRIMARY KEY,
    tenant_code VARCHAR(128) NOT NULL,
    target_type VARCHAR(16)  NOT NULL,
    target_id   UUID         NOT NULL,
    access      VARCHAR(16)  NOT NULL DEFAULT 'org',
    created_by  VARCHAR(256) NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    revoked_at  TIMESTAMPTZ,
    CONSTRAINT chk_share_link_target_type CHECK (target_type IN ('story', 'thread')),
    CONSTRAINT chk_share_link_access CHECK (access IN ('org'))
);

CREATE UNIQUE INDEX idx_share_link_target
    ON miot_integrations.share_link(tenant_code, target_type, target_id)
    WHERE revoked_at IS NULL;
