package com.microboxlabs.miot.fleet.network;

import java.time.Instant;

/** One piece of evidence that gives the viewer access to an asset. */
public record AssetAccess(
        AccessReason reason,
        EvidenceSource source,
        String reference,
        Instant firstSeen,
        Instant lastSeen,
        Instant expiresAt) {
}
