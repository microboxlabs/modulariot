package com.microboxlabs.miot.trips.domain;

import java.time.OffsetDateTime;

/**
 * One external service of a feed: the last desired state accepted (JSON) and its hash, the mandate and trip it
 * maps to, and the outcome of the last reconcile. {@code appliedDesired} preserves the last state actually
 * reconciled while a newer desired state waits for the worker. {@code open} until its trip is realized or cancelled.
 */
public record FeedService(
        String tenantCode,
        String feedKey,
        String externalCode,
        String desired,
        String desiredHash,
        String mandateId,
        String tripId,
        boolean open,
        String lastAction,
        String lastResult,
        OffsetDateTime lastReconciledAt,
        String appliedDesired) {

    /** What a batch needs to tell whether a service changed, without its stored payloads. */
    public record Digest(String desiredHash, String lastAction, boolean open) {
    }
}
