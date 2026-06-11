package com.microboxlabs.miot.integrations.dto;

import java.util.Map;

/**
 * One job to enqueue. {@code dedupeKey} must be deterministic for the same
 * logical work (convention: {@code sourceInstance:chainKey:jobType}) so that
 * the listener fast path and the reconciler converge on the same row.
 */
public record AsyncJobSpec(
        String jobType,
        String executor,
        String correlationKey,
        String chainKey,
        Integer chainSequence,
        String dedupeKey,
        Map<String, Object> payload,
        Integer maxAttempts) {
}
