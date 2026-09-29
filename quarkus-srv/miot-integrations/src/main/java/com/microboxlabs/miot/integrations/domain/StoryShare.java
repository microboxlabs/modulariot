package com.microboxlabs.miot.integrations.domain;

import java.time.OffsetDateTime;

/** Access to a story granted by its owner: "read", or "write" to add versions. */
public record StoryShare(
        String storyId,
        String principal,
        String permission,
        String createdBy,
        OffsetDateTime createdAt) {
}
