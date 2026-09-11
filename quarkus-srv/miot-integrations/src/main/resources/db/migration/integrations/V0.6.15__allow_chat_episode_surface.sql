-- The chat panel has been posting `surface: "chat"` episodes since the harness
-- chat shipped; both this constraint and EpisodeService rejected every one of
-- them, so chat left no learning signal at all.
ALTER TABLE miot_integrations.interaction_episodes
    DROP CONSTRAINT chk_interaction_episodes_surface;

ALTER TABLE miot_integrations.interaction_episodes
    ADD CONSTRAINT chk_interaction_episodes_surface CHECK (
        surface IN ('spotlight', 'cli', 'chat')
    );
