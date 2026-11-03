package com.microboxlabs.miot.symptoms.lostsignal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgConnectOptions;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/** Histogram SQL against a scratch database; these queries only check whether the position is null. */
@EnabledIfSystemProperty(named = "miot.symptoms.test.pg-url", matches = ".+")
class PgGpsFramesTest {

    private static final Duration WAIT = Duration.ofSeconds(10);
    private static final Instant FROM = Instant.parse("2026-01-10T00:00:00Z");
    private static final Instant TO = FROM.plusSeconds(3600);
    private static Vertx vertx;
    private static Pool pool;
    private final PgGpsFrames gps = new PgGpsFrames(() -> pool);

    @BeforeAll
    static void createTable() {
        vertx = Vertx.vertx();
        pool = PgBuilder.pool().connectingTo(PgConnectOptions.fromUri(System.getProperty("miot.symptoms.test.pg-url")))
                .using(vertx).build();
        // The histogram queries need no PostGIS operations, so a native point suffices here.
        pool.query("""
                CREATE TABLE public.asset_data (
                    asset_id text NOT NULL, client_id text, "timestamp" timestamptz,
                    request_timestamp timestamptz, location point
                )
                """).execute().await().atMost(WAIT);
    }

    @AfterAll
    static void close() {
        pool.query("DROP TABLE public.asset_data").execute().await().atMost(WAIT);
        pool.close().await().atMost(WAIT);
        vertx.close().await().atMost(WAIT);
    }

    @BeforeEach
    void empty() {
        pool.query("TRUNCATE public.asset_data").execute().await().atMost(WAIT);
    }

    @Test
    void intervalsIncludeThePrecedingFrameAcrossHourAndDayBoundaries() {
        frame("v1", "s", FROM.minusSeconds(30), 2);
        frame("v1", "s", FROM.plusSeconds(30), 2);
        frame("v1", "s", TO.minusSeconds(30), 2);
        frame("v1", "s", TO.plusSeconds(30), 2);

        assertTrue(gps.intervals(FROM, TO).contains(new GpsFrames.Count("s", 60, 1)));
        assertEquals(List.of(new GpsFrames.Count("s", 60, 1)), gps.intervals(TO, TO.plusSeconds(3600)));
        assertEquals(2, gps.intervals(FROM, TO).stream().mapToLong(GpsFrames.Count::n).sum());
    }

    @Test
    void intervalsKeepAssetsAndSendersSeparateAndDoNotCountDuplicates() {
        frame("v1", "s", FROM.minusSeconds(90), 2);
        frame("v1", "s", FROM.plusSeconds(30), 2);
        frame("v1", "s", FROM.plusSeconds(30), 2);
        frame("v2", "s", FROM.minusSeconds(30), 2);
        frame("v2", "s", FROM.plusSeconds(90), 2);
        frame("v1", "other", FROM.plusSeconds(40), 2);

        assertEquals(List.of(new GpsFrames.Count("s", 120, 2)), gps.intervals(FROM, TO));
    }

    @Test
    void sparseIntervalsUseTheLastFrameWithinTheLookback() {
        frame("v1", "s", FROM.minusSeconds(7200), 2);
        frame("v1", "s", FROM.minusSeconds(3600), 2);
        frame("v1", "s", FROM.plusSeconds(30), 2);

        assertEquals(List.of(new GpsFrames.Count("s", 3630, 1)), gps.intervals(FROM, TO));
    }

    @Test
    void anIntervalLongerThanTheLookbackAcrossTheStartIsNotCounted() {
        frame("v1", "s", FROM.minusSeconds(PgGpsFrames.LOOKBACK_H * 3600L + 60), 2);
        frame("v1", "s", FROM.plusSeconds(30), 2);
        frame("v1", "s", FROM.plusSeconds(90), 2);

        assertEquals(List.of(new GpsFrames.Count("s", 60, 1)), gps.intervals(FROM, TO));
    }

    @Test
    void delaysUseReceiveTimeMinusGpsTimeAndClampClockSkew() {
        frame("v1", "s", FROM, 900);
        frame("v1", "s", FROM.plusSeconds(30), -10);
        frame("v1", "s", TO, 1200);

        List<GpsFrames.Count> delays = gps.delays(FROM, TO);
        assertEquals(2, delays.size());
        assertTrue(delays.contains(new GpsFrames.Count("s", 900, 1)));
        assertTrue(delays.contains(new GpsFrames.Count("s", 0, 1)));
    }

    private static void frame(String asset, String sender, Instant at, long delayS) {
        pool.preparedQuery("""
                INSERT INTO public.asset_data (asset_id, client_id, "timestamp", request_timestamp, location)
                VALUES ($1, $2, $3, $4, point(0, 0))
                """).execute(Tuple.of(asset, sender, at.atOffset(ZoneOffset.UTC),
                        at.plusSeconds(delayS).atOffset(ZoneOffset.UTC))).await().atMost(WAIT);
    }
}
