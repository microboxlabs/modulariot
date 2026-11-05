package com.microboxlabs.miot.symptoms.map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgConnection;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgConnectOptions;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/** Runs the production query on native PostgreSQL, using only connection-local temporary tables. */
@EnabledIfSystemProperty(named = PgTreatmentReadsTest.URL_PROPERTY, matches = ".+")
class PgTripWindowsTest {

    private static final Duration WAIT = Duration.ofSeconds(10);
    private static final UUID LOADING = new UUID(0, 1);
    private static final UUID DEPARTED = new UUID(0, 2);
    private static final UUID TRANSIT = new UUID(0, 3);
    private static Vertx vertx;
    private static PgConnection connection;

    @BeforeAll
    static void setUp() {
        vertx = Vertx.vertx();
        connection = PgConnection.connect(vertx, PgConnectOptions.fromUri(System.getProperty(
                PgTreatmentReadsTest.URL_PROPERTY))).await().atMost(WAIT);
        run("CREATE TEMP TABLE trip (id uuid, tenant_code text, actual_start timestamptz, actual_end timestamptz, "
                + "version_of uuid, is_active boolean DEFAULT true)");
        run("CREATE TEMP TABLE trip_milestone (trip_id uuid, tenant_code text, milestone text, status text, "
                + "confirmed_at timestamptz)");
        run("CREATE TEMP TABLE stage (subject_id uuid, tenant_code text, subject_type text, stage_type text, "
                + "actual_start timestamptz, version_of uuid, is_active boolean DEFAULT true)");
        run("CREATE TEMP TABLE trip_resource_assignment (trip_id uuid, tenant_code text, resource_id text, "
                + "resource_type text, version_of uuid, is_active boolean DEFAULT true)");
        run("CREATE TEMP TABLE truck (id uuid, tenant_code text, license_plate text, version_of uuid)");
        run("""
                INSERT INTO pg_temp.trip (id, tenant_code, actual_start)
                SELECT id, 'org-a', '2026-10-26T09:00:00Z'::timestamptz
                  FROM unnest(ARRAY['00000000-0000-0000-0000-000000000001',
                                    '00000000-0000-0000-0000-000000000002',
                                    '00000000-0000-0000-0000-000000000003']::uuid[]) id;
                INSERT INTO pg_temp.truck VALUES ('00000000-0000-0000-0000-000000000010', 'org-a', 'AB12', null);
                INSERT INTO pg_temp.trip_resource_assignment (trip_id, tenant_code, resource_id, resource_type)
                SELECT id, tenant_code, '00000000-0000-0000-0000-000000000010', 'truck' FROM pg_temp.trip;
                INSERT INTO pg_temp.trip_milestone VALUES
                    ('00000000-0000-0000-0000-000000000001', 'org-a', 'departure', 'pending', null),
                    ('00000000-0000-0000-0000-000000000002', 'org-a', 'departure', 'confirmed', '2026-10-26T10:30:00Z');
                INSERT INTO pg_temp.stage (subject_id, tenant_code, subject_type, stage_type, actual_start)
                SELECT id, tenant_code, 'trip', 'loading', actual_start FROM pg_temp.trip;
                INSERT INTO pg_temp.stage (subject_id, tenant_code, subject_type, stage_type, actual_start)
                SELECT id, tenant_code, 'trip', 'transit', '2026-10-26T10:00:00Z'::timestamptz
                  FROM pg_temp.trip WHERE id <> '00000000-0000-0000-0000-000000000001';
                INSERT INTO pg_temp.stage VALUES
                    ('00000000-0000-0000-0000-000000000003', 'org-a', 'trip', 'transit', '2026-10-26T08:00:00Z',
                     '00000000-0000-0000-0000-000000000099', true),
                    ('00000000-0000-0000-0000-000000000003', 'org-a', 'trip', 'transit', '2026-10-26T07:00:00Z',
                     null, false),
                    ('00000000-0000-0000-0000-000000000003', 'org-b', 'trip', 'transit', '2026-10-26T06:00:00Z',
                     null, true)
                """);
    }

    @AfterAll
    static void tearDown() {
        if (connection != null) {
            connection.close().await().atMost(WAIT);
        }
        if (vertx != null) {
            vertx.close().await().atMost(WAIT);
        }
    }

    private static void run(String sql) {
        connection.query(sql).execute().await().atMost(WAIT);
    }

    private static Optional<Row> find(String tenant, UUID trip, String asset) {
        String sql = TripWindows.TRIP.replace("miot_trips.", "pg_temp.").replace("miot_fleet.", "pg_temp.");
        var rows = connection.preparedQuery(sql).execute(Tuple.of(tenant, trip, asset))
                .await().atMost(WAIT).iterator();
        return rows.hasNext() ? Optional.of(rows.next()) : Optional.empty();
    }

    @Test
    void loadingHasNoDepartureEvenAfterTheTripStarted() {
        assertNull(find("org-a", LOADING, "AB12").orElseThrow().getOffsetDateTime("actual_start"));
    }

    @Test
    void theConfirmedDepartureTakesPriorityOverAStage() {
        assertEquals(Instant.parse("2026-10-26T10:30:00Z"),
                find("org-a", DEPARTED, "AB12").orElseThrow().getOffsetDateTime("actual_start").toInstant());
    }

    @Test
    void otherwiseOnlyACurrentActiveTransitOrStopStartsTheRange() {
        assertEquals(Instant.parse("2026-10-26T10:00:00Z"),
                find("org-a", TRANSIT, "AB12").orElseThrow().getOffsetDateTime("actual_start").toInstant());
    }

    @Test
    void theTripAndTruckMustBelongToTheTenant() {
        assertTrue(find("org-b", DEPARTED, "AB12").isEmpty());
        assertTrue(find("org-a", DEPARTED, "ZZ99").isEmpty());
    }
}
