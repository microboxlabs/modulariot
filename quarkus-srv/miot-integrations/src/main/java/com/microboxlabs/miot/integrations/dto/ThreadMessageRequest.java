package com.microboxlabs.miot.integrations.dto;

import java.util.Map;

/**
 * Appends one message to a thread. Upserts on the message id: the client's
 * history adapter may rewrite a message it already appended (a run that pauses
 * for tool approval and finalizes on resume), and an update can arrive for an
 * id whose first write failed.
 */
public record ThreadMessageRequest(
        String id,
        String parentId,
        String format,
        Map<String, Object> payload) {
}
