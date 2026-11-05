package com.microboxlabs.miot.conversational.service;

import java.util.List;

/**
 * The ingestable events a Meta webhook POST can carry, after parsing. A call permission reply is also in
 * {@code messages}, so the conversation shows it.
 */
public record ParsedWebhook(List<InboundMessage> messages, List<StatusUpdate> statuses,
        List<CallPermissionReply> callPermissionReplies, List<CallEvent> calls) {

    public ParsedWebhook {
        callPermissionReplies = callPermissionReplies == null ? List.of() : callPermissionReplies;
        calls = calls == null ? List.of() : calls;
    }

    public ParsedWebhook(List<InboundMessage> messages, List<StatusUpdate> statuses) {
        this(messages, statuses, List.of(), List.of());
    }
}
