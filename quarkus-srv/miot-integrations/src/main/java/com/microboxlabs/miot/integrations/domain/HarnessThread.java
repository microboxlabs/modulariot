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
        /** The conversation model the thread last ran on; null for the harness default. */
        String model,
        OffsetDateTime expiresAt,
        OffsetDateTime lastMessageAt,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        /** True once a person named the thread; a generated title never replaces theirs. */
        boolean titleEdited,
        /** {@link #CHAT}, or {@link #LEARNING} for a trainer's session; fixed at creation. */
        String kind) {

    public static final String CHAT = "chat";
    public static final String LEARNING = "learning";

    public HarnessThread(
            String id,
            String tenantCode,
            String ownerId,
            String title,
            String summary,
            String model,
            OffsetDateTime expiresAt,
            OffsetDateTime lastMessageAt,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt,
            boolean titleEdited) {
        this(id, tenantCode, ownerId, title, summary, model, expiresAt, lastMessageAt, createdAt, updatedAt,
                titleEdited, CHAT);
    }

    public HarnessThread(
            String id,
            String tenantCode,
            String ownerId,
            String title,
            String summary,
            String model,
            OffsetDateTime expiresAt,
            OffsetDateTime lastMessageAt,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt) {
        this(id, tenantCode, ownerId, title, summary, model, expiresAt, lastMessageAt, createdAt, updatedAt, false,
                CHAT);
    }
}
