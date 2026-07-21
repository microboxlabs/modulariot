package com.microboxlabs.miot.integrations.domain;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * A per-tenant, per-job-type failure-notification rule: when an async job of
 * {@code jobType} parks as FAILED, message {@code recipients} on
 * {@code channel} — at most once per {@code throttleSeconds}
 * ({@code lastNotifiedAt} is the throttle state, claimed atomically so a burst
 * of parks produces one notification).
 */
public record JobNotificationRule(
        String id,
        String tenantCode,
        String jobType,
        String channel,
        List<String> recipients,
        boolean enabled,
        int throttleSeconds,
        String templateName,
        String language,
        OffsetDateTime lastNotifiedAt,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {

    public static final String CHANNEL_WHATSAPP = "whatsapp";
}
