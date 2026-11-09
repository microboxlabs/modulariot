package com.microboxlabs.miot.cli;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import com.microboxlabs.miot.places.access.PlacesAccessCatalog;
import com.microboxlabs.miot.places.api.OrgGeofencesResource;
import com.microboxlabs.miot.places.api.OrgPlacesResource;
import com.microboxlabs.miot.places.service.GeofenceOrganizationScope;
import com.microboxlabs.miot.places.service.GeofenceService;
import com.microboxlabs.miot.places.service.PlaceService;
import com.microboxlabs.miot.places.service.PlaceSyncRetry;
import com.microboxlabs.miot.places.service.StreamHubPlaceSync;
import com.microboxlabs.miot.places.store.PgPlaceStore;
import com.microboxlabs.miot.places.store.GpsGeofenceStore;
import io.quarkus.arc.Arc;
import io.quarkus.test.common.http.TestHTTPResource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.security.TestSecurity;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;

/** The API is on, places is off, and no database, broker or Docker is needed. */
@QuarkusTest
@TestProfile(DeviceEventsAvailabilityTest.Profile.class)
class PlacesDisabledTest {

    @TestHTTPResource
    URI baseUri;

    @Test
    void placesBeansIncludingTheRetrySchedulerAreAbsent() {
        for (Class<?> type : List.of(PlacesAccessCatalog.class, OrgGeofencesResource.class, OrgPlacesResource.class,
                GeofenceOrganizationScope.class, GeofenceService.class, PlaceService.class, PgPlaceStore.class,
                GpsGeofenceStore.class,
                PlaceSyncRetry.class, StreamHubPlaceSync.class)) {
            assertFalse(Arc.container().instance(type).isAvailable(), type.getName());
        }
    }

    @Test
    @TestSecurity(authorizationEnabled = false)
    void placesEndpointsAreAbsent() throws Exception {
        try (HttpClient client = HttpClient.newHttpClient()) {
            for (String endpoint : List.of("items", "geofences")) {
                HttpRequest request = HttpRequest.newBuilder(baseUri.resolve("/api/v1/orgs/example/places/" + endpoint))
                        .timeout(Duration.ofSeconds(10)).GET().build();
                assertEquals(404, client.send(request, HttpResponse.BodyHandlers.ofString()).statusCode(), endpoint);
            }
        }
    }
}
