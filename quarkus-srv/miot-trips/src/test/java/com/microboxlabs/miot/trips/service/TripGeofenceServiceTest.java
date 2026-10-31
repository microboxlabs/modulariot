package com.microboxlabs.miot.trips.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.trips.domain.TripLiveProjection;
import com.microboxlabs.miot.trips.store.FakeGeofences;
import com.microboxlabs.miot.trips.store.InMemoryTripsWorld;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TripGeofenceServiceTest {
    private final UUID id = UUID.fromString("11111111-1111-4111-8111-111111111111");
    private final InMemoryTripsWorld world = new InMemoryTripsWorld();
    private final FakeGeofences directory = new FakeGeofences();
    private final TripGeofenceService service = new TripGeofenceService(world.tripLiveStore, directory, new ObjectMapper());

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
}
