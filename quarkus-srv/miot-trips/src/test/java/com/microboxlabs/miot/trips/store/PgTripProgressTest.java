package com.microboxlabs.miot.trips.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.pgclient.PgConnectOptions;
import java.io.IOException;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/**
 * {@code miot_trips.trip_progress} reads as the expressions miot-symptoms used before it, on a dataset with every
 * departure and arrival case of the baseline tests. Skipped unless {@code -Dmiot.trips.test.pg-url=…} is set.
 */
@EnabledIfSystemProperty(named = PgTripsStoresTest.URL_PROPERTY, matches = ".+")
class PgTripProgressTest {

    private static final Duration WAIT = Duration.ofSeconds(10);

    /** The departure and arrival as miot-symptoms read them before the view, for every trip row. */
    private static final String OLD = """
            SELECT t.tenant_code, t.id AS trip_id,
                   coalesce((SELECT m.confirmed_at FROM miot_trips.trip_milestone m
                              WHERE m.tenant_code = t.tenant_code AND m.trip_id = t.id
                                AND m.milestone = 'departure' AND m.status = 'confirmed'),
                            (SELECT min(s.actual_start) FROM miot_trips.stage s
                              WHERE s.tenant_code = t.tenant_code AND s.subject_type = 'trip'
                                AND s.subject_id = t.id AND s.stage_type IN ('transit', 'stop')
                                AND s.version_of IS NULL AND s.is_active)) AS departed_at,
                   EXISTS (SELECT 1 FROM miot_trips.trip_milestone m
                            WHERE m.tenant_code = t.tenant_code AND m.trip_id = t.id
                              AND m.milestone = 'arrival' AND m.status = 'confirmed') AS arrived,
                   (SELECT m.confirmed_at FROM miot_trips.trip_milestone m
                     WHERE m.tenant_code = t.tenant_code AND m.trip_id = t.id
                       AND m.milestone = 'arrival' AND m.status = 'confirmed') AS arrived_at
              FROM miot_trips.trip t
            """;
    private static final String NEW = "SELECT tenant_code, trip_id, departed_at, arrived, arrived_at"
            + " FROM miot_trips.trip_progress";

    /**
     * One trip per case, ids {@code 0…0n}. T0 is 2026-10-26T09:00Z. Stages are inserted with distinct {@code seq}.
     */
    private static final String DATASET = """
            INSERT INTO miot_trips.trip (id, tenant_code, status, version_of, is_active)
            SELECT ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 'org-a', 'in_progress', null, true
              FROM generate_series(1, 20) n;
            -- 21: an old version of trip 1; 22: an inactive trip; 23: a trip of another tenant
            INSERT INTO miot_trips.trip (id, tenant_code, status, version_of, is_active) VALUES
                ('00000000-0000-0000-0000-000000000021', 'org-a', 'in_progress',
                 '00000000-0000-0000-0000-000000000001', false),
                ('00000000-0000-0000-0000-000000000022', 'org-a', 'cancelled', null, false),
                ('00000000-0000-0000-0000-000000000023', 'org-b', 'in_progress', null, true);

            CREATE TEMP TABLE m (n int, tenant text, milestone text, status text, at timestamptz);
            INSERT INTO m VALUES
                (1, 'org-a', 'departure', 'confirmed', '2026-10-26T09:30:00Z'),  -- confirmed, a stage earlier
                (2, 'org-a', 'departure', 'confirmed', '2026-10-26T09:00:00Z'),  -- confirmed, a stage later
                (3, 'org-a', 'departure', 'pending', null),
                (4, 'org-a', 'departure', 'rejected', null),
                -- 5: no departure, stages only
                (6, 'org-b', 'departure', 'confirmed', '2026-10-26T08:00:00Z'),  -- another tenant's departure
                (7, 'org-a', 'departure', 'confirmed', null),                    -- confirmed without a time
                (8, 'org-a', 'arrival', 'confirmed', '2026-10-26T12:00:00Z'),
                (9, 'org-a', 'arrival', 'pending', null),
                (10, 'org-a', 'arrival', 'rejected', null),
                (11, 'org-b', 'arrival', 'confirmed', '2026-10-26T12:00:00Z'),   -- another tenant's arrival
                (12, 'org-a', 'arrival', 'confirmed', null),                     -- confirmed without a time
                (13, 'org-a', 'departure', 'confirmed', '2026-10-26T09:10:00Z'),
                (13, 'org-a', 'arrival', 'confirmed', '2026-10-26T13:00:00Z'),
                (14, 'org-a', 'departure', 'pending', null),
                (14, 'org-a', 'arrival', 'pending', null),
                (21, 'org-a', 'departure', 'confirmed', '2026-10-25T09:00:00Z'),
                (22, 'org-a', 'arrival', 'confirmed', '2026-10-25T12:00:00Z'),
                (23, 'org-b', 'departure', 'confirmed', '2026-10-26T07:00:00Z'),
                (23, 'org-b', 'arrival', 'confirmed', '2026-10-26T11:00:00Z');
            INSERT INTO miot_trips.trip_milestone (trip_id, tenant_code, milestone, status, confirmed_at)
            SELECT ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, tenant, milestone, status, at FROM m;

            CREATE TEMP TABLE s (n int, tenant text, type text, at timestamptz, versioned boolean, active boolean);
            INSERT INTO s VALUES
                (1, 'org-a', 'transit', '2026-10-26T09:00:00Z', false, true),
                (2, 'org-a', 'stop', '2026-10-26T09:30:00Z', false, true),
                -- 3, 4, 5, 14: preparation, loading and a superseded transit do not count; the earliest of the rest does
                (3, 'org-a', 'preparation', '2026-10-26T07:00:00Z', false, true),
                (3, 'org-a', 'loading', '2026-10-26T08:00:00Z', false, true),
                (3, 'org-a', 'transit', '2026-10-26T07:30:00Z', true, true),
                (3, 'org-a', 'transit', '2026-10-26T09:10:00Z', false, true),
                (3, 'org-a', 'stop', '2026-10-26T09:00:00Z', false, true),
                (4, 'org-a', 'loading', '2026-10-26T08:00:00Z', false, true),
                (4, 'org-a', 'stop', '2026-10-26T09:20:00Z', false, true),
                (5, 'org-a', 'transit', '2026-10-26T07:00:00Z', false, false),  -- inactive
                (5, 'org-a', 'transit', '2026-10-26T09:05:00Z', false, true),
                (5, 'org-a', 'stop', '2026-10-26T09:45:00Z', false, true),
                (6, 'org-a', 'transit', '2026-10-26T09:00:00Z', false, true),
                (6, 'org-b', 'transit', '2026-10-26T06:00:00Z', false, true),  -- another tenant's stage
                (7, 'org-a', 'transit', '2026-10-26T09:15:00Z', false, true),
                (14, 'org-a', 'transit', '2026-10-26T09:25:00Z', false, true),
                (15, 'org-a', 'preparation', '2026-10-26T09:00:00Z', false, true),  -- not started
                (15, 'org-a', 'loading', '2026-10-26T09:00:00Z', false, true),
                (16, 'org-a', 'transit', null, false, true),                   -- planned, not started
                (16, 'org-a', 'unloading', '2026-10-26T10:00:00Z', false, true),
                (21, 'org-a', 'transit', '2026-10-25T08:00:00Z', false, true),
                (22, 'org-a', 'stop', '2026-10-25T10:00:00Z', false, true),
                (23, 'org-b', 'transit', '2026-10-26T06:30:00Z', false, true);
            INSERT INTO miot_trips.stage (tenant_code, subject_type, subject_id, seq, stage_type, actual_start,
                                          version_of, is_active)
            SELECT tenant, 'trip', ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
                   row_number() OVER (), type, at, CASE WHEN versioned THEN gen_random_uuid() END, active
              FROM s;
            """;

    private static Vertx vertx;
    private static Pool pool;

    @BeforeAll
    static void migrate() throws IOException {
        vertx = Vertx.vertx();
        pool = PgBuilder.pool().connectingTo(PgConnectOptions.fromUri(System.getProperty(
                PgTripsStoresTest.URL_PROPERTY))).using(vertx).build();
        PgTripsStoresTest.recreateSchemas(pool);
        pool.query(DATASET).execute().await().atMost(WAIT);
    }

    @AfterAll
    static void close() {
        pool.close().await().atMost(WAIT);
        vertx.close().await().atMost(WAIT);
    }

    @Test
    void theViewReadsAsTheOldExpressionsBothWays() {
        assertTrue(rows("(" + NEW + ") EXCEPT (" + OLD + ")").isEmpty(), "in the view, not in the old expressions");
        assertTrue(rows("(" + OLD + ") EXCEPT (" + NEW + ")").isEmpty(), "in the old expressions, not in the view");
        assertEquals(23, rows(NEW).size(), "one row per trip row, every version, active or not");
    }

    @Test
    void theDatasetCoversTheBaselineCases() {
        assertEquals(at("2026-10-26T09:30:00Z"), departed(1), "a confirmed departure, a stage earlier");
        assertEquals(at("2026-10-26T09:00:00Z"), departed(2), "a confirmed departure, a stage later");
        assertEquals(at("2026-10-26T09:00:00Z"), departed(3), "pending: the earliest current transit or stop");
        assertEquals(at("2026-10-26T09:20:00Z"), departed(4), "rejected");
        assertEquals(at("2026-10-26T09:05:00Z"), departed(5), "missing, an inactive transit ignored");
        assertEquals(at("2026-10-26T09:00:00Z"), departed(6), "another tenant's departure and stage ignored");
        assertEquals(at("2026-10-26T09:15:00Z"), departed(7), "confirmed without a time");
        assertEquals(null, departed(15), "only preparation and loading");
        assertEquals(null, departed(16), "a transit not started, an unloading started");
        assertEquals(at("2026-10-25T09:00:00Z"), departed(21), "an old version");
        assertEquals(List.of(true, false, false, false, true), List.of(arrived(8), arrived(9), arrived(10),
                arrived(11), arrived(12)), "confirmed, pending, rejected, another tenant's, confirmed without a time");
    }

    private static OffsetDateTime at(String instant) {
        return OffsetDateTime.parse(instant);
    }

    private static Row progress(int n) {
        return rows(NEW + " WHERE trip_id = '00000000-0000-0000-0000-" + String.format("%012d", n) + "'").getFirst();
    }

    private static OffsetDateTime departed(int n) {
        OffsetDateTime departed = progress(n).getOffsetDateTime("departed_at");
        return departed == null ? null : departed.withOffsetSameInstant(java.time.ZoneOffset.UTC);
    }

    private static boolean arrived(int n) {
        return progress(n).getBoolean("arrived");
    }

    private static List<Row> rows(String sql) {
        RowSet<Row> set = pool.query(sql).execute().await().atMost(WAIT);
        List<Row> rows = new ArrayList<>();
        set.forEach(rows::add);
        return rows;
    }
}
