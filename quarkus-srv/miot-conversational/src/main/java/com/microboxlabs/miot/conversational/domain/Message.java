package com.microboxlabs.miot.conversational.domain;

import java.time.OffsetDateTime;
import java.util.Map;

/**
 * A single message in the timeline of a {@link Conversation}. {@code serviceCode} /
 * {@code processInstanceId} are snapshotted so the message stays attributable to a trip
 * even after the conversation's current context moves on.
 */
public record Message(
        String id,
        String conversationId,
        MessageDirection direction,
        MessageRole role,
        MessageType type,
        String body,
        String templateName,
        String mediaRef,
        String mediaMimeType,
        String mediaFileName,
        String metaMessageId,
        MessageStatus status,
        String errorMessage,
        String sentByUserId,
        String serviceCode,
        String processInstanceId,
        Map<String, Object> metadata,
        OffsetDateTime sentAt,
        OffsetDateTime deliveredAt,
        OffsetDateTime readAt,
        OffsetDateTime createdAt) {
}
