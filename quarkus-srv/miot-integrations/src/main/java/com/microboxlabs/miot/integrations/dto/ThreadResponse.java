package com.microboxlabs.miot.integrations.dto;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * A thread as its reader sees it. {@code owned} separates "mine" from "shared
 * with me" so the panel can label the second kind and hide the controls only an
 * owner may use; {@code sharedWith} is populated for the owner alone — a reader
 * has no business enumerating the other readers.
 */
public record ThreadResponse(
        String id,
        String title,
        String ownerId,
        boolean owned,
        OffsetDateTime expiresAt,
        OffsetDateTime lastMessageAt,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        List<String> sharedWith) {
}
