package com.microboxlabs.miot.symptoms.duty;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.redis.client.Redis;
import io.vertx.mutiny.redis.client.RedisAPI;
import io.vertx.redis.client.RedisOptions;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/** Runs the duty store on native Redis; use a throwaway instance. */
@EnabledIfSystemProperty(named = "miot.symptoms.test.redis-url", matches = ".+")
class RedisDutyStoreTest {

    private static final Duration WAIT = Duration.ofSeconds(5);
    private static final String ASSET = "duty-test-" + UUID.randomUUID();
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
            redis.del(List.of(RedisDutyStore.key("tenant-a", ASSET))).await().atMost(WAIT);
        }
        if (client != null) {
            client.close();
        }
        if (vertx != null) {
            vertx.close().await().atMost(WAIT);
        }
    }

    @Test
    void aNewConsumerLoadsCountersAndAppliesAnInterveningCloseOnce() {
        String tenant = "tenant-restart";
        try {
            DutyChecks first = new DutyChecks(new RedisDutyStore(redis, Duration.ofHours(1)));
            Instant start = Instant.parse("2026-01-01T00:00:00Z");
            var parked = signal(-33.0);
            var moving = signal(-33.001);
            var one = first.apply(tenant, ASSET, start, parked).orElseThrow();
            first.save(tenant, ASSET, one.next());
            var two = first.apply(tenant, ASSET, start.plusSeconds(30), moving).orElseThrow();
            first.restartDuty(tenant, ASSET);
            first.save(tenant, ASSET, two.next());

            DutyChecks restarted = new DutyChecks(new RedisDutyStore(redis, Duration.ofHours(1)));
            assertTrue(restarted.apply(tenant, ASSET, start.plusSeconds(30), moving).isEmpty());
            assertTrue(restarted.apply(tenant, ASSET, start, parked).isEmpty());
            var three = restarted.apply(tenant, ASSET, start.plusSeconds(60), signal(-33.002)).orElseThrow();
            assertEquals(1.0, (Double) three.check().get("driving_minutes"), 0.001);
            assertEquals(0.0, (Double) three.check().get("duty_minutes"));
            assertEquals(1, three.next().restarts());
            restarted.save(tenant, ASSET, three.next());
            var four = restarted.apply(tenant, ASSET, start.plusSeconds(90), signal(-33.003)).orElseThrow();
            assertEquals(0.5, (Double) four.check().get("duty_minutes"), 0.001);
            assertEquals(1, four.next().restarts(), "the operator close is applied only once");
            assertNull(restarted.apply("other-tenant", ASSET, start, parked).orElseThrow().next().rest().dutyS());
        } finally {
            redis.del(List.of(RedisDutyStore.key(tenant, ASSET))).await().atMost(WAIT);
        }
    }

    private static java.util.Map<String, Object> signal(double lat) {
        return java.util.Map.of("trip", java.util.Map.of("active", true, "id", "T-1"), "frame",
                java.util.Map.of("gps", java.util.Map.of("latitude", lat, "longitude", -70.0)));
    }

    @Test
    void savesTheStateAndCountsRestartsApartWithAnExpiry() {
        RedisDutyStore store = new RedisDutyStore(redis, Duration.ofHours(1));
        assertNull(store.load("tenant-a", ASSET).state());

        store.restartDuty("tenant-a", ASSET);
        DutyState s = new DutyState(Instant.parse("2026-01-01T00:00:00Z"), -33.0, -70.0,
                new DutyState.Drive("T-1", true, 60, 30, 0, 0, 0), new DutyState.Rest("T-1", 90.0, null), 0);
        store.save("tenant-a", ASSET, s);
        store.restartDuty("tenant-a", ASSET);

        DutyStore.Loaded loaded = store.load("tenant-a", ASSET);
        assertEquals(s, loaded.state());
        assertEquals(2, loaded.restarts(), "a save does not overwrite the restarts");
        long ttl = redis.ttl(RedisDutyStore.key("tenant-a", ASSET)).await().atMost(WAIT).toLong();
        assertTrue(ttl > 0 && ttl <= 3600);
    }
}
