package com.microboxlabs.miot.fleet.sharing;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * One organization's GPS assets made visible to another. {@code filter} is set for {@link Scope#FILTER} only and
 * {@code assetIds} for {@link Scope#ASSETS} only.
 */
public record DataShare(UUID id, String sourceOrg, String targetOrg, Scope scope, ShareFilter filter,
        List<String> assetIds, Origin origin, Instant validFrom, Instant validTo, String note, String createdBy,
        Instant createdAt, Instant revokedAt, String revokedBy) {

    public enum Scope {
        /** Every asset of the source, including later ones. */
        ALL,
        /** The source's assets that match the filter, including later ones. */
        FILTER,
        /** Only the listed assets. */
        ASSETS
    }

    /** Who created it: a platform owner, or an integration the platform set up. */
    public enum Origin {
        MANUAL, TRIP, ACCREDITATION
    }

    public enum Status {
        ACTIVE, SCHEDULED, EXPIRED, REVOKED
    }

    public DataShare {
        assetIds = assetIds == null ? List.of() : List.copyOf(assetIds);
    }

    public Status status(Instant now) {
        if (revokedAt != null) {
            return Status.REVOKED;
        }
        if (validFrom.isAfter(now)) {
            return Status.SCHEDULED;
        }
        if (validTo != null && !validTo.isAfter(now)) {
            return Status.EXPIRED;
        }
        return Status.ACTIVE;
    }

    /** The source's assets this share covers today. */
    public List<SharingAsset> covered(List<SharingAsset> sourceAssets) {
        return switch (scope) {
            case ALL -> sourceAssets;
            case FILTER -> sourceAssets.stream().filter(filter::matches).toList();
            case ASSETS -> {
                Set<String> listed = Set.copyOf(assetIds);
                yield sourceAssets.stream().filter(a -> listed.contains(a.id())).toList();
            }
        };
    }

    public DataShare revoke(String by, Instant at) {
        return new DataShare(id, sourceOrg, targetOrg, scope, filter, assetIds, origin, validFrom, validTo, note,
                createdBy, createdAt, at, by);
    }

    public static UUID newId() {
        return UUID.randomUUID();
    }
}
