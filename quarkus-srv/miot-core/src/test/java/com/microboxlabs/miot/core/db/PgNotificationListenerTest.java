package com.microboxlabs.miot.core.db;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgConnectOptions;
import io.vertx.sqlclient.PoolOptions;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/** Native scratch PostgreSQL only; creates no tables and never touches production. */
@EnabledIfSystemProperty(named = "miot.core.test.pg-url", matches = ".+")
class PgNotificationListenerTest {

    private static final Duration WAIT = Duration.ofSeconds(10);
    private final List<Pool> pools = new ArrayList<>();
    private final List<PgNotificationListener> listeners = new ArrayList<>();
    private final String channel = "cert_notify_" + UUID.randomUUID().toString().replace("-", "");
    private Vertx vertx;

    @BeforeEach
    void setUp() {
        vertx = Vertx.vertx();
    }

    @AfterEach
    void cleanUp() {
        listeners.forEach(PgNotificationListener::close);
        pools.forEach(Pool::closeAndAwait);
        vertx.closeAndAwait();
    }

    private Pool pool() {
        Pool pool = PgBuilder.pool()
                .connectingTo(PgConnectOptions.fromUri(System.getProperty("miot.core.test.pg-url")))
                .with(new PoolOptions().setMaxSize(1)).using(vertx).build();
        pools.add(pool);
        return pool;
    }

    private PgNotificationListener listener(Pool pool, LinkedBlockingQueue<String> received) {
        PgNotificationListener listener = new PgNotificationListener(() -> pool, vertx, channel, received::add,
                Duration.ofMillis(20));
        listeners.add(listener);
        return listener;
    }

    private void publish(Pool publisher, String payload) {
        publisher.preparedQuery("SELECT pg_notify($1, $2)").execute(Tuple.of(channel, payload)).await().atMost(WAIT);
    }

    @Test
    void broadcastsAcrossConnectionsAndReturnsACleanPoolConnectionOnClose() throws Exception {
        Pool firstPool = pool();
        Pool publisher = pool();
        LinkedBlockingQueue<String> firstFrames = new LinkedBlockingQueue<>();
        LinkedBlockingQueue<String> secondFrames = new LinkedBlockingQueue<>();
        PgNotificationListener first = listener(firstPool, firstFrames);
        PgNotificationListener second = listener(pool(), secondFrames);
        first.start().toCompletableFuture().get(5, TimeUnit.SECONDS);
        first.start().toCompletableFuture().get(5, TimeUnit.SECONDS);
        second.start().toCompletableFuture().get(5, TimeUnit.SECONDS);

        publish(publisher, "first");
        assertEquals("first", firstFrames.poll(5, TimeUnit.SECONDS));
        assertEquals("first", secondFrames.poll(5, TimeUnit.SECONDS));
        first.close();
        long channels = firstPool.query("SELECT count(*) AS channels FROM pg_listening_channels()")
                .execute().await().atMost(WAIT).iterator().next().getLong("channels");
        assertEquals(0, channels, "UNLISTEN runs before the only connection returns to its pool");
        publish(publisher, "second");
        assertEquals("second", secondFrames.poll(5, TimeUnit.SECONDS));
        assertNull(firstFrames.poll(100, TimeUnit.MILLISECONDS));
    }

    @Test
    void reconnectsAfterItsOwnPostgresSessionIsTerminated() throws Exception {
        Pool publisher = pool();
        LinkedBlockingQueue<String> received = new LinkedBlockingQueue<>();
        PgNotificationListener listener = listener(pool(), received);
        listener.start().toCompletableFuture().get(5, TimeUnit.SECONDS);
        var killed = publisher.preparedQuery("""
                SELECT pg_terminate_backend(pid) AS terminated FROM pg_stat_activity
                 WHERE datname = current_database() AND usename = current_user
                   AND query = $1 AND pid <> pg_backend_pid()
                """).execute(Tuple.of("LISTEN " + channel)).await().atMost(WAIT);
        assertEquals(1, killed.size(), "the unique channel identifies only this test's listener session");
        assertTrue(killed.iterator().next().getBoolean("terminated"));
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        String frame = null;
        while (frame == null && System.nanoTime() < deadline) {
            publish(publisher, "after-reconnect");
            frame = received.poll(50, TimeUnit.MILLISECONDS);
        }
        assertEquals("after-reconnect", frame);
    }

    @Test
    void retriesStartupFailuresAndCancelsPendingRetriesOnClose() throws Exception {
        Pool connectedPool = pool();
        AtomicInteger attempts = new AtomicInteger();
        PgNotificationListener listener = new PgNotificationListener(() -> {
            if (attempts.incrementAndGet() < 3) {
                throw new IllegalStateException("test pool not ready");
            }
            return connectedPool;
        }, vertx, channel, ignored -> { }, Duration.ofMillis(20));
        listeners.add(listener);
        listener.start().toCompletableFuture().get(5, TimeUnit.SECONDS);
        assertEquals(3, attempts.get());
        listener.close();

        AtomicInteger stoppedAttempts = new AtomicInteger();
        PgNotificationListener stopped = new PgNotificationListener(() -> {
            stoppedAttempts.incrementAndGet();
            throw new IllegalStateException("test unavailable pool");
        }, vertx, channel, ignored -> { }, Duration.ofMillis(20));
        listeners.add(stopped);
        stopped.start();
        stopped.close();
        CompletableFuture<Void> retryWindowPassed = new CompletableFuture<>();
        vertx.setTimer(80, ignored -> retryWindowPassed.complete(null));
        retryWindowPassed.get(5, TimeUnit.SECONDS);
        assertEquals(1, stoppedAttempts.get(), "shutdown cancels the scheduled reconnect");
    }
}
