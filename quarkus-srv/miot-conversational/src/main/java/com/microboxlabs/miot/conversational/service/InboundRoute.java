package com.microboxlabs.miot.conversational.service;

import com.microboxlabs.miot.conversational.domain.Conversation;

/**
 * Where an inbound message is stored: the conversation, and its tenant. {@code inReplyTo} and
 * {@code answeredStep} come from the message it answers; {@code runId} from that message or from the run
 * waiting on the conversation.
 */
record InboundRoute(String tenantCode, Conversation conversation, String inReplyTo, String runId,
        Integer answeredStep) {

    static InboundRoute to(Conversation conversation) {
        return new InboundRoute(conversation.tenantCode(), conversation, null, null, null);
    }
}
