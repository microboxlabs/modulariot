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
        String summary,
        /** The conversation model the thread last ran on; null for the default. */
        String model,
        String ownerId,
        boolean owned,
        OffsetDateTime expiresAt,
        OffsetDateTime lastMessageAt,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        List<String> sharedWith,
        /** True once a person named the thread; the panel stops generating titles for it. */
        boolean titleEdited,
        /** {@code chat}, or {@code learning} for a trainer's session. */
        String kind) {
}
