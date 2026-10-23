package com.microboxlabs.miot.conversational.domain;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.OffsetDateTime;
import java.util.Map;

/**
 * A single message in the timeline of a {@link Conversation}. {@code serviceCode} /
 * {@code processInstanceId} are snapshotted so the message stays attributable to a trip
 * even after the conversation's current context moves on.
 *
 * <p>{@code providerMessageId} is the channel provider's id (the WhatsApp wamid), unique per
 * channel. {@code inReplyTo} is the message this one answers, when the provider says so.
 * {@code runId} / {@code step} are set on rule-started messages.
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
        String providerMessageId,
        MessageStatus status,
        String errorMessage,
        String sentByUserId,
        String serviceCode,
        String processInstanceId,
        Map<String, Object> metadata,
        OffsetDateTime sentAt,
        OffsetDateTime deliveredAt,
        OffsetDateTime readAt,
        OffsetDateTime createdAt,
        Channel channel,
        String address,
        String inReplyTo,
        String runId,
        Integer step) {

    /** The provider id under its former JSON name; existing API clients read {@code metaMessageId}. */
    @JsonProperty("metaMessageId")
    public String metaMessageId() {
        return providerMessageId;
    }
}
