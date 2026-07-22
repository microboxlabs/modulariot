package com.microboxlabs.miot.integrations.dto;

import java.util.Map;

/**
 * Request body to append an interaction episode. {@code surface} is required
 * ('spotlight' | 'cli'); everything else is optional. {@code payload} is free-form
 * JSONB — the query, route/tools/answer, ground-or-flag assumptions, a clicked
 * result id, or a {@code /remember} fact. Validation is imperative in
 * {@code EpisodeService} (mirrors the other integrations DTOs — plain records,
 * no bean-validation annotations). tenant + user identity are NEVER taken from
 * the body; the resource injects them from the session.
 */
public record EpisodeRequest(
        String surface,
        String runId,
        String signal,
        Map<String, Object> payload) {
}
