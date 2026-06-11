package com.microboxlabs.miot.integrations.dto;

/**
 * Worker claim request. {@code chainKey} optionally narrows the claim to one
 * chain (used by the enqueuer's fast path to drive its own chain to completion).
 */
public record ClaimJobsRequest(
        String executor,
        String workerId,
        Integer limit,
        Integer leaseSeconds,
        String chainKey) {
}
