package com.microboxlabs.miot.conversational.service;

import com.microboxlabs.miot.conversational.domain.Channel;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/** Stable message identity when a leased rule step is replayed after a crash or enqueue failure. */
final class QueuedMessageId {

    private QueuedMessageId() {
    }

    static String forStep(ContextMessage message, Channel channel) {
        if (message.runId() == null || message.step() == null || message.to() == null) {
            throw new IllegalArgumentException("A queued message needs its run, step and recipient");
        }
        String key = "conversation-rule-send:" + message.runId() + ":" + message.step() + ":"
                + channel.dbValue() + ":" + message.to();
        return UUID.nameUUIDFromBytes(key.getBytes(StandardCharsets.UTF_8)).toString();
    }
}
