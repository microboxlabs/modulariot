package com.microboxlabs.miot.trips.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.microboxlabs.miot.trips.domain.Mandate;
import com.microboxlabs.miot.trips.domain.Trip;
import com.microboxlabs.miot.trips.store.InMemoryFleet;
import com.microboxlabs.miot.trips.store.InMemoryTripsWorld;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** The hot row's trip type comes from the order type of the trip's mandate. */
class TripLiveProjectorTest {

    private static final String TENANT = "tenant-a";
    private static final String ACTOR = "feed:a";

    private final InMemoryTripsWorld world = new InMemoryTripsWorld();
    private final TripLiveProjector projector = world.projector(new InMemoryFleet());

    private UUID trip() {
        return UUID.fromString(world.tripStore.insert(new Trip(null, TENANT, Trip.PLANNED, null, null, null, null,
                null, null, null, ACTOR, null, ACTOR)).id());
    }

    private UUID mandate(String code, String orderType) {
        return UUID.fromString(world.mandateStore.insertOrGet(new Mandate(null, TENANT, code, orderType, null,
                Mandate.ACTIVE, null, null, null, null, null, null, ACTOR, null, ACTOR)).mandate().id());
    }

    private String tripType(UUID tripId) {
        projector.refresh(TENANT, tripId);
        return world.tripLiveStore.find(TENANT, tripId).orElseThrow().tripType();
    }

    @ParameterizedTest
    @CsvSource({"v, v", "ote, ote", "otr, otr", "TRASLADO, traslado", "' Directo ', directo"})
    void theTripTypeIsThePrimaryMandatesOrderTypeInLowerCase(String orderType, String expected) {
        UUID tripId = trip();
        world.tripStore.linkMandate(TENANT, tripId, mandate("SVC-1", orderType), 1, "primary", ACTOR);
        assertEquals(expected, tripType(tripId));
    }

    @Test
    void unicodeLowercaseDoesNotExpandATypePastTheColumnWidth() {
        UUID tripId = trip();
        world.tripStore.linkMandate(TENANT, tripId, mandate("SVC-1", "A".repeat(31) + "İ"), 1, "primary", ACTOR);
        assertEquals("a".repeat(31) + "i", tripType(tripId));
    }

    @Test
    void aTripWithoutMandateHasNoTripType() {
        assertNull(tripType(trip()));
    }

    @Test
    void thePrimaryMandateWinsOverAnEarlierLink() {
        UUID tripId = trip();
        world.tripStore.linkMandate(TENANT, tripId, mandate("SVC-1", "ote"), 1, "secondary", ACTOR);
        world.tripStore.linkMandate(TENANT, tripId, mandate("SVC-2", "otr"), 2, "primary", ACTOR);
        assertEquals("otr", tripType(tripId));
    }

    @Test
    void withoutAPrimaryMandateTheFirstLinkGivesTheType() {
        UUID tripId = trip();
        world.tripStore.linkMandate(TENANT, tripId, mandate("SVC-1", "ote"), 1, "secondary", ACTOR);
        world.tripStore.linkMandate(TENANT, tripId, mandate("SVC-2", "otr"), 2, "secondary", ACTOR);
        assertEquals("ote", tripType(tripId));
    }

    @Test
    void aChangedOrderTypeReachesTheRowOnTheNextRefresh() {
        UUID tripId = trip();
        UUID mandateId = mandate("SVC-1", "v");
        world.tripStore.linkMandate(TENANT, tripId, mandateId, 1, "primary", ACTOR);
        assertEquals("v", tripType(tripId));

        Mandate m = world.mandateStore.find(TENANT, mandateId).orElseThrow();
        world.mandateStore.update(new Mandate(m.id(), m.tenantCode(), m.externalCode(), "OTE", m.orderRef(),
                m.status(), m.originId(), m.destinationId(), m.slaMinutes(), m.closedAt(), m.cancelReason(),
                m.createdAt(), m.createdBy(), m.updatedAt(), m.updatedBy()));
        assertEquals("ote", tripType(tripId));
    }
}
