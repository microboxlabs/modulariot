package com.microboxlabs.miot.integrations.domain;

import java.time.OffsetDateTime;
import java.util.Map;

/**
 * One append-only interaction episode: a user&lt;-&gt;agent session's raw signal for
 * the semantic-layer continual-learning loop. {@code payload} (JSONB) carries the
 * rich content — query, route/tools/answer, ground-or-flag assumptions, a clicked
 * result id, or a {@code /remember} fact — while the columns hold what the
 * distiller filters and scopes on. Write-once; never a job ledger (no
 * retry/claim/lifecycle, unlike {@code AsyncJob}).
 */
public record InteractionEpisode(
        String id,
        String tenantCode,
        String userId,
        String surface,
        String runId,
        String signal,
        Map<String, Object> payload,
        OffsetDateTime createdAt) {
}
