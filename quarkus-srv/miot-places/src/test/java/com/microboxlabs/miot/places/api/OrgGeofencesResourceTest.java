package com.microboxlabs.miot.places.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.places.dto.GeofenceView;
import com.microboxlabs.miot.places.service.GeofenceService;
import com.microboxlabs.miot.places.service.GeofenceOrganizationScope;
import com.microboxlabs.miot.places.store.GeofenceStore;
import com.microboxlabs.miot.places.store.GeofencesUnavailableException;
import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/** The tenant comes from the resolved organization, never the request; errors map to 400, 403 and 503. */
class OrgGeofencesResourceTest {

    private static final String ORG = "acme";
    private static final Duration WAIT = Duration.ofSeconds(5);
    private static final String SQUARE = "{\"type\":\"Polygon\",\"coordinates\":[[[-70,-33],[-70,-32],[-69,-32],[-70,-33]]]}";

    private final List<String> tenants = new ArrayList<>();
    private boolean sourceAllowed = true;

    private OrgGeofencesResource resource(GeofenceStore store) {
        OrganizationContext org = new OrganizationContext();
        org.setOrganizationId(ORG);
        org.setUserEmail("ana@example.com");
        TenantContext tenant = new TenantContext();
        tenant.setClientId("acme-client");
        tenant.setTenantCode("acme-client");
        GeofenceStore recording = (tenantCode, q, limit, offset) -> {
            tenants.add(tenantCode);
            return store.list(tenantCode, q, limit, offset);
        };
        return new OrgGeofencesResource(tenant, org, null, null, new GeofenceService(recording), new GeofenceOrganizationScope() {
            @Override
            public Uni<Boolean> allows(String organizationId) {
                return Uni.createFrom().item(sourceAllowed);
            }
        });
    }

    private final OrgGeofencesResource resource = resource((tenantCode, q, limit, offset) -> List.of(
            new GeofenceStore.Geofence(7, "ARI", "Arica", "polygonal", "terminal", SQUARE, "{\"address\":\"Ruta 5\"}")));

    private static Response call(Uni<Response> uni) {
        return uni.await().atMost(WAIT);
    }

    @Test
    void listsTheOrganizationsGeofencesAsViews() {
        Response ok = call(resource.list(ORG, null, null, null));
        assertEquals(200, ok.getStatus());
        assertEquals(List.of("acme-client"), tenants);

        @SuppressWarnings("unchecked")
        List<GeofenceView> views = (List<GeofenceView>) ok.getEntity();
        GeofenceView arica = views.get(0);
        assertEquals(7, arica.id());
        assertEquals("ARI", arica.code());
        assertEquals("terminal", arica.category());
        assertEquals("Polygon", arica.shape().path("type").asText());
        assertEquals("Ruta 5", arica.properties().path("address").asText());
    }

    @Test
    void anotherOrganizationInThePathIsForbidden() {
        WebApplicationException e = assertThrows(WebApplicationException.class,
                () -> resource.list("other", null, null, null));
        assertEquals(403, e.getResponse().getStatus());
        assertEquals(List.of(), tenants);
    }

    @Test
    void aBadSizeIsABadRequest() {
        assertEquals(400, call(resource.list(ORG, null, "abc", null)).getStatus());
        assertEquals(400, call(resource.list(ORG, null, "0", null)).getStatus());
        assertEquals(400, call(resource.list(ORG, null, String.valueOf(GeofenceService.MAX_PAGE_SIZE + 1), null))
                .getStatus());
    }

    @Test
    void aSharedClientSubAccountIsDeniedBeforeReadingGps() {
        sourceAllowed = false;
        assertEquals(403, call(resource.list(ORG, null, null, null)).getStatus());
        assertEquals(List.of(), tenants);
    }

    @Test
    void anInvalidPageIsABadRequest() {
        assertEquals(400, call(resource.list(ORG, null, null, "-1")).getStatus());
        assertEquals(400, call(resource.list(ORG, null, null, "abc")).getStatus());
    }

    @Test
    void anUnconfiguredGpsDatabaseIsServiceUnavailable() {
        OrgGeofencesResource unavailable = resource((tenantCode, q, limit, offset) -> {
            throw new GeofencesUnavailableException("The GPS database is not configured");
        });
        assertEquals(503, call(unavailable.list(ORG, null, null, null)).getStatus());
    }

    @Test
    void anUnexpectedFailureIsNotHidden() {
        OrgGeofencesResource failing = resource((tenantCode, q, limit, offset) -> {
            throw new UnsupportedOperationException("boom");
        });
        Uni<Response> response = failing.list(ORG, null, null, null);
        assertThrows(UnsupportedOperationException.class, () -> call(response));
    }
}
