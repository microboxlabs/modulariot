package com.microboxlabs.miot.trips.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.fleet.FleetResources.DriverDetails;
import com.microboxlabs.miot.core.trips.TripDrivers.Assigned;
import com.microboxlabs.miot.fleet.resources.domain.Carrier;
import com.microboxlabs.miot.fleet.resources.domain.Driver;
import com.microboxlabs.miot.fleet.resources.service.FleetResourcesService;
import com.microboxlabs.miot.fleet.resources.store.PgResourceStore;
import com.microboxlabs.miot.trips.domain.Assignment;
import com.microboxlabs.miot.trips.domain.Trip;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgConnectOptions;
import java.io.IOException;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/**
 * The trip drivers and fleet driver details read by the contact book sync, against a real database. Skipped unless
 * {@code -Dmiot.trips.test.pg-url=...} is set, as {@link PgTripsStoresTest}.
 */
@EnabledIfSystemProperty(named = PgTripsStoresTest.URL_PROPERTY, matches = ".+")
class PgTripDriversTest {

    private static final Duration WAIT = Duration.ofSeconds(10);
    private static final String ACTOR = "test";

    private static Vertx vertx;
    private static Pool pool;

    private final PgTripStore trips = new PgTripStore(() -> pool);
    private final PgAssignmentStore assignments = new PgAssignmentStore(() -> pool);
    private final PgResourceStore resources = new PgResourceStore(() -> pool);
    private final PgTripDrivers tripDrivers = new PgTripDrivers(() -> pool);
    private final FleetResourcesService fleet = new FleetResourcesService(resources);

    @BeforeAll
    static void migrate() throws IOException {
        vertx = Vertx.vertx();
        pool = PgBuilder.pool().connectingTo(PgConnectOptions.fromUri(System.getProperty(PgTripsStoresTest.URL_PROPERTY)))
                .using(vertx).build();
        PgTripsStoresTest.recreateSchemas(pool);
    }

    @AfterAll
    static void close() {
        pool.close().await().atMost(WAIT);
        vertx.close().await().atMost(WAIT);
    }

    private static String tenant() {
        return "t-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private Carrier carrier(String tenant, String rut, String name) {
        return resources.insertCarrier(new Carrier(null, tenant, null, rut, name, null, null, null, null, null,
                Carrier.ACTIVE, false, null, null, null, ACTOR, null, ACTOR));
    }

    private Driver driver(String tenant, String carrierId, String rut, String name, String phone, String mobile,
            String status) {
        return resources.insertDriver(new Driver(null, tenant, carrierId, null, rut, "Primero", "Apellido", name,
                phone, mobile, null, null, status, false, null, null, null, ACTOR, null, ACTOR));
    }

    private void assign(String tenant, Driver driver, OffsetDateTime at) {
        Trip trip = trips.insert(new Trip(null, tenant, Trip.PLANNED, null, null, null, null, null, null, null,
                ACTOR, null, ACTOR));
        Assignment a = assignments.insert(new Assignment(null, tenant, trip.id(), Assignment.DRIVER, driver.id(),
                at, null, null, null, ACTOR, null, ACTOR));
        pool.preparedQuery("UPDATE miot_trips.trip_resource_assignment SET created_at = $2 WHERE id = $1")
                .execute(Tuple.of(UUID.fromString(a.id()), at)).await().atMost(WAIT);
    }

    @Test
    void eachDriverComesOnceAtItsLatestAssignmentAndPagesDoNotSkipTies() {
        String tenant = tenant();
        String other = tenant();
        OffsetDateTime t0 = OffsetDateTime.now(ZoneOffset.UTC).minusDays(10).withNano(0);
        Carrier c = carrier(tenant, "76111222-3", "Transportes Uno");
        Driver old = driver(tenant, c.id(), "11111111-1", "Viejo", null, null, Carrier.ACTIVE);
        Driver a = driver(tenant, c.id(), "22222222-2", "A", null, null, Carrier.ACTIVE);
        Driver b = driver(tenant, c.id(), "33333333-3", "B", null, null, Carrier.ACTIVE);
        Driver d = driver(tenant, c.id(), "44444444-4", "D", null, null, Carrier.ACTIVE);
        Driver elsewhere = driver(other, null, "55555555-5", "Otro", null, null, Carrier.ACTIVE);
        assign(tenant, old, t0.minusDays(40));
        assign(tenant, a, t0.plusHours(1));
        assign(tenant, a, t0.plusHours(5));
        assign(tenant, b, t0.plusHours(5));
        assign(tenant, d, t0.plusHours(5));
        assign(other, elsewhere, t0.plusHours(2));

        List<String> tenants = tripDrivers.tenantsAssigningDrivers(t0);
        assertTrue(tenants.contains(tenant) && tenants.contains(other));
        assertFalse(tripDrivers.tenantsAssigningDrivers(t0.plusHours(6)).contains(tenant));

        List<Assigned> first = tripDrivers.driversAssignedSince(tenant, t0, null, 2);
        assertEquals(2, first.size());
        Assigned last = first.get(1);
        List<Assigned> rest = tripDrivers.driversAssignedSince(tenant, last.assignedAt(), last.driverId(), 10);
        List<UUID> all = new java.util.ArrayList<>(first.stream().map(Assigned::driverId).toList());
        all.addAll(rest.stream().map(Assigned::driverId).toList());

        assertEquals(3, all.size(), "a, b and d once each, not the old one nor the other tenant's: " + all);
        assertTrue(all.containsAll(List.of(UUID.fromString(a.id()), UUID.fromString(b.id()),
                UUID.fromString(d.id()))));
        assertEquals(t0.plusHours(5).toInstant(), first.get(0).assignedAt().toInstant(),
                "a driver is at its latest assignment");
    }

    @Test
    void driverDetailsCarryTheCarrierAndTheMobilePhoneFirst() {
        String tenant = tenant();
        Carrier c = carrier(tenant, "76.111.222-3", "Transportes Dos");
        Driver mobile = driver(tenant, c.id(), "11.111.111-1", "Con Móvil", "221234567", "912345678",
                Carrier.ACTIVE);
        Driver fixed = driver(tenant, null, "22.222.222-2", null, "569 8765 4321", " ", Carrier.INACTIVE);

        List<DriverDetails> found = fleet.drivers(tenant, List.of(UUID.fromString(mobile.id()),
                UUID.fromString(fixed.id()), UUID.randomUUID()));
        DriverDetails m = found.stream().filter(x -> x.id().toString().equals(mobile.id())).findFirst().orElseThrow();
        DriverDetails f = found.stream().filter(x -> x.id().toString().equals(fixed.id())).findFirst().orElseThrow();

        assertEquals(2, found.size());
        assertEquals("912345678", m.phone());
        assertEquals("Con Móvil", m.fullName());
        assertEquals("Transportes Dos", m.carrierLegalName());
        assertEquals("76.111.222-3", m.carrierTaxId());
        assertTrue(m.active());
        assertEquals("569 8765 4321", f.phone(), "a blank mobile phone falls back to the phone");
        assertEquals("Primero Apellido", f.fullName(), "no full name: first and last name");
        assertNull(f.carrierLegalName());
        assertFalse(f.active());
        assertTrue(fleet.drivers(tenant(), List.of(UUID.fromString(mobile.id()))).isEmpty(),
                "another tenant does not see it");
    }

    @Test
    void changedDriversArePagedByUpdateTime() {
        String tenant = tenant();
        Driver x = driver(tenant, null, "11111111-1", "X", null, null, Carrier.ACTIVE);
        Driver y = driver(tenant, null, "22222222-2", "Y", null, null, Carrier.ACTIVE);
        OffsetDateTime before = OffsetDateTime.now(ZoneOffset.UTC);
        resources.updateDriver(new Driver(y.id(), tenant, null, null, y.rut(), null, null, "Y Cambiado", null,
                "987654321", null, null, Carrier.INACTIVE, false, null, null, null, ACTOR, null, ACTOR));

        List<DriverDetails> changed = fleet.driversChangedSince(tenant, before, null, 10);

        assertEquals(1, changed.size(), "x did not change, and y's archived version is not listed");
        assertEquals("Y Cambiado", changed.get(0).fullName());
        assertFalse(changed.get(0).active());
        DriverDetails last = changed.get(0);
        assertTrue(fleet.driversChangedSince(tenant, last.updatedAt(), last.id(), 10).isEmpty());
    }
}
