package com.microboxlabs.miot.trips.domain;

import java.time.OffsetDateTime;

/**
 * One external service of a feed: the last desired state accepted (JSON) and its hash, the mandate and trip it
 * maps to, and the outcome of the last reconcile. {@code open} until its trip is realized or cancelled.
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
        OffsetDateTime lastReconciledAt) {
}
