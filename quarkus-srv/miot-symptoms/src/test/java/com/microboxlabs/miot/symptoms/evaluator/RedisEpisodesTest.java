package com.microboxlabs.miot.symptoms.evaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.redis.client.Redis;
import io.vertx.mutiny.redis.client.RedisAPI;
import io.vertx.redis.client.RedisOptions;
import java.time.Duration;
import java.time.Instant;
import java.util.ConcurrentModificationException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/** Runs the episode scripts on native Redis; use a throwaway instance. */
@EnabledIfSystemProperty(named = "miot.symptoms.test.redis-url", matches = ".+")
class RedisEpisodesTest {

    private static final Duration WAIT = Duration.ofSeconds(5);
    private static final String ASSET = "episode-test-" + UUID.randomUUID();
    private static final String CLOSE_ASSET = ASSET + "-close";
    private static final String FORGET_ASSET = ASSET + "-forget";
    private static Vertx vertx;
    private static Redis client;
    private static RedisAPI redis;

    @BeforeAll
    static void setUp() {
        vertx = Vertx.vertx();
        client = Redis.createClient(vertx,
                new RedisOptions().setConnectionString(System.getProperty("miot.symptoms.test.redis-url")));
        redis = RedisAPI.api(client);
    }

    @AfterAll
    static void tearDown() {
        if (redis != null) {
            redis.del(List.of(RedisEpisodes.key("tenant-a", ASSET), RedisEpisodes.key("tenant-b", ASSET),
                    RedisEpisodes.tenantsKey(ASSET), RedisEpisodes.key("tenant-a", CLOSE_ASSET),
                    RedisEpisodes.tenantsKey(CLOSE_ASSET), RedisEpisodes.key("tenant-a", FORGET_ASSET),
                    RedisEpisodes.tenantsKey(FORGET_ASSET))).await().atMost(WAIT);
        }
        if (client != null) {
            client.close();
        }
        if (vertx != null) {
            vertx.close().await().atMost(WAIT);
        }
    }

    @Test
    void forgettingACaseDropsItsEpisodeAcrossReplicasAndPreservesTheWatermark() {
        EpisodeRepository first = new RedisEpisodes(redis, Duration.ofDays(7));
        EpisodeRepository second = new RedisEpisodes(redis, Duration.ofDays(7));
        assertForgotten(first, second);
    }

    static void assertForgotten(EpisodeRepository first, EpisodeRepository second) {
        String tenant = "tenant-a";
        UUID id = UUID.randomUUID();
        Instant at = Instant.parse("2026-10-22T03:00:00Z");
        AssetEpisodes state = first.load(tenant, ASSET);
        state.save(tenant, new Episode(id, "1.0.0", ASSET, at, at, null, Map.of(), at, at, 2, 10,
                SymptomState.TEST));
        state.setWatermark(tenant, ASSET, "gps_signal", at);
        first.save(state);

        second.forget(tenant, ASSET, id);
        second.forget(tenant, ASSET, id);

        assertTrue(first.load(tenant, ASSET).find(tenant, ASSET, id).isEmpty());
        assertEquals(at, first.load(tenant, ASSET).watermark(tenant, ASSET, "gps_signal").orElseThrow());

        state = first.load(tenant, ASSET);
        Episode current = new Episode(id, "1.0.0", ASSET, at, at, null, Map.of(), at, at, 2, 10,
                SymptomState.ACTIVE);
        state.save(tenant, current);
        first.save(state);
        second.forgetStale(tenant, ASSET, id, SymptomState.TEST, at);
        assertEquals(current, first.load(tenant, ASSET).find(tenant, ASSET, id).orElseThrow());

        second.forgetStale(tenant, ASSET, id, current.state(), at.minusSeconds(1));
        assertEquals(current, first.load(tenant, ASSET).find(tenant, ASSET, id).orElseThrow());
        AssetEpisodes beforeSweep = first.load(tenant, ASSET);
        beforeSweep.save(tenant, current);
        second.forgetStale(tenant, ASSET, id, current.state(), at);
        assertTrue(first.load(tenant, ASSET).find(tenant, ASSET, id).isEmpty());
        assertThrows(ConcurrentModificationException.class, () -> first.save(beforeSweep));

        Episode marker = Episode.closedOnTrip(id, ASSET, "T-1");
        second.operatorClose(tenant, ASSET, id, marker);
        second.forgetStale(tenant, ASSET, id, current.state(), at.plusSeconds(1));
        assertEquals(marker, first.load(tenant, ASSET).find(tenant, ASSET, id).orElseThrow());
        second.forget(tenant, ASSET, id);
    }

    @Test
    void theIndexSurvivesANewRepositoryAndDropsOnlyTheFinishedTenant() {
        RedisEpisodes repository = new RedisEpisodes(redis, Duration.ofDays(7));
        Instant at = Instant.parse("2026-10-22T03:00:00Z");
        UUID id = UUID.randomUUID();
        Episode episode = new Episode(id, "1.0.0", ASSET, at, at, null, Map.of(), at, at, 2, 10);
        for (String tenant : List.of("tenant-a", "tenant-b")) {
            AssetEpisodes state = repository.load(tenant, ASSET);
            state.save(tenant, episode);
            state.setWatermark(tenant, ASSET, "gps_signal", at);
            repository.save(state);
        }

        RedisEpisodes resumed = new RedisEpisodes(redis, Duration.ofDays(7));
        assertEquals(Set.of("tenant-a", "tenant-b"), resumed.tenantsWithEpisodes(ASSET));
        assertEquals(episode, resumed.load("tenant-a", ASSET).find("tenant-a", ASSET, id).orElseThrow());
        assertTrue(redis.ttl(RedisEpisodes.tenantsKey(ASSET)).await().atMost(WAIT).toLong() > 0);

        AssetEpisodes closed = resumed.load("tenant-a", ASSET);
        closed.delete("tenant-a", ASSET, id);
        resumed.save(closed);
        assertEquals(Set.of("tenant-b"), resumed.tenantsWithEpisodes(ASSET));
        assertEquals(at, resumed.load("tenant-a", ASSET).watermark("tenant-a", ASSET, "gps_signal").orElseThrow());

        // A tenant's episode hash may expire before the vehicle's other tenants stop updating the index.
        redis.del(List.of(RedisEpisodes.key("tenant-b", ASSET))).await().atMost(WAIT);
        resumed.save(resumed.load("tenant-b", ASSET));
        assertTrue(resumed.tenantsWithEpisodes(ASSET).isEmpty());
    }

    @Test
    void aTripCloseRejectsAnEpisodeWhoseOpeningHasNotBeenSavedYet() {
        EpisodeRepositoryConcurrencyTest.assertTripCloseProtectsSnapshot(
                new RedisEpisodes(redis, Duration.ofDays(7)), new RedisEpisodes(redis, Duration.ofDays(7)), FORGET_ASSET);
    }

    @Test
    void anOperatorMarkerRejectsStaleWritesAndDeletesAcrossRepositories() {
        EpisodeRepositoryConcurrencyTest.assertMarkerProtectsSnapshots(
                new RedisEpisodes(redis, Duration.ofDays(7)), new RedisEpisodes(redis, Duration.ofDays(7)), CLOSE_ASSET);
    }

    @Test
    void anOperatorCloseWithoutATripRejectsStaleReopeningAcrossRepositories() {
        EpisodeRepositoryConcurrencyTest.assertUnmarkedCloseProtectsSnapshot(
                new RedisEpisodes(redis, Duration.ofDays(7)), new RedisEpisodes(redis, Duration.ofDays(7)), FORGET_ASSET);
    }
}
