package com.microboxlabs.miot.fleet.sharing;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.fleet.sharing.SharingService.CreateShare;
import com.microboxlabs.miot.fleet.sharing.SharingService.FilterView;
import com.microboxlabs.miot.fleet.sharing.SharingService.ShareRejected;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SharingServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-19T12:00:00Z");
    private static final String ACTOR = "owner@example.com";

    /** Provider "gps" sends three assets, carrier "carrier" two, operator "op" none but creates trips. */
    private static final class FakeSource implements SharingSource {

        private final Map<String, List<SharingAsset>> assets = Map.of(
                "c-gps", List.of(asset("AA11", "Andes", "Tracto"), asset("BB22", "Andes", "Jaula"),
                        asset("CC33", "Sur", "Tracto")),
                "c-carrier", List.of(asset("DD44", "Sur", "Tracto"), asset("EE55", "Sur", "Jaula")));

        @Override
        public List<SharingOrg.Ref> organizations() {
            return List.of(new SharingOrg.Ref("gps", "GPS", "c-gps"),
                    new SharingOrg.Ref("carrier", "Carrier", "c-carrier"),
                    new SharingOrg.Ref("op", "Operator", "c-op"));
        }

        @Override
        public Map<String, Integer> assetCounts(Set<String> clientIds) {
            return assets.entrySet().stream().filter(e -> clientIds.contains(e.getKey()))
                    .collect(Collectors.toMap(Map.Entry::getKey, e -> e.getValue().size()));
        }

        @Override
        public Set<String> operators(Set<String> clientIds) {
            return clientIds.contains("c-op") ? Set.of("c-op") : Set.of();
        }

        @Override
        public List<SharingAsset> assets(String clientId) {
            return assets.getOrDefault(clientId, List.of());
        }
    }

    private static SharingAsset asset(String id, String owner, String kind) {
        return new SharingAsset(id, kind, owner, NOW);
    }

    private InMemoryShareStore store;
    private SharingService sharing;

    @BeforeEach
    void setUp() {
        store = new InMemoryShareStore(List.of());
        sharing = new SharingService(new FakeSource(), store, Clock.fixed(NOW, ZoneOffset.UTC), Duration.ofMinutes(1));
    }

    private static CreateShare request(String source, String target, DataShare.Scope scope, FilterView filter,
            List<String> ids, Instant from, Instant to) {
        return new CreateShare(source, target, scope, filter, ids, from, to, null);
    }

    private static CreateShare all(String source, String target) {
        return request(source, target, DataShare.Scope.ALL, null, null, null, null);
    }

    @Test
    void rolesAndCountsComeFromTheGpsData() {
        var orgs = sharing.organizations();
        assertEquals(Set.of(SharingOrg.Role.SENDER), orgs.get(0).roles());
        assertEquals(3, orgs.get(0).assetCount());
        assertEquals(Set.of(SharingOrg.Role.OPERATOR), orgs.get(2).roles());
        assertEquals(0, orgs.get(2).assetCount());
    }

    @Test
    void createCountsTheAssetsEachScopeCovers() {
        assertEquals(3, sharing.create(all("gps", "op"), ACTOR).assetCount());
        var filtered = sharing.create(request("gps", "carrier", DataShare.Scope.FILTER,
                new FilterView(List.of("Andes"), List.of("Tracto")), null, null, null), ACTOR);
        assertEquals(1, filtered.assetCount());
        var listed = sharing.create(request("carrier", "op", DataShare.Scope.ASSETS, null,
                List.of("EE55", "NOT-MINE"), null, null), ACTOR);
        assertEquals(List.of("EE55"), listed.assetIds());
        assertEquals(ACTOR, listed.createdBy());
    }

    @Test
    void rejectsSharesThatCannotWork() {
        assertEquals("source", rejected(all("nope", "op")));
        assertEquals("sameOrg", rejected(all("gps", "gps")));
        assertEquals("filter", rejected(request("gps", "op", DataShare.Scope.FILTER,
                new FilterView(List.of(), List.of()), null, null, null)));
        assertEquals("assets", rejected(request("gps", "op", DataShare.Scope.ASSETS, null,
                List.of("DD44"), null, null)));
        assertEquals("dates", rejected(request("gps", "op", DataShare.Scope.ALL, null, null, NOW,
                NOW.minusSeconds(1))));
        sharing.create(all("gps", "op"), ACTOR);
        assertEquals("duplicate", rejected(all("gps", "op")));
    }

    private String rejected(CreateShare request) {
        return assertThrows(ShareRejected.class, () -> sharing.create(request, ACTOR)).code();
    }

    @Test
    void revokeStampsTheShareOnce() {
        var share = sharing.create(all("gps", "op"), ACTOR);
        var revoked = sharing.revoke(share.id(), ACTOR);
        assertEquals(DataShare.Status.REVOKED, revoked.status());
        assertThrows(java.util.NoSuchElementException.class, () -> sharing.revoke(share.id(), ACTOR));
    }

    @Test
    void clientMapMergesActiveSharesAndSkipsTheRest() {
        sharing.create(request("gps", "op", DataShare.Scope.ASSETS, null, List.of("AA11"), null,
                NOW.plus(Duration.ofDays(10))), ACTOR);
        sharing.create(request("gps", "op", DataShare.Scope.FILTER, new FilterView(List.of("Andes"), List.of()),
                null, NOW.minus(Duration.ofDays(5)), null), ACTOR);
        sharing.create(request("carrier", "op", DataShare.Scope.ALL, null, null, NOW.plus(Duration.ofDays(1)),
                null), ACTOR);
        var revoked = sharing.create(all("carrier", "gps"), ACTOR);
        sharing.revoke(revoked.id(), ACTOR);

        List<ClientMap.Row> rows = new ArrayList<>(sharing.clientMap());
        rows.sort((a, b) -> a.assetId().compareTo(b.assetId()));

        assertEquals(2, rows.size());
        assertEquals(new ClientMap.Row("AA11", "c-op", NOW.minus(Duration.ofDays(5)), null), rows.get(0));
        assertEquals("BB22", rows.get(1).assetId());
    }

    @Test
    void figuresCountActiveSharesOnly() {
        sharing.create(request("gps", "op", DataShare.Scope.ALL, null, null, null, NOW.plus(Duration.ofDays(3))),
                ACTOR);
        sharing.create(request("carrier", "op", DataShare.Scope.ALL, null, null, NOW.plus(Duration.ofDays(1)),
                null), ACTOR);
        var figures = sharing.figures();
        assertEquals(1, figures.active());
        assertEquals(2, figures.organizations());
        assertEquals(3, figures.assets());
        assertEquals(1, figures.endingSoon());
    }

    @Test
    void syncAppliesTheDifferenceToTheManagedRows() {
        List<ClientMap.Plan> applied = new ArrayList<>();
        ClientMapStore table = new ClientMapStore() {
            @Override
            public List<ClientMap.Row> managed() {
                return List.of(new ClientMap.Row("STALE", "c-op", NOW, null));
            }

            @Override
            public void apply(ClientMap.Plan plan) {
                applied.add(plan);
            }
        };
        sharing.create(all("carrier", "op"), ACTOR);

        ClientMap.Plan plan = new ClientMapSync(sharing, table).run();

        assertEquals(2, plan.insert().size());
        assertEquals(List.of("STALE"), plan.delete().stream().map(ClientMap.Row::assetId).toList());
        assertTrue(plan.update().isEmpty());
        assertEquals(1, applied.size());
    }
}
