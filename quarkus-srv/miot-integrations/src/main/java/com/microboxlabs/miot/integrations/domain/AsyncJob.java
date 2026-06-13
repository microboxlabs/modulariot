package com.microboxlabs.miot.integrations.domain;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * A unit of asynchronous work executed by an external worker (e.g. an ECM
 * instance running delivery integrations) and tracked here as a durable,
 * auditable ledger entry.
 *
 * <p>Jobs sharing a {@code chainKey} form an ordered chain: a job is only
 * claimable once every lower {@code chainSequence} in the chain has reached
 * SUCCEEDED or CANCELLED (fail-fast with resume). {@code dedupeKey} makes
 * enqueueing idempotent so the enqueuing listener and the reconciler converge
 * on the same rows.
 */
public record AsyncJob(
        String id,
        String tenantCode,
        String sourceInstance,
        String executor,
        String jobType,
        String correlationKey,
        String chainKey,
        int chainSequence,
        String dedupeKey,
        Map<String, Object> payload,
        JobState state,
        int attempts,
        int maxAttempts,
        OffsetDateTime nextRetryAt,
        String lockedBy,
        OffsetDateTime lockedUntil,
        String lastError,
        List<Map<String, Object>> attemptHistory,
        String enqueuedBy,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {
}
