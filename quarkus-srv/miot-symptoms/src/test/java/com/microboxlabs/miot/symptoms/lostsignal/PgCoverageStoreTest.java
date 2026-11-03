package com.microboxlabs.miot.symptoms.lostsignal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.lostsignal.CoverageDay.CellDay;
import com.microboxlabs.miot.symptoms.lostsignal.CoverageDay.SenderDay;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.pgclient.PgConnectOptions;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/**
 * The shadow map's day rows against a real database. Skipped unless {@code -Dmiot.symptoms.test.pg-url=...} is
 * set; the {@code miot_symptoms} schema is dropped and re-created, so use a scratch database.
 */
@EnabledIfSystemProperty(named = "miot.symptoms.test.pg-url", matches = ".+")
class PgCoverageStoreTest {

    private static final Duration WAIT = Duration.ofSeconds(10);
    private static final LocalDate DAY = LocalDate.parse("2026-01-10");
    private static Vertx vertx;
    private static Pool pool;

    private final PgCoverageStore store = new PgCoverageStore(() -> pool);

    @BeforeAll
    static void migrate() throws IOException {
        vertx = Vertx.vertx();
        pool = PgBuilder.pool().connectingTo(PgConnectOptions.fromUri(System.getProperty("miot.symptoms.test.pg-url")))
                .using(vertx).build();
        pool.query("DROP SCHEMA IF EXISTS miot_symptoms CASCADE").execute().await().atMost(WAIT);
        pool.query("CREATE SCHEMA miot_symptoms").execute().await().atMost(WAIT);
        try (InputStream in = PgCoverageStoreTest.class.getResourceAsStream(
                "/db/migration/symptoms/V0.12.8__coverage_days.sql")) {
            pool.query(new String(in.readAllBytes(), StandardCharsets.UTF_8)).execute().await().atMost(WAIT);
        }
    }

    @AfterAll
    static void close() {
        pool.close().await().atMost(WAIT);
        vertx.close().await().atMost(WAIT);
    }

    @BeforeEach
    void empty() {
        pool.query("TRUNCATE miot_symptoms.coverage_day, miot_symptoms.coverage_sender_day, miot_symptoms.coverage_run")
                .execute().await().atMost(WAIT);
    }

    @Test
    void aDayIsReplacedWhole() {
        store.replace(DAY, List.of(new CellDay("s", "1:2", DAY, 10, 2, 1.5), new CellDay("s", "1:3", DAY, 5, 0, 0)),
                List.of(new SenderDay("s", DAY, 15, 2, 1.5, 4.0, 30.0, false)), 15);
        store.replace(DAY, List.of(new CellDay("s", "1:2", DAY, 7, 1, 0)),
                List.of(new SenderDay("s", DAY, 7, 1, 0, null, null, false)), 7);

        assertEquals(List.of(new CellDay("s", "1:2", DAY, 7, 1, 0)), store.cells(DAY));
        assertEquals(List.of(new SenderDay("s", DAY, 7, 1, 0, null, null, false)), store.senders(DAY));
        assertTrue(store.done(DAY.minusDays(1)).contains(DAY));
    }

    @Test
    void manyRowsAreWrittenInChunks() {
        List<CellDay> cells = new ArrayList<>();
        for (int i = 0; i < PgCoverageStore.CHUNK + 10; i++) {
            cells.add(new CellDay("s", "1:" + i, DAY, 1, 0, 0));
        }
        store.replace(DAY, cells, List.of(), cells.size());

        assertEquals(cells.size(), store.cells(DAY).size());
    }

    @Test
    void anomalousFlagsAndPurge() {
        store.replace(DAY, List.of(), List.of(new SenderDay("s", DAY, 15, 2, 1.5, 4.0, 30.0, false)), 15);
        store.replace(DAY.minusDays(40), List.of(new CellDay("s", "1:2", DAY.minusDays(40), 1, 0, 0)), List.of(), 1);

        store.flag(List.of(new SenderDay("s", DAY, 15, 2, 1.5, 4.0, 30.0, true)));
        store.purge(DAY.minusDays(30));

        assertTrue(store.senders(DAY.minusDays(60)).get(0).anomalous());
        assertTrue(store.cells(DAY.minusDays(60)).isEmpty());
        assertFalse(store.done(DAY.minusDays(60)).contains(DAY.minusDays(40)));
    }

    @Test
    void aSnapshotReadsBothTablesAndExcludesOlderDays() {
        CellDay cell = new CellDay("s", "1:2", DAY, 15, 2, 1.5);
        SenderDay sender = new SenderDay("s", DAY, 15, 2, 1.5, null, 30.0, false);
        store.replace(DAY, List.of(cell), List.of(sender), 15);
        store.replace(DAY.minusDays(1), List.of(new CellDay("old", "1:2", DAY.minusDays(1), 10, 0, 0)),
                List.of(new SenderDay("old", DAY.minusDays(1), 10, 0, 0, 2.0, null, false)), 10);
        store.flag(List.of(sender.anomalous(true)));

        CoverageStore.Snapshot snapshot = store.snapshot(DAY);

        assertEquals(List.of(cell), snapshot.cells());
        assertEquals(List.of(sender.anomalous(true)), snapshot.senders());
    }

    @Test
    void snapshotsStayConsistentWhileADayIsReplaced() throws Exception {
        replaceCounts(1);
        CountDownLatch started = new CountDownLatch(1);
        try (var writer = Executors.newSingleThreadExecutor()) {
            var written = writer.submit(() -> {
                started.countDown();
                for (int frames = 2; frames <= 101; frames++) {
                    replaceCounts(frames);
                }
            });
            assertTrue(started.await(WAIT.toSeconds(), TimeUnit.SECONDS));
            for (int read = 0; read < 100; read++) {
                CoverageStore.Snapshot snapshot = store.snapshot(DAY);
                assertEquals(1, snapshot.cells().size());
                assertEquals(1, snapshot.senders().size());
                assertEquals(snapshot.cells().get(0).frames(), snapshot.senders().get(0).frames(),
                        "cell counts and sender totals must come from the same replacement");
            }
            written.get(30, TimeUnit.SECONDS);
        }
    }

    private void replaceCounts(int frames) {
        store.replace(DAY, List.of(new CellDay("s", "1:2", DAY, frames, 0, 0)),
                List.of(new SenderDay("s", DAY, frames, 0, 0, null, null, false)), frames);
    }
}
