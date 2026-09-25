package com.microboxlabs.miot.integrations.domain;

import java.time.OffsetDateTime;

/**
 * One harness chat conversation. The id is minted by the client and is also the
 * {@code conversation_id} the harness groups runs by, so a reloaded thread keeps
 * its multi-turn context rather than starting a new conversation.
 *
 * <p>A thread belongs to {@code ownerId} and is private to them; other people
 * reach it only through an explicit {@link HarnessThreadShare}.
 * {@code expiresAt} is null for the common case — threads do not expire unless
 * someone says so.
 */
public record HarnessThread(
        String id,
        String tenantCode,
        String ownerId,
        String title,
        /** Compacted context the harness produced for this conversation; null until it compacts. */
        String summary,
        OffsetDateTime expiresAt,
        OffsetDateTime lastMessageAt,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {
}
