package com.microboxlabs.miot.places.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.places.dto.PlaceRequest;
import com.microboxlabs.miot.places.dto.PlaceRequest.VersionRequest;
import com.microboxlabs.miot.places.store.InMemoryPlaceStore;
import com.microboxlabs.miot.places.store.PlaceStore;
import com.microboxlabs.miot.places.store.PlaceStore.Place;
import com.microboxlabs.miot.places.store.PlaceStore.PlaceVersion;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * Kinds, shapes and inner geofences are checked before anything is saved; a geofence is saved with its inner
 * geofences, starts at 1.0.0 and every edit is its next version.
 */
class PlaceServiceTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final String TENANT = "acme-client";
    private static final String ACTOR = "ana@example.com";
    private static final String CODE = "SCL";
    private static final String SQUARE = """
            {"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[-70,-33],[-70,-32],[-69,-32],[-70,-33]]]},
             "properties":{"polyBase":"rect"}}""";
    private static final String CIRCLE = """
            {"type":"Feature","geometry":{"type":"Point","coordinates":[-70,-33]},"properties":{"radius_m":20}}""";
    private static final String LINE = """
            {"type":"Feature","geometry":{"type":"LineString","coordinates":[[-70,-33],[-69,-32]]}}""";

    private final InMemoryPlaceStore store = new InMemoryPlaceStore();
    private final PlaceService service = new PlaceService(store, Transactions.none());

    private static JsonNode json(String text) {
        try {
            return MAPPER.readTree(text);
        } catch (Exception e) {
            throw new IllegalArgumentException(e);
        }
    }

    private static PlaceRequest request(String kind, String name, String geojson) {
        return new PlaceRequest(kind, null, CODE, name, null, null, null, null, null, json(geojson), null, null, null,
                null, null);
    }

    private static PlaceRequest geofenceWith(String name, List<PlaceRequest> inners, VersionRequest version) {
        return new PlaceRequest("geofence", null, CODE, name, null, null, null, null, null, json(SQUARE), null, null,
                null, inners, version);
    }

    private static PlaceRequest inner(UUID id, String name) {
        return new PlaceRequest(null, null, "IN-" + name, name, null, "#22c55e", null, null, null, json(CIRCLE), null,
                null,
                id == null ? null : id.toString(), null, null);
    }

    private static PlaceRequest innerWithCode(UUID id, String name, String code) {
        return new PlaceRequest(null, null, code, name, null, null, null, null, null, json(CIRCLE), null, null,
                id == null ? null : id.toString(), null, null);
    }

    private static PlaceRequest edit(PlaceRequest r, String bump) {
        return new PlaceRequest(r.kind(), r.parentId(), r.externalCode(), r.name(), r.icon(), r.color(), r.address(),
                r.categories(), r.metadata(), r.geojson(), r.validFrom(), r.validUntil(), r.id(),
                r.inners(), new VersionRequest(bump, "Ajuste", List.of("Nombre: «A» → «B»")));
    }

    private static PlaceRequest withCategories(PlaceRequest.Categories categories) {
        return new PlaceRequest("geofence", null, CODE, "Planta", null, null, null, categories, null, json(SQUARE),
                null, null, null, null, null);
    }

    private Place geofence(String name) {
        return service.create(TENANT, request("geofence", name, SQUARE), ACTOR).place();
    }

    @Test
    void savesAGeofenceWithItsFeatureActorAndFirstVersion() {
        Place saved = service.create(TENANT, new PlaceRequest("geofence", null, " SCL ", " Planta Santiago ",
                "hi2-building", "#3b82f6", null,
                new PlaceRequest.Categories(" categorias_lugar ", List.of(" planta ", "", "planta", "norte")),
                json("{\"turno\":\"A\"}"), json(SQUARE), null, null, null, null, null), ACTOR).place();

        assertEquals("SCL", saved.externalCode());
        assertEquals("Planta Santiago", saved.name());
        JsonNode categories = json(saved.categoriesJson());
        assertEquals("categorias_lugar", categories.path("selectable").asText());
        assertEquals(json("[\"planta\",\"norte\"]"), categories.path("values"));
        assertEquals(ACTOR, saved.createdBy());
        assertEquals("1.0.0", saved.currentVersion());
        JsonNode feature = json(saved.geojson());
        assertEquals("Polygon", feature.path("geometry").path("type").asText());
        assertEquals("rect", feature.path("properties").path("polyBase").asText());
        assertEquals("A", json(saved.metadataJson()).path("turno").asText());

        List<PlaceVersion> versions = service.versions(TENANT, saved.id());
        assertEquals(1, versions.size());
        assertEquals("1.0.0", versions.get(0).version());
        assertNull(versions.get(0).bump());
        assertEquals("Planta Santiago", json(versions.get(0).snapshotJson()).path("name").asText());
    }

    @Test
    void aCircleIsStoredAsAPolygonThatRemembersItsCenterAndRadius() {
        Place circle = service.create(TENANT, request("geofence", "Rotonda", CIRCLE), ACTOR).place();
        JsonNode feature = json(circle.geojson());
        JsonNode ring = feature.path("geometry").path("coordinates").get(0);
        assertEquals("Polygon", feature.path("geometry").path("type").asText());
        assertEquals(PlaceShapes.CIRCLE_SEGMENTS + 1, ring.size());
        assertEquals(ring.get(0), ring.get(ring.size() - 1), "the ring is closed");
        assertEquals("circle", feature.path("properties").path("shape").asText());
        JsonNode center = feature.path("properties").path("center");
        assertEquals(-70, center.get(0).asDouble());
        assertEquals(-33, center.get(1).asDouble());
        assertEquals(20, feature.path("properties").path("radius_m").asInt());
        for (JsonNode p : ring) {
            assertEquals(20, meters(-70, -33, p.get(0).asDouble(), p.get(1).asDouble()), 0.05);
        }

        String noRadius = "{\"type\":\"Feature\",\"geometry\":{\"type\":\"Point\",\"coordinates\":[-70,-33]}}";
        assertThrows(IllegalArgumentException.class,
                () -> service.create(TENANT, request("geofence", "Sin radio", noRadius), ACTOR));
    }

    @Test
    void aPolygonEditedByHandIsNoLongerACircle() {
        String reshaped = """
                {"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[-70,-33],[-70,-32],[-69,-32],[-70,-33]]]},
                 "properties":{"shape":"circle","center":[-70,-33],"radius_m":20}}""";
        JsonNode properties = json(service.create(TENANT, request("geofence", "Antes círculo", reshaped), ACTOR)
                .place().geojson()).path("properties");
        assertTrue(properties.path("shape").isMissingNode());
        assertTrue(properties.path("radius_m").isMissingNode());
    }

    @Test
    void aGeofenceIsSavedWithItsInnerGeofences() {
        PlaceService.Saved planta = service.create(TENANT,
                geofenceWith("Planta", List.of(inner(null, "Andén 1"), inner(null, "Andén 2")), null), ACTOR);
        assertEquals(2, planta.inners().size());
        for (Place i : planta.inners()) {
            assertEquals(PlaceStore.INNER_GEOFENCE, i.kind());
            assertEquals(planta.place().id(), i.parentId());
            assertNull(i.currentVersion(), "an inner geofence is versioned with its geofence");
        }
        UUID anden1 = planta.inners().get(0).id();
        UUID anden2 = planta.inners().get(1).id();

        // one edit: keep Andén 1 renamed, drop Andén 2, add Andén 3
        PlaceService.Saved edited = service.update(TENANT, planta.place().id(),
                geofenceWith("Planta",
                        List.of(innerWithCode(anden1, "Andén 1A", "IN-Andén 1"), inner(null, "Andén 3")),
                        new VersionRequest("MINOR", "Andenes", List.of("Geocerca interior quitada: «Andén 2»"))),
                ACTOR);

        assertEquals("1.1.0", edited.place().currentVersion());
        assertEquals(List.of("Andén 1A", "Andén 3"), edited.inners().stream().map(Place::name).toList());
        assertEquals(anden1, edited.inners().get(0).id());
        assertTrue(store.deleted.contains(anden2));
        List<PlaceVersion> versions = service.versions(TENANT, planta.place().id());
        assertEquals(List.of("1.0.0", "1.1.0"), versions.stream().map(PlaceVersion::version).toList());
        JsonNode snapshot = json(versions.get(1).snapshotJson());
        assertEquals(2, snapshot.path("inners").size(), "the version keeps the inner geofences as saved");
        assertEquals("Andenes", versions.get(1).reason());
        assertEquals("Geocerca interior quitada: «Andén 2»", json(versions.get(1).changesJson()).get(0).asText());

        // without inners they stay as they are
        PlaceService.Saved renamed = service.update(TENANT, planta.place().id(),
                geofenceWith("Planta Norte", null, new VersionRequest("PATCH", null, null)), ACTOR);
        assertEquals(2, renamed.inners().size());
        assertEquals("1.1.1", renamed.place().currentVersion());
    }

    @Test
    void anInnerGeofenceIsNeverSavedOnItsOwn() {
        PlaceService.Saved planta = service.create(TENANT,
                geofenceWith("Planta", List.of(inner(null, "Andén")), null), ACTOR);
        Place anden = planta.inners().get(0);
        Place otra = geofence("Otra");
        VersionRequest v = new VersionRequest("PATCH", null, null);

        assertThrows(IllegalArgumentException.class,
                () -> service.create(TENANT, request("inner_geofence", "Suelta", CIRCLE), ACTOR));
        assertThrows(IllegalArgumentException.class,
                () -> service.update(TENANT, anden.id(), edit(request(null, "Andén", CIRCLE), "PATCH"), ACTOR));
        assertThrows(IllegalArgumentException.class, () -> service.delete(TENANT, anden.id(), ACTOR));
        assertThrows(IllegalArgumentException.class, () -> service.versions(TENANT, anden.id()));
        // another geofence's inner geofence, or the same one twice
        assertThrows(IllegalArgumentException.class, () -> service.update(TENANT, otra.id(),
                geofenceWith("Otra", List.of(inner(anden.id(), "Robada")), v), ACTOR));
        assertThrows(IllegalArgumentException.class, () -> service.update(TENANT, planta.place().id(),
                geofenceWith("Planta", List.of(inner(anden.id(), "A"), inner(anden.id(), "B")), v), ACTOR));
        // a route has none
        assertThrows(IllegalArgumentException.class, () -> service.create(TENANT, new PlaceRequest("route", null,
                CODE, "Ruta", null, null, null, null, null, json(LINE), null, null, null,
                List.of(inner(null, "Andén")), null), ACTOR));
    }

    @Test
    void everyEditIsTheNextVersion() {
        Place planta = geofence("Planta");
        PlaceRequest base = request(null, "Planta", SQUARE);

        assertThrows(IllegalArgumentException.class, () -> service.update(TENANT, planta.id(), base, ACTOR),
                "an edit without a version");
        assertThrows(IllegalArgumentException.class,
                () -> service.update(TENANT, planta.id(), edit(base, "HUGE"), ACTOR));
        assertThrows(IllegalArgumentException.class, () -> service.create(TENANT,
                edit(request("geofence", "Con versión", SQUARE), "MAJOR"), ACTOR), "a new place takes no version");

        List<String> seen = List.of("PATCH", "MINOR", "PATCH", "MAJOR", "PATCH").stream()
                .map(b -> service.update(TENANT, planta.id(), edit(base, b), ACTOR).place().currentVersion())
                .toList();
        assertEquals(List.of("1.0.1", "1.1.0", "1.1.1", "2.0.0", "2.0.1"), seen);
        List<PlaceVersion> versions = service.versions(TENANT, planta.id());
        assertEquals(6, versions.size());
        assertEquals("MAJOR", versions.get(4).bump());
        assertEquals("Ajuste", versions.get(4).reason());
    }

    @Test
    void aGeofenceAndARouteNeedTheirCode() {
        for (String code : java.util.Arrays.asList(null, "", "   ")) {
            assertThrows(IllegalArgumentException.class, () -> service.create(TENANT, new PlaceRequest("geofence",
                    null, code, "Sin código", null, null, null, null, null, json(SQUARE), null, null, null, null,
                    null), ACTOR), "geofence code «" + code + "»");
            assertThrows(IllegalArgumentException.class, () -> service.create(TENANT, new PlaceRequest("route",
                    null, code, "Sin código", null, null, null, null, null, json(LINE), null, null, null, null,
                    null), ACTOR), "route code «" + code + "»");
        }
    }

    @Test
    void theCodeOfARouteCanChangeButNotGoAway() {
        Place ruta = service.create(TENANT, request("route", "Ruta", LINE), ACTOR).place();
        PlaceRequest renamed = new PlaceRequest(null, null, "RUTA-2", "Ruta", null, null, null, null, null, json(LINE),
                null, null, null, null, null);
        assertEquals("RUTA-2", service.update(TENANT, ruta.id(), edit(renamed, "PATCH"), ACTOR).place().externalCode());

        PlaceRequest noCode = new PlaceRequest(null, null, null, "Ruta", null, null, null, null, null, json(LINE),
                null, null, null, null, null);
        assertThrows(IllegalArgumentException.class,
                () -> service.update(TENANT, ruta.id(), edit(noCode, "PATCH"), ACTOR));
    }

    @Test
    void theCodeOfAPlaceNeverChanges() {
        PlaceService.Saved planta = service.create(TENANT,
                geofenceWith("Planta", List.of(innerWithCode(null, "Andén", "AND-1"), inner(null, "Patio")), null),
                ACTOR);
        UUID anden = planta.inners().get(0).id();
        UUID patio = planta.inners().get(1).id();
        PlaceRequest base = request(null, "Planta", SQUARE);
        PlaceRequest otherCode = new PlaceRequest(null, null, "SCL-2", "Planta", null, null, null, null, null,
                json(SQUARE), null, null, null, null, null);

        assertThrows(IllegalArgumentException.class,
                () -> service.update(TENANT, planta.place().id(), edit(otherCode, "PATCH"), ACTOR));
        assertThrows(IllegalArgumentException.class, () -> service.update(TENANT, planta.place().id(),
                geofenceWith("Planta", List.of(innerWithCode(anden, "Andén", "AND-2"), inner(patio, "Patio")),
                        new VersionRequest("PATCH", null, null)), ACTOR));

        assertThrows(IllegalArgumentException.class, () -> service.update(TENANT, planta.place().id(),
                geofenceWith("Planta", List.of(innerWithCode(anden, "Andén", "AND-1"),
                        innerWithCode(patio, "Patio", null)), new VersionRequest("PATCH", null, null)), ACTOR),
                "an inner geofence needs its code too");
        PlaceService.Saved edited = service.update(TENANT, planta.place().id(),
                geofenceWith("Planta", List.of(innerWithCode(anden, "Andén", "AND-1"), inner(patio, "Patio")),
                        new VersionRequest("PATCH", null, null)), ACTOR);
        assertEquals("IN-Patio", edited.inners().get(1).externalCode());
        assertEquals(CODE, service.update(TENANT, planta.place().id(), edit(base, "PATCH"), ACTOR).place()
                .externalCode());
    }

    @Test
    void saysWhoHoldsACodeUntilItIsDeleted() {
        Place planta = geofence("Planta");

        assertEquals(planta.id(), service.codeOwner(TENANT, " scl ").orElseThrow().id(), "whatever its case");
        assertTrue(service.codeOwner(TENANT, "OTRO").isEmpty());
        assertTrue(service.codeOwner("other-client", CODE).isEmpty(), "a code is per organization");
        assertThrows(IllegalArgumentException.class, () -> service.codeOwner(TENANT, "  "));

        service.delete(TENANT, planta.id(), ACTOR);
        assertTrue(service.codeOwner(TENANT, CODE).isEmpty(), "deleting frees the code");
    }

    @Test
    void categoriesCarryTheirSelectableOrAreNull() {
        assertNull(service.create(TENANT, withCategories(null), ACTOR).place().categoriesJson());
        assertNull(service.create(TENANT, withCategories(new PlaceRequest.Categories("lista", List.of(" ", ""))),
                ACTOR).place().categoriesJson(), "no values, nothing to look up");
        assertThrows(IllegalArgumentException.class, () -> service.create(TENANT,
                withCategories(new PlaceRequest.Categories(" ", List.of("planta"))), ACTOR));
    }

    @Test
    void theNextVersionResetsTheSmallerParts() {
        assertEquals("2.0.0", PlaceService.next("1.2.3", "MAJOR"));
        assertEquals("1.3.0", PlaceService.next("1.2.3", "MINOR"));
        assertEquals("1.2.4", PlaceService.next("1.2.3", "PATCH"));
    }

    @Test
    void aRouteIsALineWithoutAParent() {
        Place route = service.create(TENANT, request("route", "Santiago - Valparaíso", LINE), ACTOR).place();
        assertEquals(PlaceStore.ROUTE, route.kind());
        assertEquals("1.0.0", route.currentVersion());

        Place parent = geofence("Planta");
        assertThrows(IllegalArgumentException.class, () -> service.create(TENANT, new PlaceRequest("route",
                parent.id().toString(), null, "Con padre", null, null, null, null, null, json(LINE), null, null, null,
                null, null), ACTOR));
        assertThrows(IllegalArgumentException.class,
                () -> service.create(TENANT, request("route", "Polígono", SQUARE), ACTOR));
        assertThrows(IllegalArgumentException.class,
                () -> service.create(TENANT, request("geofence", "Línea", LINE), ACTOR));
    }

    @Test
    void rejectsShapesTheMapCannotDraw() {
        String open = """
                {"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[-70,-33],[-70,-32],[-69,-32],[-69,-33]]]}}""";
        String latLon = """
                {"type":"Feature","geometry":{"type":"Point","coordinates":[-33,-170]},"properties":{"radius_m":5}}""";
        String bare = "{\"type\":\"Polygon\",\"coordinates\":[[[-70,-33],[-70,-32],[-69,-32],[-70,-33]]]}";
        for (String shape : List.of(open, latLon, bare)) {
            assertThrows(IllegalArgumentException.class,
                    () -> service.create(TENANT, request("geofence", "Mala", shape), ACTOR), shape);
        }
        assertThrows(IllegalArgumentException.class,
                () -> service.create(TENANT, new PlaceRequest("geofence", null, null, "Sin forma", null, null, null,
                        null, null, null, null, null, null, null, null), ACTOR));
    }

    @Test
    void needsAKnownKindANameAndAnOrderedValidity() {
        assertThrows(IllegalArgumentException.class,
                () -> service.create(TENANT, request("zone", "Zona", SQUARE), ACTOR));
        assertThrows(IllegalArgumentException.class,
                () -> service.create(TENANT, request("geofence", "  ", SQUARE), ACTOR));
        OffsetDateTime now = OffsetDateTime.now();
        assertThrows(IllegalArgumentException.class,
                () -> service.create(TENANT, new PlaceRequest("geofence", null, CODE, "Al revés", null, null, null,
                        null, null, json(SQUARE), now, now.minusDays(1), null, null, null), ACTOR));
        assertTrue(store.list(TENANT, null, null, null, 10, 0).isEmpty());
    }

    @Test
    void anUpdateKeepsTheKind() {
        Place planta = geofence("Planta");
        Place renamed = service.update(TENANT, planta.id(), edit(request(null, "Planta Norte", CIRCLE), "MAJOR"),
                "luis@x.cl").place();
        assertEquals("Planta Norte", renamed.name());
        assertEquals("luis@x.cl", renamed.updatedBy());
        assertEquals("circle", json(renamed.geojson()).path("properties").path("shape").asText());

        assertThrows(IllegalArgumentException.class, () -> service.update(TENANT, planta.id(),
                edit(request("route", "Ahora ruta", LINE), "MAJOR"), ACTOR));
        assertThrows(NoSuchElementException.class, () -> service.update(TENANT, UUID.randomUUID(),
                edit(request(null, "Nadie", SQUARE), "PATCH"), ACTOR));
        assertThrows(NoSuchElementException.class, () -> service.update("other-client", planta.id(),
                edit(request(null, "Ajena", SQUARE), "PATCH"), ACTOR));
    }

    @Test
    void deletingAGeofenceDeletesItsInnerGeofences() {
        PlaceService.Saved planta = service.create(TENANT,
                geofenceWith("Planta", List.of(inner(null, "Andén")), null), ACTOR);
        PlaceService.Saved puerto = service.create(TENANT,
                geofenceWith("Puerto", List.of(inner(null, "Muelle")), null), ACTOR);

        service.delete(TENANT, planta.place().id(), ACTOR);

        assertEquals(List.of(planta.inners().get(0).id(), planta.place().id()), store.deleted);
        assertEquals(Set.of(puerto.place().id(), puerto.inners().get(0).id()),
                Set.copyOf(store.list(TENANT, null, null, null, 10, 0).stream().map(Place::id).toList()));
        assertThrows(NoSuchElementException.class, () -> service.delete(TENANT, planta.place().id(), ACTOR));
    }

    @Test
    void listsWithBoundedPagesAndAKnownKind() {
        geofence("Planta");
        service.create(TENANT, request("route", "Ruta", LINE), ACTOR);
        assertEquals(1, service.list(TENANT, "route", null, null, null, null).size());
        assertEquals(2, service.list(TENANT, null, null, "  ", null, null).size());
        assertThrows(IllegalArgumentException.class, () -> service.list(TENANT, "zone", null, null, null, null));
        assertThrows(IllegalArgumentException.class,
                () -> service.list(TENANT, null, null, null, PlaceService.MAX_PAGE_SIZE + 1, null));
        assertThrows(IllegalArgumentException.class, () -> service.list(TENANT, null, null, null, null, -1));
    }

    /** Great-circle distance in meters, the same sphere the ring is drawn on. */
    private static double meters(double lon1, double lat1, double lon2, double lat2) {
        double p1 = Math.toRadians(lat1);
        double p2 = Math.toRadians(lat2);
        double dp = p2 - p1;
        double dl = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dp / 2) * Math.sin(dp / 2)
                + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
        return 2 * 6_371_008.8 * Math.asin(Math.sqrt(a));
    }
}
