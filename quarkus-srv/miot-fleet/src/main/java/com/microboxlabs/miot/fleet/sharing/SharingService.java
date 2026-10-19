package com.microboxlabs.miot.fleet.sharing;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;
import java.util.stream.Collectors;

/**
 * Data shares between organizations: who sees whose GPS assets. An organization shares only its own assets, those
 * its client sends; what it receives cannot be passed on. Reads go through short caches because a provider can hold
 * thousands of assets.
 */
public class SharingService {

    private final SharingSource source;
    private final ShareStore store;
    private final Clock clock;
    private final Duration cacheTtl;
    private final Map<String, Cached<List<SharingAsset>>> assetCache = new ConcurrentHashMap<>();
    private volatile Cached<List<SharingOrg>> orgCache;

    private record Cached<T>(T value, Instant at) {
    }

    public SharingService(SharingSource source, ShareStore store, Clock clock, Duration cacheTtl) {
        this.source = source;
        this.store = store;
        this.clock = clock;
        this.cacheTtl = cacheTtl;
    }

    public record OrgView(String slug, String name, Set<SharingOrg.Role> roles, int assetCount) {
    }

    public record FilterView(List<String> owners, List<String> kinds) {
    }

    public record ShareView(UUID id, String sourceOrg, String targetOrg, DataShare.Scope scope, FilterView filter,
            List<String> assetIds, int assetCount, DataShare.Origin origin, DataShare.Status status,
            Instant validFrom, Instant validTo, String note, String createdBy, Instant createdAt, Instant revokedAt,
            String revokedBy) {
    }

    public record Figures(int active, int organizations, int assets, int endingSoon) {
    }

    public record CreateShare(String sourceOrg, String targetOrg, DataShare.Scope scope, FilterView filter,
            List<String> assetIds, Instant validFrom, Instant validTo, String note) {
    }

    /** A share that cannot be created; {@code code} names the reason for the client to translate. */
    public static class ShareRejected extends RuntimeException {

        private final String code;

        public ShareRejected(String code) {
            super("Share rejected: " + code);
            this.code = code;
        }

        public String code() {
            return code;
        }
    }

    public List<OrgView> organizations() {
        return orgs().stream().map(o -> new OrgView(o.slug(), o.name(), o.roles(), o.assetCount())).toList();
    }

    public List<SharingAsset> assets(String slug) {
        return assetsOf(org(slug).orElseThrow(() -> new NoSuchElementException("Unknown organization: " + slug)));
    }

    public List<ShareView> shares() {
        Instant now = clock.instant();
        return store.all().stream().map(s -> view(s, now)).toList();
    }

    public Figures figures() {
        Instant now = clock.instant();
        List<DataShare> all = store.all();
        List<DataShare> active = all.stream().filter(s -> s.status(now) == DataShare.Status.ACTIVE).toList();
        Set<String> orgs = new HashSet<>();
        Set<String> assets = new HashSet<>();
        for (DataShare share : active) {
            orgs.add(share.sourceOrg());
            orgs.add(share.targetOrg());
            covered(share).forEach(a -> assets.add(share.sourceOrg() + "/" + a.id()));
        }
        Instant soon = now.plus(Duration.ofDays(30));
        int endingSoon = (int) active.stream().filter(s -> s.validTo() != null && !s.validTo().isAfter(soon))
                .count();
        return new Figures(active.size(), orgs.size(), assets.size(), endingSoon);
    }

    public ShareView create(CreateShare request, String actor) {
        Instant now = clock.instant();
        DataShare share = check(request, now, actor);
        store.create(share);
        return view(share, now);
    }

    public ShareView revoke(UUID id, String actor) {
        Instant now = clock.instant();
        return store.revoke(id, actor, now).map(s -> view(s, now))
                .orElseThrow(() -> new NoSuchElementException("No active share " + id));
    }

    /**
     * The {@code asset_client_map} rows the active shares call for: one per asset and receiving client, open from
     * the earliest start to the latest end of the shares that cover it. A null end means no end.
     */
    public List<ClientMap.Row> clientMap() {
        Instant now = clock.instant();
        Map<String, SharingOrg> bySlug = orgs().stream()
                .collect(Collectors.toMap(SharingOrg::slug, o -> o, (a, b) -> a));
        Map<String, ClientMap.Row> rows = new LinkedHashMap<>();
        for (DataShare share : store.all()) {
            SharingOrg from = bySlug.get(share.sourceOrg());
            SharingOrg to = bySlug.get(share.targetOrg());
            if (share.status(now) != DataShare.Status.ACTIVE || from == null || to == null
                    || to.clientId() == null || to.clientId().equals(from.clientId())) {
                continue;
            }
            for (SharingAsset asset : share.covered(assetsOf(from))) {
                ClientMap.Row row = new ClientMap.Row(asset.id(), to.clientId(), share.validFrom(), share.validTo());
                rows.merge(row.key(), row, ClientMap.Row::widen);
            }
        }
        return new ArrayList<>(rows.values());
    }

    private DataShare check(CreateShare r, Instant now, String actor) {
        Optional<SharingOrg> from = org(r.sourceOrg());
        if (from.isEmpty()) {
            throw new ShareRejected("source");
        }
        if (org(r.targetOrg()).isEmpty()) {
            throw new ShareRejected("target");
        }
        if (r.sourceOrg().equals(r.targetOrg())) {
            throw new ShareRejected("sameOrg");
        }
        DataShare.Scope scope = r.scope() == null ? DataShare.Scope.ALL : r.scope();
        ShareFilter filter = scope == DataShare.Scope.FILTER && r.filter() != null
                ? new ShareFilter(r.filter().owners(), r.filter().kinds())
                : ShareFilter.NONE;
        if (scope == DataShare.Scope.FILTER && filter.isEmpty()) {
            throw new ShareRejected("filter");
        }
        List<String> assetIds = scope == DataShare.Scope.ASSETS ? owned(from.get(), r.assetIds()) : List.of();
        if (scope == DataShare.Scope.ASSETS && assetIds.isEmpty()) {
            throw new ShareRejected("assets");
        }
        Instant validFrom = r.validFrom() == null ? now : r.validFrom();
        if (r.validTo() != null && !r.validTo().isAfter(validFrom)) {
            throw new ShareRejected("dates");
        }
        boolean covered = store.all().stream().anyMatch(s -> s.sourceOrg().equals(r.sourceOrg())
                && s.targetOrg().equals(r.targetOrg()) && s.scope() == DataShare.Scope.ALL
                && EnumSet.of(DataShare.Status.ACTIVE, DataShare.Status.SCHEDULED).contains(s.status(now)));
        if (covered) {
            throw new ShareRejected("duplicate");
        }
        String note = r.note() == null || r.note().isBlank() ? null : r.note().trim();
        return new DataShare(DataShare.newId(), r.sourceOrg(), r.targetOrg(), scope, filter, assetIds,
                DataShare.Origin.MANUAL, validFrom, r.validTo(), note, actor, now, null, null);
    }

    /** The requested ids the source owns, in its own spelling; anything else is dropped. */
    private List<String> owned(SharingOrg org, List<String> requested) {
        if (requested == null || requested.isEmpty()) {
            return List.of();
        }
        Set<String> wanted = new HashSet<>(requested);
        return assetsOf(org).stream().map(SharingAsset::id).filter(wanted::contains).toList();
    }

    private ShareView view(DataShare s, Instant now) {
        FilterView filter = s.scope() == DataShare.Scope.FILTER
                ? new FilterView(s.filter().owners(), s.filter().kinds())
                : null;
        return new ShareView(s.id(), s.sourceOrg(), s.targetOrg(), s.scope(), filter, s.assetIds(),
                covered(s).size(), s.origin(), s.status(now), s.validFrom(), s.validTo(), s.note(), s.createdBy(),
                s.createdAt(), s.revokedAt(), s.revokedBy());
    }

    private List<SharingAsset> covered(DataShare share) {
        return org(share.sourceOrg()).map(o -> share.covered(assetsOf(o))).orElse(List.of());
    }

    private Optional<SharingOrg> org(String slug) {
        return orgs().stream().filter(o -> o.slug().equals(slug)).findFirst();
    }

    private List<SharingAsset> assetsOf(SharingOrg org) {
        if (org.clientId() == null || org.assetCount() == 0) {
            return List.of();
        }
        return fresh(assetCache.get(org.clientId()), () -> {
            List<SharingAsset> list = source.assets(org.clientId());
            assetCache.put(org.clientId(), new Cached<>(list, clock.instant()));
            return list;
        });
    }

    private List<SharingOrg> orgs() {
        return fresh(orgCache, () -> {
            List<SharingOrg.Ref> refs = source.organizations();
            Set<String> clients = refs.stream().map(SharingOrg.Ref::clientId).filter(c -> c != null)
                    .collect(Collectors.toSet());
            Map<String, Integer> counts = source.assetCounts(clients);
            Set<String> operators = source.operators(clients);
            List<SharingOrg> list = refs.stream().map(r -> {
                Set<SharingOrg.Role> roles = EnumSet.noneOf(SharingOrg.Role.class);
                int count = counts.getOrDefault(r.clientId(), 0);
                if (count > 0) {
                    roles.add(SharingOrg.Role.SENDER);
                }
                if (operators.contains(r.clientId())) {
                    roles.add(SharingOrg.Role.OPERATOR);
                }
                return new SharingOrg(r.slug(), r.name(), r.clientId(), roles, count);
            }).toList();
            orgCache = new Cached<>(list, clock.instant());
            return list;
        });
    }

    private <T> T fresh(Cached<T> cached, Supplier<T> load) {
        if (cached != null && cached.at().plus(cacheTtl).isAfter(clock.instant())) {
            return cached.value();
        }
        return load.get();
    }
}
