package com.microboxlabs.miot.integrations.domain;

import java.time.OffsetDateTime;

/**
 * A document kept from a chat session. Its content lives in {@link StoryVersion}
 * rows; {@code currentVersionId} names the one readers see by default.
 */
public record Story(
        String id,
        String tenantCode,
        String ownerId,
        String title,
        String description,
        String kind,
        String sourceThreadId,
        String sourceMessageId,
        String currentVersionId,
        OffsetDateTime createdAt,
        String createdBy,
        OffsetDateTime updatedAt,
        String updatedBy) {
}
