package com.microboxlabs.miot.conversational.events;

import com.microboxlabs.miot.conversational.domain.Channel;
import java.time.OffsetDateTime;

/**
 * {@code conversation.reply_received}: an inbound message was stored on a conversation. Fired
 * asynchronously (observe it with {@code @ObservesAsync}) after the message and the conversation
 * touch are written. {@code inReplyTo} is the message it answers when the provider said so;
 * {@code runId} is the run of that message, else the run waiting on the conversation.
 * {@code answeredStep} is the run step of the answered message, null when the reply names none.
 */
public record ConversationReplyReceived(
        String tenantCode,
        String conversationId,
        String messageId,
        String inReplyTo,
        String runId,
        Integer answeredStep,
        Channel channel,
        String address,
        String text,
        String buttonPayload,
        OffsetDateTime at) {
}
