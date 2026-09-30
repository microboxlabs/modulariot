package com.microboxlabs.miot.integrations.dto;

import java.time.OffsetDateTime;

/**
 * Creates a thread, or renames one that already exists. The id is minted by the
 * client so the same value can be used as the harness {@code conversation_id}
 * before the row exists. Re-posting an existing id is not an error: the panel
 * creates a thread lazily on the first message and may retry.
 *
 * <p>{@code expiresAt} null means the thread never expires. {@code kind} is
 * {@code chat} (the default) or {@code learning}, and only counts when the
 * thread is created.
 */
public record ThreadUpsertRequest(
        String id,
        String title,
        OffsetDateTime expiresAt,
        String kind) {

    public ThreadUpsertRequest(String id, String title, OffsetDateTime expiresAt) {
        this(id, title, expiresAt, null);
    }
}
