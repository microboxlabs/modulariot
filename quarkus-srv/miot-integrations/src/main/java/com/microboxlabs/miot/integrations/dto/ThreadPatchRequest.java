package com.microboxlabs.miot.integrations.dto;

import java.time.OffsetDateTime;

/**
 * Partial update of a thread. Both fields are optional and a field left null is
 * left alone, so {@code clearExpiry} is how a caller asks for "never expires"
 * — null {@code expiresAt} cannot say that on its own.
 */
public record ThreadPatchRequest(
        String title,
        OffsetDateTime expiresAt,
        Boolean clearExpiry) {
}
