package com.microboxlabs.miot.integrations.domain;

import java.time.OffsetDateTime;
import java.util.Map;

/**
 * One message of a thread, stored as the client serialized it. {@code payload}
 * is opaque here — the modulith persists and returns it without interpreting
 * its shape — and {@code format} names that shape, so a client-side change is
 * detectable instead of silently undecodable.
 *
 * <p>{@code id} is the client's message id, not a UUID, and {@code parentId}
 * carries the thread's branch structure.
 */
public record HarnessThreadMessage(
        String threadId,
        String id,
        String parentId,
        String format,
        Map<String, Object> payload,
        /** Append position within the thread; 0 for a message not yet stored. */
        long seq,
        OffsetDateTime createdAt) {
}
