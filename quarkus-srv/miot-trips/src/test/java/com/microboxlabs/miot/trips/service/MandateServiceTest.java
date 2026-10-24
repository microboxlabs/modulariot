package com.microboxlabs.miot.trips.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.trips.domain.Mandate;
import com.microboxlabs.miot.trips.domain.Trip;
import com.microboxlabs.miot.trips.dto.MandateRequest;
import com.microboxlabs.miot.trips.dto.TripRequest;
import com.microboxlabs.miot.trips.store.InMemoryFleet;
import com.microboxlabs.miot.trips.store.InMemoryTripsWorld;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MandateServiceTest {

    private static final String TENANT = "tenant-b";
    private static final String ACTOR = "feed:b";

    private final InMemoryTripsWorld world = new InMemoryTripsWorld();
    private final AuditService audit = new AuditService(world.auditStore);
    private final Transactions tx = Transactions.none();
    private final MandateService service = new MandateService(world.mandateStore, audit, tx);

    private static MandateRequest request(String code) {
        return new MandateRequest(code, "oc", "OC-REF", null, null, null);
    }

    @Test
    void createIsCreateOrReturnByCode() {
        MandateService.CreateOrGet first = service.createOrGet(TENANT, ACTOR, request("OC-1001"));
        MandateService.CreateOrGet again = service.createOrGet(TENANT, ACTOR, request("OC-1001"));

        assertTrue(first.created());
        assertFalse(again.created());
        assertEquals(first.mandate().id(), again.mandate().id());
        assertEquals(Mandate.ACTIVE, first.mandate().status());
        // the auto line (the trigger) is there for cargo to hang from
        assertNotNull(service.lineOf(TENANT, UUID.fromString(first.mandate().id())));
        // only the real creation audits
        assertEquals(1, world.auditTrail().stream().filter(e -> e.action().equals("mandate.created")).count());
    }

    @Test
    void theCodeIsRequiredAndScopedByTenant() {
        MandateRequest blank = request(" ");
        assertThrows(IllegalArgumentException.class, () -> service.createOrGet(TENANT, ACTOR, blank));
        MandateService.CreateOrGet tenantB = service.createOrGet(TENANT, ACTOR, request("OC-77"));
        MandateService.CreateOrGet tenantA = service.createOrGet("tenant-a", "feed:a", request("OC-77"));
        assertTrue(tenantB.created() && tenantA.created());
    }

    @Test
    void closingWaitsForEveryTripToEnd() {
        Mandate mandate = service.createOrGet(TENANT, ACTOR, request("OC-2001")).mandate();
        UUID mandateId = UUID.fromString(mandate.id());
        TripService trips = new TripService(world.tripStore, world.stageStore, world.assignmentStore,
                world.tripCargoStore, world.cargoStore, service, world.projector(new InMemoryFleet()), audit, tx);
        trips.create(TENANT, ACTOR, new TripRequest(null, null, null, List.of(mandate.id()), null));

        IllegalStateException open = assertThrows(IllegalStateException.class,
                () -> service.close(TENANT, ACTOR, mandateId));
        assertTrue(open.getMessage().contains("not yet realized"));

        String tripId = world.mandateStore.tripsOf(TENANT, mandateId).get(0).tripId();
        Trip t = world.tripStore.find(TENANT, UUID.fromString(tripId)).orElseThrow();
        world.tripStore.update(new Trip(t.id(), TENANT, Trip.DONE, t.originId(), t.destinationId(),
                t.plannedStart(), t.actualStart(), t.actualEnd(), t.cancelReason(), t.createdAt(),
                t.createdBy(), null, ACTOR));

        assertEquals(Mandate.CLOSED, service.close(TENANT, ACTOR, mandateId).status());
        assertThrows(IllegalStateException.class, () -> service.close(TENANT, ACTOR, mandateId));
    }

    @Test
    void cancellingNeedsAReasonAndPatchKeepsWhatIsNotSent() {
        Mandate mandate = service.createOrGet(TENANT, ACTOR, request("OC-3001")).mandate();
        UUID id = UUID.fromString(mandate.id());

        assertThrows(IllegalArgumentException.class, () -> service.cancel(TENANT, ACTOR, id, " "));

        Mandate patched = service.update(TENANT, ACTOR, id,
                new MandateRequest(null, null, "OC-REF-NUEVA", null, null, 90));
        assertEquals("oc", patched.orderType());
        assertEquals("OC-REF-NUEVA", patched.orderRef());
        assertEquals(90, patched.slaMinutes());

        Mandate cancelled = service.cancel(TENANT, ACTOR, id, "cliente desistió");
        assertEquals(Mandate.CANCELLED, cancelled.status());
        assertEquals("cliente desistió", cancelled.cancelReason());
    }
}
