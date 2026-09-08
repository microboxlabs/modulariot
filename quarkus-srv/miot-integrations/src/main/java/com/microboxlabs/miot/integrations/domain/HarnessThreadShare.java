package com.microboxlabs.miot.integrations.domain;

import java.time.OffsetDateTime;

/**
 * Read access granted by a thread's owner to one other principal. Read-only by
 * design: a reader opens the transcript but never appends to it, which keeps
 * the harness conversation single-writer.
 */
public record HarnessThreadShare(
        String threadId,
        String principal,
        String permission,
        String createdBy,
        OffsetDateTime createdAt) {
}
