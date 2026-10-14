package com.microboxlabs.miot.fleet.network;

import java.time.Instant;
import java.util.Set;

/** A relationship of the viewer with another organization, summarized over the evidence that supports it. */
public record RelationshipView(
        RelationshipKind kind,
        OrgRole role,
        OrgRef counterpart,
        OrgRole counterpartRole,
        Set<EvidenceSource> sources,
        Instant firstSeen,
        Instant lastSeen,
        Instant expiresAt,
        boolean active,
        int assetCount) {
}
