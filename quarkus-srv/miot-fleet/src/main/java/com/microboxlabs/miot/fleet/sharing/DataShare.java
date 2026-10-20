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

    /**
     * The ids of the assets this share covers today. A listed share covers its list as created, even when an asset
     * later reports through another sender; the others follow the source's current assets.
     */
    public List<String> coveredIds(List<SharingAsset> sourceAssets) {
        if (scope == Scope.ASSETS) {
            return assetIds;
        }
        return covered(sourceAssets).stream().map(SharingAsset::id).toList();
    }

    /**
     * This share already gives {@code target} all of {@code source}'s assets during part of {@code [from, to)}; a new
     * share between them over that window adds nothing. A null {@code to} means no end.
     */
    public boolean alreadyCovers(String source, String target, Instant from, Instant to, Instant now) {
        Status status = status(now);
        boolean inForce = status == Status.ACTIVE || status == Status.SCHEDULED;
        boolean overlaps = (validTo == null || from.isBefore(validTo)) && (to == null || to.isAfter(validFrom));
        return scope == Scope.ALL && inForce && overlaps && sourceOrg.equals(source) && targetOrg.equals(target);
    }

    public DataShare revoke(String by, Instant at) {
        return new DataShare(id, sourceOrg, targetOrg, scope, filter, assetIds, origin, validFrom, validTo, note,
                createdBy, createdAt, at, by);
    }

    public static UUID newId() {
        return UUID.randomUUID();
    }
}
