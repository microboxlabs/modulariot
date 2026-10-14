package com.microboxlabs.miot.fleet.network;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.function.Predicate;
import java.util.stream.Collectors;

/**
 * Derives what an organization sees from a {@link NetworkSnapshot}. Nothing here is stored: access and relationships
 * follow from the evidence and expire with it.
 *
 * <p>An organization sees an asset while it has active evidence that it reports, owns or operates the asset, or that
 * the asset is linked to one it operates.
 */
public final class NetworkResolver {

    private final NetworkSnapshot snapshot;
    private final NetworkPolicy policy;
    private final Instant now;
    private final Map<String, NetworkOrganization> organizations;
    private final Map<String, NetworkOrganization> byClientId;

    public NetworkResolver(NetworkSnapshot snapshot, NetworkPolicy policy, Instant now) {
        this.snapshot = snapshot;
        this.policy = policy;
        this.now = now;
        this.organizations = snapshot.organizations().stream()
                .collect(Collectors.toMap(NetworkOrganization::id, o -> o, (a, b) -> a, LinkedHashMap::new));
        this.byClientId = new LinkedHashMap<>();
        snapshot.organizations().forEach(o -> o.clientIds().forEach(c -> byClientId.putIfAbsent(c, o)));
    }

    public List<AssetView> assets(String organizationId) {
        return snapshot.assets().stream()
                .map(asset -> view(asset, organizationId))
                .flatMap(Optional::stream)
                .toList();
    }

    public Optional<AssetView> asset(String organizationId, String assetId) {
        return snapshot.assets().stream()
                .filter(a -> a.id().equals(assetId))
                .findFirst()
                .flatMap(a -> view(a, organizationId));
    }

    public List<RelationshipView> relationships(String organizationId) {
        Map<String, Group> groups = new LinkedHashMap<>();
        for (Evidence e : snapshot.evidence()) {
            if (e.kind() == EvidenceKind.OPERATES) {
                if (organizationId.equals(e.party())) {
                    add(groups, RelationshipKind.OPERATION, OrgRole.OPERATOR, e.counterparty(), OrgRole.CARRIER, e);
                } else if (organizationId.equals(e.counterparty())) {
                    add(groups, RelationshipKind.OPERATION, OrgRole.CARRIER, e.party(), OrgRole.OPERATOR, e);
                }
            } else if (e.kind() == EvidenceKind.REPORTS) {
                String provider = Optional.ofNullable(byClientId.get(e.party())).map(NetworkOrganization::id)
                        .orElse(null);
                String carrier = owner(e.assetId(), x -> true).map(NetworkOrganization::id).orElse(null);
                if (provider == null || carrier == null || provider.equals(carrier)) {
                    continue;
                }
                if (organizationId.equals(provider)) {
                    add(groups, RelationshipKind.GPS_SERVICE, OrgRole.PROVIDER, carrier, OrgRole.CARRIER, e);
                } else if (organizationId.equals(carrier)) {
                    add(groups, RelationshipKind.GPS_SERVICE, OrgRole.CARRIER, provider, OrgRole.PROVIDER, e);
                }
            }
        }
        return groups.values().stream()
                .map(Group::view)
                .sorted(Comparator.comparing(RelationshipView::active).reversed()
                        .thenComparing(r -> r.counterpart().name()))
                .toList();
    }

    private Optional<AssetView> view(Asset asset, String organizationId) {
        NetworkOrganization viewer = organizations.get(organizationId);
        Set<String> clientIds = viewer == null ? Set.of() : viewer.clientIds();
        List<AssetAccess> access = new ArrayList<>();
        for (Evidence e : snapshot.evidence()) {
            if (!e.assetId().equals(asset.id()) || !active(e)) {
                continue;
            }
            AccessReason reason = switch (e.kind()) {
                case REPORTS -> clientIds.contains(e.party()) ? AccessReason.REPORTER : null;
                case OWNS -> organizationId.equals(e.party()) ? AccessReason.OWNER : null;
                case OPERATES -> organizationId.equals(e.party()) ? AccessReason.OPERATOR : null;
                case LINKED -> operates(organizationId, e.party()) ? AccessReason.LINKED : null;
            };
            if (reason != null) {
                access.add(new AssetAccess(reason, e.source(), e.reference(), e.firstSeen(), e.lastSeen(),
                        policy.expiresAt(e)));
            }
        }
        if (access.isEmpty()) {
            return Optional.empty();
        }
        OrgRef owner = owner(asset.id(), this::active).map(OrgRef::of).orElse(null);
        List<OrgRef> providers = snapshot.evidence().stream()
                .filter(e -> e.kind() == EvidenceKind.REPORTS && e.assetId().equals(asset.id()) && active(e))
                .map(e -> byClientId.get(e.party()))
                .filter(o -> o != null)
                .distinct()
                .map(OrgRef::of)
                .toList();
        return Optional.of(new AssetView(asset.id(), asset.type(), asset.label(), owner, providers, access));
    }

    private boolean operates(String organizationId, String assetId) {
        return snapshot.evidence().stream().anyMatch(e -> e.kind() == EvidenceKind.OPERATES
                && organizationId.equals(e.party()) && e.assetId().equals(assetId) && active(e));
    }

    /** The organization with the most recent ownership evidence on the asset. */
    private Optional<NetworkOrganization> owner(String assetId, Predicate<Evidence> filter) {
        return snapshot.evidence().stream()
                .filter(e -> e.kind() == EvidenceKind.OWNS && e.assetId().equals(assetId) && filter.test(e))
                .max(Comparator.comparing(Evidence::lastSeen))
                .map(e -> organizations.get(e.party()));
    }

    private boolean active(Evidence evidence) {
        return now.isBefore(policy.expiresAt(evidence));
    }

    private void add(Map<String, Group> groups, RelationshipKind kind, OrgRole role, String counterpartId,
            OrgRole counterpartRole, Evidence evidence) {
        NetworkOrganization counterpart = organizations.get(counterpartId);
        if (counterpart == null) {
            return;
        }
        groups.computeIfAbsent(kind + "|" + counterpartId,
                k -> new Group(kind, role, counterpart, counterpartRole)).add(evidence);
    }

    private final class Group {
        private final RelationshipKind kind;
        private final OrgRole role;
        private final NetworkOrganization counterpart;
        private final OrgRole counterpartRole;
        private final Set<EvidenceSource> sources = EnumSet.noneOf(EvidenceSource.class);
        private final Set<String> assets = new TreeSet<>();
        private Instant firstSeen;
        private Instant lastSeen;
        private Instant expiresAt;

        Group(RelationshipKind kind, OrgRole role, NetworkOrganization counterpart, OrgRole counterpartRole) {
            this.kind = kind;
            this.role = role;
            this.counterpart = counterpart;
            this.counterpartRole = counterpartRole;
        }

        void add(Evidence e) {
            sources.add(e.source());
            assets.add(e.assetId());
            Instant expiry = policy.expiresAt(e);
            firstSeen = firstSeen == null || e.firstSeen().isBefore(firstSeen) ? e.firstSeen() : firstSeen;
            lastSeen = lastSeen == null || e.lastSeen().isAfter(lastSeen) ? e.lastSeen() : lastSeen;
            expiresAt = expiresAt == null || expiry.isAfter(expiresAt) ? expiry : expiresAt;
        }

        RelationshipView view() {
            return new RelationshipView(kind, role, OrgRef.of(counterpart), counterpartRole, EnumSet.copyOf(sources),
                    firstSeen, lastSeen, expiresAt, now.isBefore(expiresAt), assets.size());
        }
    }
}
