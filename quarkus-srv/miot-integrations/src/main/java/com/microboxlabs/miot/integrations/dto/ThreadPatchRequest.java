package com.microboxlabs.miot.integrations.dto;

import java.time.OffsetDateTime;

/**
 * Partial update of a thread. Every field is optional and a field left null is
 * left alone, so {@code clearExpiry} is how a caller asks for "never expires"
 * — null {@code expiresAt} cannot say that on its own.
 *
 * <p>A title is taken as the person naming the thread unless {@code autoTitle}
 * is set; a generated title is dropped once the thread has been named.
 */
public record ThreadPatchRequest(
        String title,
        OffsetDateTime expiresAt,
        Boolean clearExpiry,
        String summary,
        /** The conversation model picked for this thread. */
        String model,
        Boolean autoTitle) {

    public ThreadPatchRequest(
            String title, OffsetDateTime expiresAt, Boolean clearExpiry, String summary, String model) {
        this(title, expiresAt, clearExpiry, summary, model, null);
    }
}
