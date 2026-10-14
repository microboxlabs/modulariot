package com.microboxlabs.miot.fleet.network;

import java.time.Instant;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;

/**
 * Derives what an organization sees from a {@link NetworkSnapshot}. Nothing here is stored: access and relationships
 * follow from the evidence and expire with it.
 *
 * <p>An organization sees an asset while it has active evidence that it reports, owns or operates the asset, or that
 * the asset is linked to one it operates on the same trip. The carrier an operation names counts as the asset's owner.
 */
public final class NetworkResolver {

    private static final Comparator<RelationshipView> ORDER = Comparator
            .comparing(RelationshipView::active).reversed()
            .thenComparing(r -> r.counterpart().name(), Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(r -> r.counterpart().id());

    private final NetworkSnapshot snapshot;
    private final NetworkPolicy policy;
    private final Instant now;
    private final Map<String, NetworkOrganization> organizations;
    private final Map<String, NetworkOrganization> byClientId = new LinkedHashMap<>();
    private final Map<String, List<Evidence>> byAsset;

    public NetworkResolver(NetworkSnapshot snapshot, NetworkPolicy policy, Instant now) {
        this.snapshot = snapshot;
        this.policy = policy;
        this.now = now;
        this.organizations = snapshot.organizations().stream()
                .collect(Collectors.toMap(NetworkOrganization::id, o -> o, (a, b) -> a, LinkedHashMap::new));
        snapshot.organizations().forEach(o -> o.clientIds().forEach(c -> byClientId.putIfAbsent(c, o)));
        this.byAsset = snapshot.evidence().stream()
                .collect(Collectors.groupingBy(Evidence::assetId, LinkedHashMap::new, Collectors.toList()));
    }

    public List<AssetView> assets(Viewer viewer) {
        Set<String> clientIds = clientIds(viewer);
        return snapshot.assets().stream()
                .map(asset -> view(asset, viewer.organizationId(), clientIds))
                .flatMap(Optional::stream)
                .toList();
    }

    public Optional<AssetView> asset(Viewer viewer, String assetId) {
        Set<String> clientIds = clientIds(viewer);
        return snapshot.assets().stream()
                .filter(a -> a.id().equals(assetId))
                .findFirst()
                .flatMap(a -> view(a, viewer.organizationId(), clientIds));
    }

    public List<RelationshipView> relationships(Viewer viewer) {
        String me = viewer.organizationId();
        Set<String> clientIds = clientIds(viewer);
        Map<String, Group> groups = new LinkedHashMap<>();
        for (Evidence e : snapshot.evidence()) {
            if (e.kind() == EvidenceKind.OPERATES) {
                operationRelationship(groups, me, e);
            } else if (e.kind() == EvidenceKind.REPORTS) {
                serviceRelationships(groups, me, clientIds, e);
            }
        }
        return groups.values().stream().map(Group::view).sorted(ORDER).toList();
    }

    private void operationRelationship(Map<String, Group> groups, String me, Evidence operation) {
        Period period = Period.of(operation, policy);
        if (me.equals(operation.party())) {
            add(groups, RelationshipKind.OPERATION, OrgRole.OPERATOR, operation.counterparty(), OrgRole.CARRIER,
                    operation, period);
        } else if (me.equals(operation.counterparty())) {
            add(groups, RelationshipKind.OPERATION, OrgRole.CARRIER, operation.party(), OrgRole.OPERATOR, operation,
                    period);
        }
    }

    /** A provider reported a carrier's asset while the carrier owned it: one relationship per overlap. */
    private void serviceRelationships(Map<String, Group> groups, String me, Set<String> clientIds, Evidence report) {
        NetworkOrganization provider = byClientId.get(report.party());
        if (provider == null) {
            return;
        }
        Period reported = Period.of(report, policy);
        for (Evidence ownership : ownership(report.assetId())) {
            String carrier = ownerOf(ownership);
            Optional<Period> overlap = reported.overlap(Period.of(ownership, policy));
            if (carrier == null || carrier.equals(provider.id()) || overlap.isEmpty()) {
                continue;
            }
            if (me.equals(provider.id()) || clientIds.contains(report.party())) {
                add(groups, RelationshipKind.GPS_SERVICE, OrgRole.PROVIDER, carrier, OrgRole.CARRIER, report,
                        overlap.get());
            } else if (me.equals(carrier)) {
                add(groups, RelationshipKind.GPS_SERVICE, OrgRole.CARRIER, provider.id(), OrgRole.PROVIDER, report,
                        overlap.get());
            }
        }
    }

    private Optional<AssetView> view(Asset asset, String me, Set<String> clientIds) {
        List<AssetAccess> access = evidence(asset.id()).stream()
                .filter(this::active)
                .map(e -> accessFrom(e, me, clientIds))
                .flatMap(Optional::stream)
                .toList();
        if (access.isEmpty()) {
            return Optional.empty();
        }
        OrgRef owner = ownership(asset.id()).stream()
                .filter(this::active)
                .max(Comparator.comparing(Evidence::lastSeen))
                .map(e -> organizations.get(ownerOf(e)))
                .map(OrgRef::of)
                .orElse(null);
        List<OrgRef> providers = evidence(asset.id()).stream()
                .filter(e -> e.kind() == EvidenceKind.REPORTS && active(e))
                .map(e -> byClientId.get(e.party()))
                .filter(Objects::nonNull)
                .distinct()
                .map(OrgRef::of)
                .toList();
        return Optional.of(new AssetView(asset.id(), asset.type(), asset.label(), owner, providers, access));
    }

    /** The access one active piece of evidence gives the viewer, if any. */
    private Optional<AssetAccess> accessFrom(Evidence e, String me, Set<String> clientIds) {
        AccessReason reason = switch (e.kind()) {
            case REPORTS -> clientIds.contains(e.party()) ? AccessReason.REPORTER : null;
            case OWNS -> me.equals(e.party()) ? AccessReason.OWNER : null;
            case OPERATES -> operatesReason(e, me);
            case LINKED -> null;
        };
        if (reason != null) {
            return Optional.of(access(reason, e, policy.expiresAt(e)));
        }
        if (e.kind() != EvidenceKind.LINKED) {
            return Optional.empty();
        }
        return operationExpiry(me, e)
                .map(until -> access(AccessReason.LINKED, e, earliest(policy.expiresAt(e), until)));
    }

    private static AccessReason operatesReason(Evidence e, String me) {
        if (me.equals(e.party())) {
            return AccessReason.OPERATOR;
        }
        return me.equals(e.counterparty()) ? AccessReason.OWNER : null;
    }

    /** When the viewer's last active operation of the link's host asset, on the link's trip, expires. */
    private Optional<Instant> operationExpiry(String me, Evidence link) {
        return evidence(link.party()).stream()
                .filter(e -> e.kind() == EvidenceKind.OPERATES && me.equals(e.party()) && active(e)
                        && Objects.equals(e.reference(), link.reference()))
                .map(policy::expiresAt)
                .max(Comparator.naturalOrder());
    }

    /** Evidence that names the asset's owner: ownership, and the carrier an operation names. */
    private List<Evidence> ownership(String assetId) {
        return evidence(assetId).stream()
                .filter(e -> e.kind() == EvidenceKind.OWNS
                        || (e.kind() == EvidenceKind.OPERATES && e.counterparty() != null))
                .toList();
    }

    private static String ownerOf(Evidence e) {
        return e.kind() == EvidenceKind.OWNS ? e.party() : e.counterparty();
    }

    private List<Evidence> evidence(String assetId) {
        return byAsset.getOrDefault(assetId, List.of());
    }

    private Set<String> clientIds(Viewer viewer) {
        Set<String> ids = new HashSet<>(viewer.clientIds());
        Optional.ofNullable(organizations.get(viewer.organizationId())).ifPresent(o -> ids.addAll(o.clientIds()));
        return ids;
    }

    private boolean active(Evidence evidence) {
        return now.isBefore(policy.expiresAt(evidence));
    }

    private static AssetAccess access(AccessReason reason, Evidence e, Instant expiresAt) {
        return new AssetAccess(reason, e.source(), e.reference(), e.firstSeen(), e.lastSeen(), expiresAt);
    }

    private static Instant earliest(Instant a, Instant b) {
        return a.isBefore(b) ? a : b;
    }

    private void add(Map<String, Group> groups, RelationshipKind kind, OrgRole role, String counterpartId,
            OrgRole counterpartRole, Evidence evidence, Period period) {
        NetworkOrganization counterpart = organizations.get(counterpartId);
        if (counterpart == null) {
            return;
        }
        groups.computeIfAbsent(kind + "|" + role + "|" + counterpartId,
                k -> new Group(kind, role, counterpart, counterpartRole)).add(evidence, period);
    }

    /** When evidence held: first seen, last seen, and when it stops counting. */
    private record Period(Instant firstSeen, Instant lastSeen, Instant expiresAt) {

        static Period of(Evidence e, NetworkPolicy policy) {
            return new Period(e.firstSeen(), e.lastSeen(), policy.expiresAt(e));
        }

        Optional<Period> overlap(Period other) {
            Instant first = firstSeen.isAfter(other.firstSeen) ? firstSeen : other.firstSeen;
            Instant expires = earliest(expiresAt, other.expiresAt);
            if (!first.isBefore(expires)) {
                return Optional.empty();
            }
            return Optional.of(new Period(first, earliest(lastSeen, other.lastSeen), expires));
        }
    }

    private final class Group {
        private final RelationshipKind kind;
        private final OrgRole role;
        private final NetworkOrganization counterpart;
        private final OrgRole counterpartRole;
        private final Set<EvidenceSource> sources = EnumSet.noneOf(EvidenceSource.class);
        private final Set<String> activeAssets = new TreeSet<>();
        private Instant firstSeen;
        private Instant lastSeen;
        private Instant expiresAt;

        Group(RelationshipKind kind, OrgRole role, NetworkOrganization counterpart, OrgRole counterpartRole) {
            this.kind = kind;
            this.role = role;
            this.counterpart = counterpart;
            this.counterpartRole = counterpartRole;
        }

        void add(Evidence e, Period period) {
            sources.add(e.source());
            if (now.isBefore(period.expiresAt())) {
                activeAssets.add(e.assetId());
            }
            firstSeen = firstSeen == null || period.firstSeen().isBefore(firstSeen) ? period.firstSeen() : firstSeen;
            lastSeen = lastSeen == null || period.lastSeen().isAfter(lastSeen) ? period.lastSeen() : lastSeen;
            expiresAt = expiresAt == null || period.expiresAt().isAfter(expiresAt) ? period.expiresAt() : expiresAt;
        }

        RelationshipView view() {
            return new RelationshipView(kind, role, OrgRef.of(counterpart), counterpartRole, EnumSet.copyOf(sources),
                    firstSeen, lastSeen, expiresAt, now.isBefore(expiresAt), activeAssets.size());
        }
    }
}
