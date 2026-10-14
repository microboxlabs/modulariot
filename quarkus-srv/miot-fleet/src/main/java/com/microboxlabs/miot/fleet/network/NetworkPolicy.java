package com.microboxlabs.miot.fleet.network;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;

/** How long evidence stays valid after it was last seen, per source, when the source gives no end. */
public record NetworkPolicy(Map<EvidenceSource, Duration> ttl) {

    public NetworkPolicy {
        for (EvidenceSource source : EvidenceSource.values()) {
            if (!ttl.containsKey(source)) {
                throw new IllegalArgumentException("Missing TTL for " + source);
            }
        }
        ttl = Map.copyOf(ttl);
    }

    public Instant expiresAt(Evidence evidence) {
        if (evidence.validUntil() != null) {
            return evidence.validUntil();
        }
        return evidence.lastSeen().plus(ttl.get(evidence.source()));
    }
}
