package com.microboxlabs.miot.symptoms.signal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.pgclient.PgConnectOptions;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/** Uses only the explicitly supplied scratch database, like the other Pg tests in this module. */
@EnabledIfSystemProperty(named = "miot.symptoms.test.pg-url", matches = ".+")
class PgDeviceEventsTest {

    private static final Duration WAIT = Duration.ofSeconds(10);
    private static final DeviceEvents.DeviceEvent EVENT = new DeviceEvents.DeviceEvent("app-1", "V1", "Emergencia",
            OffsetDateTime.parse("2026-10-01T12:00:00Z"), null, null, null);
    private static Vertx vertx;
    private static Pool pool;
    private static DeviceEvents.PgSeen seen;

    @BeforeAll
    static void setUp() throws Exception {
        vertx = Vertx.vertx();
        pool = PgBuilder.pool().connectingTo(PgConnectOptions.fromUri(System.getProperty("miot.symptoms.test.pg-url")))
                .using(vertx).build();
        pool.query("CREATE SCHEMA IF NOT EXISTS miot_symptoms; DROP TABLE IF EXISTS miot_symptoms.device_event")
                .execute().await().atMost(WAIT);
        try (var in = PgDeviceEventsTest.class.getResourceAsStream("/db/migration/symptoms/V0.12.22__device_events.sql")) {
            String migration = new String(in.readAllBytes(), StandardCharsets.UTF_8);
            pool.query(migration.substring(0, migration.indexOf("-- Independent device events")))
                    .execute().await().atMost(WAIT);
        }
        seen = new DeviceEvents.PgSeen(() -> pool);
    }

    @BeforeEach
    void clear() {
        pool.query("TRUNCATE miot_symptoms.device_event").execute().await().atMost(WAIT);
    }

    @AfterAll
    static void close() {
        pool.close().await().atMost(WAIT);
        vertx.close().await().atMost(WAIT);
    }

    @Test
    void acknowledgedIdsAreDeduplicatedWithinTheirTenant() {
        AtomicInteger sent = new AtomicInteger();
        assertTrue(seen.publishIfNew("tenant-a", "app-1", EVENT, sent::incrementAndGet));
        assertFalse(seen.publishIfNew("tenant-a", "app-1", EVENT, sent::incrementAndGet));
        assertTrue(seen.publishIfNew("tenant-b", "app-1", EVENT, sent::incrementAndGet));
        assertEquals(2, sent.get());
    }

    @Test
    void aConcurrentRetryCannotAcknowledgeAnUnpublishedEvent() throws Exception {
        CountDownLatch publishing = new CountDownLatch(1);
        CountDownLatch fail = new CountDownLatch(1);
        AtomicInteger retried = new AtomicInteger();
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var first = executor.submit(() -> seen.publishIfNew("tenant-a", "app-1", EVENT, () -> {
                publishing.countDown();
                try {
                    if (!fail.await(5, TimeUnit.SECONDS)) {
                        throw new IllegalStateException("test did not release publication");
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException(e);
                }
                throw new DeviceEvents.UnavailableException("broker rejected publication");
            }));
            try {
                assertTrue(publishing.await(5, TimeUnit.SECONDS));
                assertEquals(0L, pool.query("SELECT count(*) FROM miot_symptoms.device_event").execute()
                        .await().atMost(WAIT).iterator().next().getLong(0), "no receipt commits before the ack");
                var retry = executor.submit(() -> seen.publishIfNew("tenant-a", "app-1", EVENT,
                        retried::incrementAndGet));
                assertThrows(TimeoutException.class, () -> retry.get(200, TimeUnit.MILLISECONDS));
                fail.countDown();
                assertThrows(ExecutionException.class, () -> first.get(5, TimeUnit.SECONDS));
                assertTrue(retry.get(5, TimeUnit.SECONDS), "the rejected send rolls back so the retry publishes");
                assertEquals(1, retried.get());
            } finally {
                fail.countDown();
            }
        }
    }
}
