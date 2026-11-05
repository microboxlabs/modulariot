package com.microboxlabs.miot.symptoms.lostsignal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgConnectOptions;
import io.vertx.sqlclient.PoolOptions;
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
                .with(new PoolOptions().setMaxSize(1)).using(vertx).build();
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
    void anIntervalWhosePredecessorIsBeforeTheLookbackIsNotCounted() {
        frame("v1", "s", FROM.minusSeconds(PgGpsFrames.LOOKBACK_H * 3600L + 60), 2);
        frame("v1", "s", FROM.plusSeconds(30), 2);
        frame("v1", "s", FROM.plusSeconds(90), 2);

        assertEquals(List.of(new GpsFrames.Count("s", 60, 1)), gps.intervals(FROM, TO));
    }

    @Test
    void aCrossingIntervalLongerThanTheLookbackIsNotCounted() {
        frame("v1", "s", FROM.minusSeconds(PgGpsFrames.LOOKBACK_H * 3600L - 1), 2);
        frame("v1", "s", FROM.plusSeconds(3500), 2);
        frame("v1", "s", FROM.plusSeconds(3530), 2);

        assertEquals(List.of(new GpsFrames.Count("s", 30, 1)), gps.intervals(FROM, TO));
    }

    @Test
    void anIntervalWithinTheRangeIsNotLimitedByTheLookback() {
        long seconds = (PgGpsFrames.LOOKBACK_H + 1) * 3600L;
        frame("v1", "s", FROM, 2);
        frame("v1", "s", FROM.plusSeconds(seconds), 2);

        assertEquals(List.of(new GpsFrames.Count("s", (int) seconds, 1)),
                gps.intervals(FROM, FROM.plusSeconds(seconds + 1)));
    }

    @Test
    void anIntervalWhosePredecessorIsExactlyAtTheLookbackIsCounted() {
        long seconds = PgGpsFrames.LOOKBACK_H * 3600L;
        frame("v1", "s", FROM.minusSeconds(seconds), 2);
        frame("v1", "s", FROM, 2);

        assertEquals(List.of(new GpsFrames.Count("s", (int) seconds, 1)), gps.intervals(FROM, TO));
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

    @Test
    void framesAreReadAFewRowsAtATimeInAssetSenderAndTimeOrder() {
        String nativePoint = PgGpsFrames.FRAMES.replace("ST_Y(a.location::geometry)", "a.location[1]")
                .replace("ST_X(a.location::geometry)", "a.location[0]");
        PgGpsFrames small = new PgGpsFrames(() -> pool, 2, nativePoint);
        for (int i = 0; i < 7; i++) {
            frame("v" + (i % 2), "s", FROM.plusSeconds(60L * (7 - i)), i);
        }
        frame("v0", "s", TO, 0);
        List<GpsFrames.GpsRow> rows = new java.util.ArrayList<>();

        assertEquals(7, small.frames(FROM, TO, rows::add));

        assertEquals(List.of("v0", "v0", "v0", "v0", "v1", "v1", "v1"),
                rows.stream().map(GpsFrames.GpsRow::assetId).toList());
        for (int i = 1; i < rows.size(); i++) {
            GpsFrames.GpsRow a = rows.get(i - 1);
            GpsFrames.GpsRow b = rows.get(i);
            assertTrue(!a.assetId().equals(b.assetId()) || a.atMs() < b.atMs());
        }
        assertEquals(FROM.plusSeconds(60).toEpochMilli(), rows.get(0).atMs());
        assertEquals(6.0, rows.get(0).delayS());
    }

    @Test
    void aFailingConsumerReleasesTheConnection() {
        String nativePoint = PgGpsFrames.FRAMES.replace("ST_Y(a.location::geometry)", "a.location[1]")
                .replace("ST_X(a.location::geometry)", "a.location[0]");
        PgGpsFrames small = new PgGpsFrames(() -> pool, 2, nativePoint);
        for (int i = 0; i < 5; i++) {
            frame("v1", "s", FROM.plusSeconds(i), 0);
        }
        for (int attempt = 0; attempt < 6; attempt++) {
            org.junit.jupiter.api.Assertions.assertThrows(IllegalStateException.class,
                    () -> small.frames(FROM, TO, r -> {
                        throw new IllegalStateException("stop");
                    }));
        }

        assertEquals(5, small.frames(FROM, TO, r -> { }), "the pool still has connections");
        assertNoPreparedStatement(nativePoint);
    }

    @Test
    void theCursorIsReadOnlyAndItsSettingsAreResetWhenReturnedToThePool() {
        gps.stream("""
                SELECT current_setting('transaction_read_only') AS read_only,
                       current_setting('statement_timeout') AS timeout
                WHERE $1::timestamptz < $2::timestamptz
                """, FROM, TO, r -> {
                    assertEquals("on", r.getString("read_only"));
                    assertEquals("80s", r.getString("timeout"));
                });

        assertEquals("off", pool.query("SHOW transaction_read_only").execute().await().atMost(WAIT)
                .iterator().next().getString(0));
        assertEquals("0", pool.query("SHOW statement_timeout").execute().await().atMost(WAIT)
                .iterator().next().getString(0));
    }

    @Test
    void aFetchTimeoutRollsBackAndReleasesTheOnlyConnection() {
        PgGpsFrames small = new PgGpsFrames(() -> pool, 2, PgGpsFrames.FRAMES);
        // The first fetch shortens the transaction-local timeout; the next fetch must hit it.
        String slow = """
                SELECT i, set_config('statement_timeout', '50ms', true),
                       pg_sleep(CASE WHEN i > 2 THEN 0.2 ELSE 0 END)
                FROM generate_series(1, 6) AS i
                WHERE $1::timestamptz < $2::timestamptz
                """;
        io.vertx.pgclient.PgException failure = assertThrows(io.vertx.pgclient.PgException.class,
                () -> small.stream(slow, FROM, TO, r -> { }));
        assertEquals("57014", failure.getSqlState());
        assertEquals("0", pool.query("SHOW statement_timeout").execute().await().atMost(WAIT)
                .iterator().next().getString(0));
        assertNoPreparedStatement(slow);
    }

    private static void assertNoPreparedStatement(String sql) {
        assertEquals(0L, pool.preparedQuery("SELECT count(*) FROM pg_prepared_statements WHERE statement = $1")
                .execute(Tuple.of(sql)).await().atMost(WAIT).iterator().next().getLong(0),
                "streams must close their named statement before returning the pooled session");
    }

    private static void frame(String asset, String sender, Instant at, long delayS) {
        pool.preparedQuery("""
                INSERT INTO public.asset_data (asset_id, client_id, "timestamp", request_timestamp, location)
                VALUES ($1, $2, $3, $4, point(0, 0))
                """).execute(Tuple.of(asset, sender, at.atOffset(ZoneOffset.UTC),
                        at.plusSeconds(delayS).atOffset(ZoneOffset.UTC))).await().atMost(WAIT);
    }
}
