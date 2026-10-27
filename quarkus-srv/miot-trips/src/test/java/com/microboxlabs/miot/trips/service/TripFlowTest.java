package com.microboxlabs.miot.trips.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.trips.domain.Assignment;
import com.microboxlabs.miot.trips.domain.CargoUnit;
import com.microboxlabs.miot.trips.domain.Location;
import com.microboxlabs.miot.trips.domain.Mandate;
import com.microboxlabs.miot.trips.domain.Stage;
import com.microboxlabs.miot.trips.domain.Trip;
import com.microboxlabs.miot.trips.dto.AssignmentRequest;
import com.microboxlabs.miot.trips.dto.CargoRequest;
import com.microboxlabs.miot.trips.dto.MandateRequest;
import com.microboxlabs.miot.trips.dto.StageRequest;
import com.microboxlabs.miot.trips.dto.TripCargoRequest;
import com.microboxlabs.miot.trips.dto.TripRequest;
import com.microboxlabs.miot.trips.dto.TripView;
import com.microboxlabs.miot.core.fleet.FleetResources;
import com.microboxlabs.miot.trips.domain.TripLiveRow;
import com.microboxlabs.miot.trips.dto.LocationRequest;
import com.microboxlabs.miot.trips.store.InMemoryFleet;
import com.microboxlabs.miot.trips.store.FakeGeofences;
import com.microboxlabs.miot.trips.store.InMemoryTripsWorld;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** The whole tenant-A-style journey: mandate → cargo → trip → stages → done. */
class TripFlowTest {

    private static final String TENANT = "tenant-a";
    private static final String ACTOR = "feed:a";

    private final InMemoryTripsWorld world = new InMemoryTripsWorld();
    private final AuditService audit = new AuditService(world.auditStore);
    private final Transactions tx = Transactions.none();
    private final InMemoryFleet fleet = new InMemoryFleet();
    private final TripLiveProjector live = world.projector(fleet);
    private final MandateService mandates = new MandateService(world.mandateStore, audit, tx);
    private final CargoService cargo = new CargoService(world.cargoStore, mandates, live, audit, tx);
    private final TripService trips = new TripService(world.tripStore, world.stageStore,
            world.assignmentStore, world.tripCargoStore, world.cargoStore, mandates, live, audit, tx);
    private final StageService stages = new StageService(world.stageStore, world.tripStore,
            world.tripCargoStore, mandates, live, audit, tx);
    private final AssignmentService assignments = new AssignmentService(world.assignmentStore,
            world.tripStore, fleet, live, audit, tx);
    private final TripCargoService tripCargo = new TripCargoService(world.tripCargoStore, world.tripStore,
            world.cargoStore, world.stageStore, mandates, live, audit, tx);
    private final LocationService locations = new LocationService(world.locationStore, new FakeGeofences(),
            world.tripStore, live, audit, tx);

    /** A truck, trailer or driver id the fleet knows. */
    private String resource() {
        return fleet.add().toString();
    }

    @Test
    void aTripRunsItsStagesAndEverythingFollows() {
        // the mandate arrives from the feed, the shipper announces the cargo
        Mandate mandate = mandates.createOrGet(TENANT, ACTOR,
                new MandateRequest("SRV-900123", "service", null, null, null, null)).mandate();
        UUID mandateId = UUID.fromString(mandate.id());
        CargoUnit unit = cargo.announce(TENANT, ACTOR, mandateId,
                new CargoRequest("Fruta exportación", null, null, null, null, null));

        // the trip is planned with its stages; mounting the cargo links the mandate
        TripView created = trips.create(TENANT, ACTOR, new TripRequest(null, null, null, null, List.of(
                new StageRequest("loading", null, null, null, null, null),
                new StageRequest("transit", null, null, null, null, null),
                new StageRequest("unloading", null, null, null, null, null),
                new StageRequest("closing", null, null, null, null, null))));
        UUID tripId = UUID.fromString(created.id());
        List<Stage> plan = stages.listByTrip(TENANT, tripId);
        assertEquals(4, plan.size());

        UUID loadStage = UUID.fromString(plan.get(0).id());
        UUID unloadStage = UUID.fromString(plan.get(2).id());
        tripCargo.mount(TENANT, ACTOR, tripId, new TripCargoRequest(unit.id(),
                plan.get(0).id(), plan.get(2).id()));
        assertEquals(1, trips.mandatesOf(TENANT, tripId).size());

        // while its cargo rides on the trip, the mandate cannot be unlinked
        assertThrows(IllegalStateException.class,
                () -> trips.unlinkMandate(TENANT, ACTOR, tripId, mandateId));

        // resources go on with validity windows; ending one is the truck change
        Assignment truck = assignments.create(TENANT, ACTOR, tripId,
                new AssignmentRequest("truck", resource(), null, null));
        assignments.create(TENANT, ACTOR, tripId,
                new AssignmentRequest("driver", resource(), null, null));
        assignments.end(TENANT, ACTOR, UUID.fromString(truck.id()), null, "panne");
        UUID truckId = UUID.fromString(truck.id());
        assertThrows(IllegalStateException.class, () -> assignments.end(TENANT, ACTOR, truckId, null, null));
        assignments.create(TENANT, ACTOR, tripId,
                new AssignmentRequest("truck", resource(), null, "reemplazo"));
        assertEquals(3, assignments.listByTrip(TENANT, tripId).size());

        // starting the first stage IS the state change: trip and mandate in_progress
        stages.start(TENANT, ACTOR, loadStage);
        assertEquals(Trip.IN_PROGRESS, trips.get(TENANT, tripId).status());
        assertEquals(Mandate.RUNNING, mandates.get(TENANT, mandateId).status());
        UUID transitStage = UUID.fromString(plan.get(1).id());
        assertThrows(IllegalStateException.class, () -> stages.start(TENANT, ACTOR, transitStage));

        // closing the load stage picks the cargo up; closing the unload stage delivers it
        stages.close(TENANT, ACTOR, loadStage);
        assertEquals(CargoUnit.PICKED, cargo.get(TENANT, UUID.fromString(unit.id())).status());
        stages.start(TENANT, ACTOR, UUID.fromString(plan.get(1).id()));
        stages.close(TENANT, ACTOR, UUID.fromString(plan.get(1).id()));
        stages.start(TENANT, ACTOR, unloadStage);
        stages.close(TENANT, ACTOR, unloadStage);
        assertEquals(CargoUnit.DELIVERED, cargo.get(TENANT, UUID.fromString(unit.id())).status());

        // once picked up, the cargo cannot be unmounted
        UUID unitId = UUID.fromString(unit.id());
        assertThrows(IllegalStateException.class, () -> tripCargo.unmount(TENANT, ACTOR, tripId, unitId));

        // the closing stage realizes the trip, and only then the mandate can close
        assertThrows(IllegalStateException.class, () -> mandates.close(TENANT, ACTOR, mandateId));
        UUID closing = UUID.fromString(plan.get(3).id());
        stages.start(TENANT, ACTOR, closing);
        stages.close(TENANT, ACTOR, closing);
        Trip done = trips.get(TENANT, tripId);
        assertEquals(Trip.DONE, done.status());
        assertNotNull(done.actualEnd());
        assertEquals(Mandate.CLOSED, mandates.close(TENANT, ACTOR, mandateId).status());

        // the audit trail kept the story
        assertTrue(world.auditTrail().stream().anyMatch(e -> e.action().equals("stage.started")));
        assertTrue(world.auditTrail().stream().anyMatch(e -> e.action().equals("assignment.ended")));
    }

    @Test
    void cancellingATripNeedsAReasonAndClosesNothingElse() {
        Mandate mandate = mandates.createOrGet(TENANT, ACTOR,
                new MandateRequest("SRV-900200", "service", null, null, null, null)).mandate();
        TripView created = trips.create(TENANT, ACTOR,
                new TripRequest(null, null, null, List.of(mandate.id()), null));
        UUID tripId = UUID.fromString(created.id());

        assertThrows(IllegalArgumentException.class, () -> trips.cancel(TENANT, ACTOR, tripId, null));
        Trip cancelled = trips.cancel(TENANT, ACTOR, tripId, "cliente reprograma");
        assertEquals(Trip.CANCELLED, cancelled.status());
        assertThrows(IllegalStateException.class, () -> trips.cancel(TENANT, ACTOR, tripId, "de nuevo"));

        // with its only trip cancelled, the mandate can close
        assertEquals(Mandate.CLOSED,
                mandates.close(TENANT, ACTOR, UUID.fromString(mandate.id())).status());
    }

    @Test
    void aCancelledTripRunsNoStages() {
        TripView created = trips.create(TENANT, ACTOR, new TripRequest(null, null, null, null, List.of(
                new StageRequest("loading", null, null, null, null, null),
                new StageRequest("closing", null, null, null, null, null))));
        UUID tripId = UUID.fromString(created.id());
        List<Stage> plan = stages.listByTrip(TENANT, tripId);
        UUID load = UUID.fromString(plan.get(0).id());
        stages.start(TENANT, ACTOR, load);
        trips.cancel(TENANT, ACTOR, tripId, "cliente anula");

        assertThrows(IllegalStateException.class, () -> stages.close(TENANT, ACTOR, load));
        UUID closing = UUID.fromString(plan.get(1).id());
        assertThrows(IllegalStateException.class, () -> stages.start(TENANT, ACTOR, closing));
    }

    @Test
    void cargoLoadsOnlyAtStagesOfItsOwnTrip() {
        Mandate mandate = mandates.createOrGet(TENANT, ACTOR,
                new MandateRequest("SRV-900300", "service", null, null, null, null)).mandate();
        CargoUnit unit = cargo.announce(TENANT, ACTOR, UUID.fromString(mandate.id()),
                new CargoRequest("Fruta", null, null, null, null, null));
        UUID tripA = UUID.fromString(trips.create(TENANT, ACTOR, new TripRequest(null, null, null, null,
                List.of(new StageRequest("loading", null, null, null, null, null)))).id());
        UUID tripB = UUID.fromString(trips.create(TENANT, ACTOR, new TripRequest(null, null, null, null,
                List.of(new StageRequest("loading", null, null, null, null, null)))).id());
        String stageOfB = stages.listByTrip(TENANT, tripB).get(0).id();

        TripCargoRequest atStageOfB = new TripCargoRequest(unit.id(), stageOfB, null);
        assertThrows(IllegalArgumentException.class, () -> tripCargo.mount(TENANT, ACTOR, tripA, atStageOfB));
        TripCargoRequest badStage = new TripCargoRequest(unit.id(), "not-a-uuid", null);
        assertThrows(IllegalArgumentException.class, () -> tripCargo.mount(TENANT, ACTOR, tripA, badStage));
        assertTrue(trips.mandatesOf(TENANT, tripA).isEmpty(), "a refused mount links no mandate");
    }

    @Test
    void badIdsAndWindowsAreRejected() {
        TripRequest badOrigin = new TripRequest("not-a-uuid", null, null, null, null);
        assertThrows(IllegalArgumentException.class, () -> trips.create(TENANT, ACTOR, badOrigin));
        TripRequest badPlan = new TripRequest(null, null, null, null, List.of(
                new StageRequest("loading", null, null, null, null, null),
                new StageRequest("volar", null, null, null, null, null)));
        assertThrows(IllegalArgumentException.class, () -> trips.create(TENANT, ACTOR, badPlan));
        assertTrue(trips.list(TENANT, TripService.filter(null, null, null, null, null), 0, 50).isEmpty(),
                "a refused plan writes no trip");
        UUID missing = UUID.randomUUID();
        assertThrows(NoSuchElementException.class, () -> stages.listByTrip(TENANT, missing));
        assertThrows(NoSuchElementException.class, () -> assignments.listByTrip(TENANT, missing));
        assertThrows(NoSuchElementException.class, () -> stages.listActivities(TENANT, missing));
        UUID tripId = UUID.fromString(trips.create(TENANT, ACTOR,
                new TripRequest(null, null, null, null, null)).id());
        Assignment truck = assignments.create(TENANT, ACTOR, tripId,
                new AssignmentRequest("truck", resource(), null, null));
        UUID truckId = UUID.fromString(truck.id());
        OffsetDateTime beforeStart = truck.validFrom().minusHours(1);
        assertThrows(IllegalArgumentException.class,
                () -> assignments.end(TENANT, ACTOR, truckId, beforeStart, null));
        AssignmentRequest tomorrow = new AssignmentRequest("truck", resource(),
                OffsetDateTime.now().plusDays(1), "reemplazo de mañana");
        assertThrows(IllegalArgumentException.class, () -> assignments.create(TENANT, ACTOR, tripId, tomorrow));
    }

    @Test
    void anAssignmentNeedsAResourceTheFleetKnows() {
        UUID tripId = UUID.fromString(trips.create(TENANT, ACTOR,
                new TripRequest(null, null, null, null, null)).id());
        AssignmentRequest ghost = new AssignmentRequest("truck", UUID.randomUUID().toString(), null, null);
        IllegalArgumentException refused = assertThrows(IllegalArgumentException.class,
                () -> assignments.create(TENANT, ACTOR, tripId, ghost));
        assertTrue(refused.getMessage().contains("does not exist"), refused.getMessage());
        assertTrue(assignments.listByTrip(TENANT, tripId).isEmpty());
    }

    @Test
    void aCancelledMandateTakesNoNewTrip() {
        Mandate mandate = mandates.createOrGet(TENANT, ACTOR,
                new MandateRequest("SRV-CANCEL", "service", null, null, null, null)).mandate();
        UUID mandateId = UUID.fromString(mandate.id());
        CargoUnit unit = cargo.announce(TENANT, ACTOR, mandateId,
                new CargoRequest("Carga", null, null, null, null, null));
        mandates.cancel(TENANT, ACTOR, mandateId, "cliente anula");

        TripRequest withMandate = new TripRequest(null, null, null, List.of(mandate.id()), null);
        assertThrows(IllegalStateException.class, () -> trips.create(TENANT, ACTOR, withMandate));
        UUID tripId = UUID.fromString(trips.create(TENANT, ACTOR,
                new TripRequest(null, null, null, null, null)).id());
        String cancelled = mandate.id();
        IllegalStateException link = assertThrows(IllegalStateException.class,
                () -> trips.linkMandate(TENANT, ACTOR, tripId, cancelled, null, null));
        assertTrue(link.getMessage().contains("cancelled"), link.getMessage());
        TripCargoRequest mount = new TripCargoRequest(unit.id(), null, null);
        assertThrows(IllegalStateException.class, () -> tripCargo.mount(TENANT, ACTOR, tripId, mount));
        String unknown = UUID.randomUUID().toString();
        assertThrows(IllegalArgumentException.class,
                () -> trips.linkMandate(TENANT, ACTOR, tripId, unknown, null, null));
        assertTrue(trips.mandatesOf(TENANT, tripId).isEmpty());

        String later = mandates.createOrGet(TENANT, ACTOR,
                new MandateRequest("SRV-LATER", "service", null, null, null, null)).mandate().id();
        assertTrue(trips.linkMandate(TENANT, ACTOR, tripId, later, null, null));
        mandates.cancel(TENANT, ACTOR, UUID.fromString(later), "cliente anula");
        assertFalse(trips.linkMandate(TENANT, ACTOR, tripId, later, null, null),
                "re-linking an existing link is a no-op, even once the mandate is cancelled");
    }

    @Test
    void theBoardShowsWhatTheTripRecordSays() {
        Mandate mandate = mandates.createOrGet(TENANT, ACTOR,
                new MandateRequest("SRV-BOARD", "service", null, null, null, null)).mandate();
        CargoUnit unit = cargo.announce(TENANT, ACTOR, UUID.fromString(mandate.id()),
                new CargoRequest("Fruta", null, null, null, null, null));
        Location origin = locations.create(TENANT, ACTOR, new LocationRequest("Bodega Norte", "distribution_center", null, null));
        UUID tripId = UUID.fromString(trips.create(TENANT, ACTOR, new TripRequest(origin.id(), null, null, null,
                List.of(new StageRequest("loading", null, null, null, null, null)))).id());
        assertEquals("Bodega Norte", board(tripId).originGeofenceLabel());
        assertEquals(Trip.PLANNED, board(tripId).status());

        UUID carrierId = UUID.randomUUID();
        fleet.add(new FleetResources.Carrier(carrierId, "Transportes Sur", "+56220000000"));
        String truck = fleet.add(new FleetResources.Vehicle("AAAA11", carrierId)).toString();
        String trailer = fleet.add(new FleetResources.Vehicle("CCCC33", null)).toString();
        String ana = fleet.add(new FleetResources.Driver("1-9", "Ana Rojas", "+56900000001")).toString();
        String luis = fleet.add(new FleetResources.Driver("2-7", "Luis Soto", null)).toString();
        assignments.create(TENANT, ACTOR, tripId, new AssignmentRequest("truck", truck, null, null));
        assignments.create(TENANT, ACTOR, tripId, new AssignmentRequest("trailer", trailer, null, null));
        assignments.create(TENANT, ACTOR, tripId, new AssignmentRequest("driver", ana, null, null));
        assignments.create(TENANT, ACTOR, tripId, new AssignmentRequest("driver", luis, null, null));
        tripCargo.mount(TENANT, ACTOR, tripId, new TripCargoRequest(unit.id(), null, null));

        TripLiveRow row = board(tripId);
        assertEquals("AAAA11", row.assetId());
        assertEquals("CCCC33", row.ramplaPlate());
        assertEquals(carrierId.toString(), row.carrierId());
        assertEquals("Transportes Sur", row.carrierName());
        assertEquals("Ana Rojas", row.driverName());
        assertTrue(row.doubleDriver());
        assertEquals("Luis Soto", row.secondDriverName());
        assertEquals("Fruta", row.typeLoad());
        assertTrue(row.mandateCodes().contains("SRV-BOARD"), row.mandateCodes());

        locations.update(TENANT, ACTOR, UUID.fromString(origin.id()),
                new LocationRequest("Bodega Norte 2", null, null, null));
        assertEquals("Bodega Norte 2", board(tripId).originGeofenceLabel());
        cargo.update(TENANT, ACTOR, UUID.fromString(unit.id()),
                new CargoRequest("Fruta fresca", null, null, null, null, null));
        assertEquals("Fruta fresca", board(tripId).typeLoad());

        trips.cancel(TENANT, ACTOR, tripId, "cliente anula");
        assertTrue(world.tripLiveStore.find(TENANT, tripId).isEmpty(), "a cancelled trip leaves the board");
    }

    private TripLiveRow board(UUID tripId) {
        return world.tripLiveStore.find(TENANT, tripId).orElseThrow();
    }
}
