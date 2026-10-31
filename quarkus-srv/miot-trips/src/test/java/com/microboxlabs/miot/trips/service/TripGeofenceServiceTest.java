package com.microboxlabs.miot.trips.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.fleet.FleetResources;
import com.microboxlabs.miot.trips.domain.Assignment;
import com.microboxlabs.miot.trips.domain.Location;
import com.microboxlabs.miot.trips.domain.Stage;
import com.microboxlabs.miot.trips.domain.Trip;
import com.microboxlabs.miot.trips.domain.TripLiveProjection;
import com.microboxlabs.miot.trips.store.FakeGeofences;
import com.microboxlabs.miot.trips.store.InMemoryFleet;
import com.microboxlabs.miot.trips.store.InMemoryTripsWorld;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class TripGeofenceServiceTest {
    private final UUID id = UUID.fromString("11111111-1111-4111-8111-111111111111");
    private final InMemoryTripsWorld world = new InMemoryTripsWorld();
    private final FakeGeofences directory = new FakeGeofences();
    private final InMemoryFleet fleet = new InMemoryFleet();
    private final TripGeofenceService service = new TripGeofenceService(world.tripLiveStore, world.tripStore,
            world.stageStore, world.locationStore, world.assignmentStore, fleet, directory, new ObjectMapper());

    private void trip(Integer origin, Integer destination, List<Integer> stops) {
        world.tripLiveStore.upsert(new TripLiveProjection(id.toString(), "tenant-a", "ORDER-1", "TRUCK-1",
                null, null, origin, destination, stops, "planned", null, null, null, null, null, null,
                null, null, null, null, null, null, null, null));
    }

    @Test
    void readsNamesCodesShapesAndRoles() {
        trip(1, 2, List.of(3));
        for (int i = 1; i <= 3; i++) directory.add("tenant-a", i, "ZONE-" + i, "Zone " + i).square(i, 0, 0, 1);
        var result = service.geofences("tenant-a", id);
        assertEquals(3, result.size());
        for (int i = 0; i < 3; i++) {
            var item = result.get(i);
            assertEquals(id.toString(), item.path("trip_id").asText());
            assertEquals("TRUCK-1", item.path("asset_id").asText());
            assertEquals(i + 1, item.path("zone").path("location_type").asInt());
            assertEquals("ZONE-" + (i + 1), item.path("zone").path("code").asText());
            assertEquals("Zone " + (i + 1), item.path("zone").path("name").asText());
            assertEquals("Polygon", item.path("zone").path("location").path("type").asText());
        }
    }

    @Test
    void anotherTenantsTripIsNotFound() {
        trip(1, 2, List.of());
        assertThrows(NoSuchElementException.class, () -> service.geofences("tenant-b", id));
    }

    @Test
    void noGeofencesIsAnEmptyList() {
        trip(null, null, List.of());
        assertEquals(0, service.geofences("tenant-a", id).size());
    }

    @Test
    void omitsOtherTenantsGeofencesAndMissingShapes() {
        trip(1, 2, List.of(3));
        directory.add("tenant-b", 1, "OTHER", "Other").square(1, 0, 0, 1);
        directory.add("tenant-a", 2, "MISSING", "Missing");
        assertEquals(0, service.geofences("tenant-a", id).size());
    }

    @Test
    void preservesBothRolesWhenOriginAndDestinationAreTheSame() {
        trip(1, 1, List.of());
        directory.add("tenant-a", 1, "SITE", "Site").square(1, 0, 0, 1);
        assertEquals(2, service.geofences("tenant-a", id).size());
    }

    private Location location(int geofenceId) {
        return world.locationStore.insert(new Location(null, "tenant-a", "Location " + geofenceId, "plant",
                null, null, geofenceId, null, null, null, null));
    }

    private UUID persistentTrip(String status, String origin, String destination) {
        var trip = world.tripStore.insert(new Trip(null, "tenant-a", status, origin, destination,
                null, null, null, null, null, null, null, null));
        return UUID.fromString(trip.id());
    }

    @ParameterizedTest
    @ValueSource(strings = {Trip.DONE, Trip.CANCELLED})
    void finishedTripsReadPersistentLocationsAndEndedTruckAssignments(String status) {
        UUID tripId = persistentTrip(status, location(1).id(), location(2).id());
        var stop = location(3);
        world.stageStore.insert(new Stage(null, "tenant-a", Stage.SUBJECT_TRIP, tripId.toString(), 1,
                Stage.STOP, null, Stage.CLOSED, stop.id(), null, null, null, null, null, null, null, null, null));
        UUID truck = fleet.add(new FleetResources.Vehicle("TRUCK-2", null));
        var from = OffsetDateTime.parse("2026-01-01T00:00:00Z");
        world.assignmentStore.insert(new Assignment(null, "tenant-a", tripId.toString(), Assignment.TRUCK,
                truck.toString(), from, from.plusDays(1), null, null, null, null, null));
        for (int i = 1; i <= 3; i++) directory.add("tenant-a", i, "ZONE-" + i, "Zone " + i).square(i, 0, 0, 1);

        assertTrue(world.tripLiveStore.find("tenant-a", tripId).isEmpty());
        var result = service.geofences("tenant-a", tripId);
        assertEquals(3, result.size());
        for (int i = 0; i < 3; i++) {
            assertEquals(tripId.toString(), result.get(i).path("trip_id").asText());
            assertEquals("TRUCK-2", result.get(i).path("asset_id").asText());
            assertEquals(i + 1, result.get(i).path("zone").path("id").asInt());
            assertEquals(i + 1, result.get(i).path("zone").path("location_type").asInt());
            assertEquals("Polygon", result.get(i).path("zone").path("location").path("type").asText());
        }
    }

    @Test
    void persistentTripOfAnotherTenantIsNotFound() {
        UUID tripId = persistentTrip(Trip.DONE, location(1).id(), location(2).id());
        assertThrows(NoSuchElementException.class, () -> service.geofences("tenant-b", tripId));
    }

    @Test
    void persistentTripWithoutGeofencesIsEmpty() {
        UUID tripId = persistentTrip(Trip.DONE, null, null);
        assertEquals(0, service.geofences("tenant-a", tripId).size());
    }
}
