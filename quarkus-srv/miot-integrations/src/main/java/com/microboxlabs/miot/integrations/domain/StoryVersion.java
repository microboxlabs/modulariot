package com.microboxlabs.miot.integrations.domain;

import java.time.OffsetDateTime;
import java.util.Map;

/**
 * One version of a story. Versions form a tree through {@code parentId}.
 * {@code content} is text, base64 for a PDF; {@code metadata} holds the
 * structure of a deck or a sectioned story. Listings leave both out.
 */
public record StoryVersion(
        String id,
        String storyId,
        String parentId,
        String label,
        String summary,
        String contentType,
        String content,
        Map<String, Object> metadata,
        OffsetDateTime createdAt,
        String createdBy) {
}
