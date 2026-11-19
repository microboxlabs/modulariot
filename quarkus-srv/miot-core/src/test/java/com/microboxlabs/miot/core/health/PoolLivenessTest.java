package com.microboxlabs.miot.core.health;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.core.db.PgTx;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.SqlConnection;
import io.vertx.pgclient.PgConnectOptions;
import io.vertx.sqlclient.PoolOptions;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import org.eclipse.microprofile.health.HealthCheckResponse.Status;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/** Native scratch PostgreSQL only: a max-size-1 pool whose one connection the test holds. */
@EnabledIfSystemProperty(named = "miot.core.test.pg-url", matches = ".+")
class PoolLivenessTest {

    private static final class MovableClock extends Clock {
        private Instant now = Instant.parse("2026-11-19T12:00:00Z");

        void advance(Duration d) {
            now = now.plus(d);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    private final MovableClock clock = new MovableClock();
    private Vertx vertx;
    private Pool pool;
    private PoolLiveness liveness;

    @BeforeEach
    void setUp() {
        vertx = Vertx.vertx();
        pool = PgBuilder.pool()
                .connectingTo(PgConnectOptions.fromUri(System.getProperty("miot.core.test.pg-url")))
                .with(new PoolOptions().setMaxSize(1)).using(vertx).build();
        liveness = new PoolLiveness(() -> pool, clock, Duration.ofMillis(200), Duration.ofSeconds(60), 3);
    }

    @AfterEach
    void tearDown() {
        pool.closeAndAwait();
        vertx.closeAndAwait();
    }

    private Status probeAfter(Duration wait) {
        clock.advance(wait);
        liveness.probe();
        return liveness.call().getStatus();
    }

    @Test
    void downOnlyAfterSeveralFailedProbesOverTheWindowAndUpOnTheNextSuccess() {
        assertEquals(Status.UP, probeAfter(Duration.ZERO));

        SqlConnection held = PgTx.acquire(pool, Duration.ofSeconds(5));
        assertEquals(Status.UP, probeAfter(Duration.ZERO), "first failed probe");
        assertEquals(Status.UP, probeAfter(Duration.ofSeconds(30)), "two failures");
        assertEquals(Status.UP, probeAfter(Duration.ofSeconds(20)), "three failures, only 50 s");
        assertEquals(Status.DOWN, probeAfter(Duration.ofSeconds(10)), "four failures over 60 s");
        assertEquals(Status.DOWN, liveness.call().getStatus(), "reading the state does not reset it");

        held.closeAndAwait();
        assertEquals(Status.UP, probeAfter(Duration.ofSeconds(10)), "the pool recovered");
    }

    @Test
    void oneSlowAcquireDoesNotFlap() {
        SqlConnection held = PgTx.acquire(pool, Duration.ofSeconds(5));
        assertEquals(Status.UP, probeAfter(Duration.ZERO));
        clock.advance(Duration.ofMinutes(5));
        assertEquals(Status.UP, liveness.call().getStatus(), "one failure, however old");

        held.closeAndAwait();
        assertEquals(Status.UP, probeAfter(Duration.ofSeconds(10)));
        held = PgTx.acquire(pool, Duration.ofSeconds(5));
        assertEquals(Status.UP, probeAfter(Duration.ofSeconds(10)), "the count restarts after a success");
        assertEquals(Status.UP, probeAfter(Duration.ofSeconds(60)));
        held.closeAndAwait();
    }

    @Test
    void upWithoutAPool() {
        PoolLiveness none = new PoolLiveness(() -> null, clock, Duration.ofMillis(200), Duration.ofSeconds(60), 3);
        none.probe();
        assertEquals(Status.UP, none.call().getStatus());
    }
}
