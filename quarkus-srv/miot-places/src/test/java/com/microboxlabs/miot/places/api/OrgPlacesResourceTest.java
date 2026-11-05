package com.microboxlabs.miot.places.api;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.places.access.PlacesAccessCatalog;
import com.microboxlabs.miot.places.dto.CodeUsageView;
import com.microboxlabs.miot.places.dto.PlaceRequest;
import com.microboxlabs.miot.places.dto.PlaceVersionView;
import com.microboxlabs.miot.places.dto.PlaceView;
import com.microboxlabs.miot.places.service.PlaceService;
import com.microboxlabs.miot.places.store.InMemoryPlaceStore;
import io.quarkus.security.PermissionsAllowed;
import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.lang.reflect.Method;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** The tenant and the actor come from the session; saving needs the places edit permission. */
class OrgPlacesResourceTest {

    private static final String ORG = "acme";
    private static final Duration WAIT = Duration.ofSeconds(5);
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final String CIRCLE = """
            {"type":"Feature","geometry":{"type":"Point","coordinates":[-70,-33]},"properties":{"radius_m":20}}""";

    private final InMemoryPlaceStore store = new InMemoryPlaceStore();
    private final OrgPlacesResource resource = resource();

    private OrgPlacesResource resource() {
        OrganizationContext org = new OrganizationContext();
        org.setOrganizationId(ORG);
        org.setUserEmail("ana@example.com");
        TenantContext tenant = new TenantContext();
        tenant.setClientId("acme-client");
        tenant.setTenantCode("acme-client");
        return new OrgPlacesResource(tenant, org, null, null, new PlaceService(store, Transactions.none()));
    }

    private static Response call(Uni<Response> uni) {
        return uni.await().atMost(WAIT);
    }

    private static PlaceRequest circle(String name) throws Exception {
        return new PlaceRequest("geofence", null, "ROT", name, null, null, null, null, null, MAPPER.readTree(CIRCLE),
                null, null, null, null, null);
    }

    @Test
    void createsInTheSessionsTenantAsTheSessionsUser() throws Exception {
        Response created = call(resource.create(ORG, circle("Rotonda")));
        assertEquals(201, created.getStatus());
        PlaceView view = (PlaceView) created.getEntity();
        assertEquals("ana@example.com", view.createdBy());
        assertEquals(20, view.geojson().path("properties").path("radius_m").asInt());
        assertEquals("acme-client", store.find("acme-client", java.util.UUID.fromString(view.id())).orElseThrow()
                .tenantCode());

        @SuppressWarnings("unchecked")
        List<PlaceView> listed = (List<PlaceView>) call(resource.list(ORG, "geofence", null, null, null, null))
                .getEntity();
        assertEquals(List.of("Rotonda"), listed.stream().map(PlaceView::name).toList());
        assertEquals("1.0.0", view.currentVersion());
    }

    @Test
    void anEditWithoutAVersionIsABadRequestAndOneWithItIsTheNextVersion() throws Exception {
        PlaceView created = (PlaceView) call(resource.create(ORG, circle("Rotonda"))).getEntity();
        assertEquals(400, call(resource.update(ORG, created.id(), circle("Rotonda Norte"))).getStatus());

        PlaceRequest r = circle("Rotonda Norte");
        PlaceRequest edit = new PlaceRequest(r.kind(), null, r.externalCode(), r.name(), null, null, null, null, null,
                r.geojson(), null, null, null, null,
                new PlaceRequest.VersionRequest("PATCH", "Nombre", List.of()));
        PlaceView edited = (PlaceView) call(resource.update(ORG, created.id(), edit)).getEntity();
        assertEquals("1.0.1", edited.currentVersion());
        assertEquals(List.of(), edited.inners());

        @SuppressWarnings("unchecked")
        List<PlaceVersionView> versions = (List<PlaceVersionView>) call(resource.versions(ORG, created.id()))
                .getEntity();
        assertEquals(List.of("1.0.0", "1.0.1"), versions.stream().map(PlaceVersionView::version).toList());
        assertEquals("Rotonda Norte", versions.get(1).snapshot().path("name").asText());
    }

    @Test
    void saysWhetherACodeIsTaken() throws Exception {
        PlaceView created = (PlaceView) call(resource.create(ORG, circle("Rotonda"))).getEntity();

        CodeUsageView taken = (CodeUsageView) call(resource.codeUsage(ORG, "rot")).getEntity();
        assertTrue(taken.inUse());
        assertEquals(created.id(), taken.placeId());
        assertEquals("Rotonda", taken.name());

        assertFalse(((CodeUsageView) call(resource.codeUsage(ORG, "OTRO")).getEntity()).inUse());
        assertEquals(400, call(resource.codeUsage(ORG, " ")).getStatus());
    }

    @Test
    void mapsBadInputMissingPlacesAndBadIds() throws Exception {
        PlaceRequest noKind = new PlaceRequest(null, null, null, "Sin tipo", null, null, null, null, null,
                MAPPER.readTree(CIRCLE), null, null, null, null, null);
        assertEquals(400, call(resource.create(ORG, noKind)).getStatus());
        assertEquals(404, call(resource.get(ORG, "00000000-0000-0000-0000-000000000001")).getStatus());
        assertEquals(400, call(resource.get(ORG, "not-a-uuid")).getStatus());
        assertEquals(404, call(resource.delete(ORG, "00000000-0000-0000-0000-000000000001")).getStatus());
        @SuppressWarnings("unchecked")
        Map<String, String> body = (Map<String, String>) call(resource.create(ORG, noKind)).getEntity();
        assertEquals("kind must be one of [geofence, inner_geofence, route]", body.get("error"));
    }

    @Test
    void anotherOrganizationInThePathIsForbidden() {
        WebApplicationException e = assertThrows(WebApplicationException.class,
                () -> resource.create("other", circle("Ajena")));
        assertEquals(403, e.getResponse().getStatus());
    }

    @Test
    void savingNeedsThePlacesEditPermissionOnly() throws NoSuchMethodException {
        String[] edit = {PlacesAccessCatalog.CONTROL_TOWER_PLACES_EDIT};
        assertArrayEquals(edit, permissions(OrgPlacesResource.class.getMethod("create", String.class,
                PlaceRequest.class)));
        assertArrayEquals(edit, permissions(OrgPlacesResource.class.getMethod("update", String.class, String.class,
                PlaceRequest.class)));
        assertArrayEquals(edit, permissions(OrgPlacesResource.class.getMethod("delete", String.class,
                String.class)));
        assertEquals("controltower:places.edit", PlacesAccessCatalog.CONTROL_TOWER_PLACES_EDIT);
    }

    private static String[] permissions(Method method) {
        return method.getAnnotation(PermissionsAllowed.class).value();
    }
}
