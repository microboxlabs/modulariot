package com.microboxlabs.miot.symptoms.signal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgConnectOptions;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/** Historical device-event membership in the supplied scratch database; recreates trips and fleet schemas. */
@EnabledIfSystemProperty(named = "miot.symptoms.test.pg-url", matches = ".+")
class PgHistoricalDeviceTripsTest {
    private static final Duration WAIT = Duration.ofSeconds(10);
    private static Vertx vertx;
    private static Pool pool;

    @BeforeAll
    static void create() {
        vertx = Vertx.vertx();
        pool = PgBuilder.pool().connectingTo(PgConnectOptions.fromUri(System.getProperty("miot.symptoms.test.pg-url")))
                .using(vertx).build();
        pool.query("""
                DROP SCHEMA IF EXISTS miot_trips CASCADE;
                DROP SCHEMA IF EXISTS miot_fleet CASCADE;
                CREATE SCHEMA miot_trips; CREATE SCHEMA miot_fleet;
                CREATE TABLE miot_fleet.truck (id uuid PRIMARY KEY, tenant_code text, license_plate text);
                CREATE TABLE miot_trips.trip (id uuid PRIMARY KEY, tenant_code text, status text,
                    actual_start timestamptz, actual_end timestamptz, updated_at timestamptz);
                CREATE TABLE miot_trips.trip_resource_assignment (tenant_code text, trip_id uuid,
                    resource_id uuid, resource_type text, valid_from timestamptz, valid_to timestamptz,
                    version_of uuid, is_active boolean DEFAULT true);
                CREATE TABLE miot_trips.trip_live (trip_id uuid, tenant_code text, asset_id text,
                    trip_type text, status text, end_time timestamptz, double_driver boolean,
                    estimated_arrival_time timestamptz, mandate_codes jsonb,
                    origin_geofence_id integer, origin_geofence_label text, origin_visited boolean,
                    origin_is_internal boolean, destination_geofence_id integer, destination_geofence_label text,
                    destination_visited boolean, current_geofence_id integer, carrier_id text, carrier_name text,
                    type_load text, rampla_plate text, driver_id text);
                CREATE TABLE miot_trips.trip_milestone (tenant_code text, trip_id uuid, milestone text,
                    status text, confirmed_at timestamptz);
                CREATE TABLE miot_trips.stage (tenant_code text, subject_type text, subject_id uuid,
                    stage_type text, actual_start timestamptz, version_of uuid, is_active boolean);
                CREATE TABLE miot_fleet.carrier (tenant_code text, id uuid, rut text);
                CREATE TABLE miot_fleet.driver (tenant_code text, id uuid, rut text, status text, license_expires date,
                    version_of uuid, is_active boolean);
                """).execute().await().atMost(WAIT);
    }

    @AfterAll
    static void close() {
        try {
            pool.query("DROP SCHEMA miot_trips CASCADE; DROP SCHEMA miot_fleet CASCADE").execute().await().atMost(WAIT);
        } finally {
            pool.close().await().atMost(WAIT);
            vertx.close().await().atMost(WAIT);
        }
    }

    @Test
    void theLiveTripsQueryPreservesANullTripType() {
        UUID trip = UUID.randomUUID();
        pool.preparedQuery("""
                INSERT INTO miot_trips.trip_live (trip_id, tenant_code, asset_id, trip_type, status)
                VALUES ($1, 'tenant-demo', 'vehicle-null-type', NULL, 'in_progress')
                """).execute(Tuple.of(trip)).await().atMost(WAIT);
        var rows = new DeviceEvents.PgTrips(() -> pool).of("tenant-demo", "vehicle-null-type");
        assertEquals(1, rows.size());
        assertNull(rows.getFirst().tripType());
        assertEquals(1, rows.getFirst().priority());
    }

    @Test
    void aBufferedDeviceEventUsesItsTripAndTruckAtOccurrenceTimeWithoutALiveProjection() {
        Instant start = Instant.parse("2026-01-01T00:00:00Z");
        var a = start.atOffset(ZoneOffset.UTC);
        var b = start.plusSeconds(600).atOffset(ZoneOffset.UTC);
        UUID truck = UUID.randomUUID();
        UUID trip = UUID.randomUUID();
        pool.preparedQuery("INSERT INTO miot_fleet.truck VALUES ($1, 'tenant-demo', 'vehicle-demo')")
                .execute(Tuple.of(truck)).await().atMost(WAIT);
        pool.preparedQuery("INSERT INTO miot_trips.trip VALUES ($1, 'tenant-demo', 'completed', $2, $3, $3)")
                .execute(Tuple.of(trip, a, b)).await().atMost(WAIT);
        pool.preparedQuery("""
                INSERT INTO miot_trips.trip_resource_assignment
                    (tenant_code, trip_id, resource_id, resource_type, valid_from, valid_to)
                VALUES ('tenant-demo', $1, $2, 'truck', $3, $4)
                """).execute(Tuple.of(trip, truck, a, b)).await().atMost(WAIT);
        var trips = new DeviceEvents.PgTrips(() -> pool);
        var during = trips.at("tenant-demo", "vehicle-demo", start.plusSeconds(300));
        assertEquals(1, during.size());
        assertEquals(trip.toString(), during.get(0).tripId());
        assertTrue(trips.at("tenant-demo", "vehicle-demo", start.plusSeconds(601)).isEmpty());
        assertTrue(trips.at("tenant-other", "vehicle-demo", start.plusSeconds(300)).isEmpty());
    }

    @Test
    void aLiveProjectionCannotAssociateAnEventFromBeforeTheTruckAssignmentOrAfterTripEnd() {
        Instant start = Instant.parse("2026-01-01T00:00:00Z");
        UUID truck = UUID.randomUUID();
        UUID trip = UUID.randomUUID();
        pool.preparedQuery("INSERT INTO miot_fleet.truck VALUES ($1, 'tenant-demo', 'vehicle-moved-demo')")
                .execute(Tuple.of(truck)).await().atMost(WAIT);
        pool.preparedQuery("INSERT INTO miot_trips.trip VALUES ($1, 'tenant-demo', 'in_progress', $2, NULL, $2)")
                .execute(Tuple.of(trip, start.atOffset(ZoneOffset.UTC))).await().atMost(WAIT);
        pool.preparedQuery("""
                INSERT INTO miot_trips.trip_resource_assignment
                    (tenant_code, trip_id, resource_id, resource_type, valid_from)
                VALUES ('tenant-demo', $1, $2, 'truck', $3)
                """).execute(Tuple.of(trip, truck, start.plusSeconds(600).atOffset(ZoneOffset.UTC)))
                .await().atMost(WAIT);
        pool.preparedQuery("""
                INSERT INTO miot_trips.trip_milestone VALUES ('tenant-demo', $1, 'departure', 'confirmed', $2)
                """).execute(Tuple.of(trip, start.atOffset(ZoneOffset.UTC))).await().atMost(WAIT);
        pool.preparedQuery("""
                INSERT INTO miot_trips.trip_live (trip_id, tenant_code, asset_id, trip_type, status, mandate_codes)
                VALUES ($1, 'tenant-demo', 'vehicle-moved-demo', 'v', 'in_progress', '[{"code":"TRIP-DEMO"}]')
                """).execute(Tuple.of(trip)).await().atMost(WAIT);
        var trips = new DeviceEvents.PgTrips(() -> pool);
        assertTrue(trips.of("tenant-demo", "vehicle-moved-demo").getFirst().inProgressAt(start.plusSeconds(300)));
        assertTrue(trips.at("tenant-demo", "vehicle-moved-demo", start.plusSeconds(300)).isEmpty(),
                "the current projection cannot prove membership before this truck was assigned");
        var during = trips.at("tenant-demo", "vehicle-moved-demo", start.plusSeconds(601));
        assertEquals(trip.toString(), during.getFirst().tripId());
        assertEquals("TRIP-DEMO", during.getFirst().details().code(), "eligible live metadata is retained");
        pool.preparedQuery("UPDATE miot_trips.trip SET status = 'completed', actual_end = $2 WHERE id = $1")
                .execute(Tuple.of(trip, start.plusSeconds(900).atOffset(ZoneOffset.UTC))).await().atMost(WAIT);
        assertTrue(trips.at("tenant-demo", "vehicle-moved-demo", start.plusSeconds(901)).isEmpty(),
                "a stale live projection cannot associate an event after the trip ended");
    }
}
