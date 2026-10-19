package com.microboxlabs.miot.integrations.domain;

import java.time.OffsetDateTime;

/**
 * A link to a read-only snapshot of a story or a chat thread, open to any
 * member of the organization while it is not revoked.
 */
public record ShareLink(
        String token,
        String tenantCode,
        String targetType,
        String targetId,
        String access,
        String createdBy,
        OffsetDateTime createdAt) {

    public static final String STORY = "story";
    public static final String THREAD = "thread";
}
