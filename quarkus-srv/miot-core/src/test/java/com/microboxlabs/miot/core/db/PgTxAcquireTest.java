package com.microboxlabs.miot.core.db;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.SqlConnection;
import io.vertx.pgclient.PgConnectOptions;
import io.vertx.sqlclient.PoolOptions;
import java.time.Duration;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/** A timed-out acquire must not keep the connection the pool hands over later. Native scratch PostgreSQL only. */
@EnabledIfSystemProperty(named = "miot.core.test.pg-url", matches = ".+")
class PgTxAcquireTest {

    private static final Duration SHORT = Duration.ofMillis(300);
    private final ExecutorService holder = Executors.newSingleThreadExecutor();
    private Vertx vertx;
    private Pool pool;

    @BeforeEach
    void setUp() {
        vertx = Vertx.vertx();
        pool = PgBuilder.pool()
                .connectingTo(PgConnectOptions.fromUri(System.getProperty("miot.core.test.pg-url")))
                .with(new PoolOptions().setMaxSize(1)).using(vertx).build();
    }

    @AfterEach
    void tearDown() {
        holder.shutdownNow();
        pool.closeAndAwait();
        vertx.closeAndAwait();
    }

    @Test
    void aTimedOutTransactionDoesNotLeakTheConnection() throws Exception {
        CountDownLatch holding = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        Future<Object> a = holder.submit(() -> PgTx.inTransaction(pool, () -> {
            holding.countDown();
            await(release);
            return "a";
        }));
        holding.await(10, TimeUnit.SECONDS);

        assertThrows(io.smallrye.mutiny.TimeoutException.class, () -> PgTx.inTransaction(pool, () -> "b", SHORT));
        release.countDown();
        assertEquals("a", a.get(10, TimeUnit.SECONDS));

        assertEquals("c", PgTx.inTransaction(pool, () -> "c", Duration.ofSeconds(2)),
                "pool idle but connection not available: leaked");
    }

    @Test
    void aConnectionArrivingAfterTheTimeoutGoesBackToThePool() {
        SqlConnection held = PgTx.acquire(pool, Duration.ofSeconds(5));
        for (int i = 0; i < 3; i++) {
            assertThrows(io.smallrye.mutiny.TimeoutException.class, () -> PgTx.acquire(pool, SHORT));
        }
        held.closeAndAwait();

        SqlConnection again = PgTx.acquire(pool, Duration.ofSeconds(2));
        assertEquals(1, again.query("SELECT 1").execute().await().atMost(Duration.ofSeconds(5)).iterator().next()
                .getInteger(0));
        again.closeAndAwait();
    }

    private static void await(CountDownLatch latch) {
        try {
            latch.await(10, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }
}
