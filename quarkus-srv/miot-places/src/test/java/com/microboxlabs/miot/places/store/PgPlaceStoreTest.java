package com.microboxlabs.miot.places.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.db.PgTransactions;
import com.microboxlabs.miot.places.dto.PlaceRequest;
import com.microboxlabs.miot.places.dto.PlaceRequest.VersionRequest;
import com.microboxlabs.miot.places.service.PlaceService;
import com.microboxlabs.miot.places.store.PlaceStore.Place;
import com.microboxlabs.miot.places.store.PlaceStore.PlaceVersion;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgConnectOptions;
import io.vertx.sqlclient.PoolOptions;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/**
 * The places migration, store and service on real PostgreSQL. The migration runs in a scratch schema that stands in
 * for {@code miot_places}, so a database the modulith already migrated is left alone. Skipped unless
 * {@code -Dmiot.places.test.pg-url=…} is set.
 */
@EnabledIfSystemProperty(named = "miot.places.test.pg-url", matches = ".+")
class PgPlaceStoreTest {

    private static final Duration TIMEOUT = Duration.ofSeconds(10);
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final String TENANT = "acme-client";
    private static final String ACTOR = "ana@example.com";
    private static final String SQUARE = """
            {"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[-70,-33],[-70,-32],[-69,-32],[-70,-33]]]},
             "properties":{}}""";
    private static final String CIRCLE = """
            {"type":"Feature","geometry":{"type":"Point","coordinates":[-70,-33]},"properties":{"radius_m":20}}""";
    private static final String LINE = """
            {"type":"Feature","geometry":{"type":"LineString","coordinates":[[-70,-33],[-69,-32]]},"properties":{}}""";

    private Vertx vertx;
    private Pool pool;
    private String schema;
    private PgPlaceStore store;
    private PlaceService service;

    @BeforeEach
    void setup() throws IOException {
        vertx = Vertx.vertx();
        pool = PgBuilder.pool().connectingTo(PgConnectOptions.fromUri(System.getProperty("miot.places.test.pg-url")))
                .with(new PoolOptions().setMaxSize(2)).using(vertx).build();
        schema = "cert_places_" + UUID.randomUUID().toString().replace("-", "");
        try (InputStream in = getClass().getResourceAsStream("/db/migration/places/V0.13.0__create_places.sql")) {
            String migration = new String(in.readAllBytes(), StandardCharsets.UTF_8).replace("miot_places", schema);
            pool.query(migration).execute().await().atMost(TIMEOUT);
        }
        store = new PgPlaceStore(() -> pool, schema);
        service = new PlaceService(store, new PgTransactions(() -> pool));
    }

    @AfterEach
    void cleanup() {
        if (pool != null) {
            pool.query("DROP SCHEMA IF EXISTS " + schema + " CASCADE").execute().await().atMost(TIMEOUT);
            pool.closeAndAwait();
        }
        if (vertx != null) vertx.closeAndAwait();
    }

    private static JsonNode json(String text) {
        try {
            return MAPPER.readTree(text);
        } catch (IOException e) {
            throw new IllegalArgumentException(e);
        }
    }

    private static PlaceRequest request(String kind, String code, String name, String geojson) {
        return new PlaceRequest(kind, null, code, name, "hi2-building", null, null,
                new PlaceRequest.Categories("categorias_lugar", List.of("planta")), null,
                json(geojson), null, null, null, null, null);
    }

    private static PlaceRequest geofence(String code, String name, List<PlaceRequest> inners, VersionRequest v) {
        return new PlaceRequest("geofence", null, code, name, null, null, null, null, null, json(SQUARE),
                null, null, null, inners, v);
    }

    private static PlaceRequest inner(UUID id, String name) {
        return new PlaceRequest(null, null, "IN-" + name, name, null, null, null, null, null, json(CIRCLE), null, null,
                id == null ? null : id.toString(), null, null);
    }

    private static VersionRequest version(String bump) {
        return new VersionRequest(bump, "Ajuste", List.of("Nombre cambiado"));
    }

    private Place insertRaw(String kind, UUID parent, String name, String geojson) {
        return insertRaw(kind, parent, UUID.randomUUID().toString(), name, geojson);
    }

    private Place insertRaw(String kind, UUID parent, String code, String name, String geojson) {
        return store.insert(new Place(null, TENANT, kind, parent, code, name, null, null, null, null, "{}",
                geojson, null, null, PlaceStore.INNER_GEOFENCE.equals(kind) ? null : "1.0.0", null,
                ACTOR, null, null));
    }

    private List<Row> rows(String where, Tuple params) {
        List<Row> out = new ArrayList<>();
        pool.preparedQuery("SELECT name, is_active, current_version, ST_Area(geom) AS area FROM " + schema
                + ".place WHERE " + where).execute(params).await().atMost(TIMEOUT).forEach(out::add);
        return out;
    }

    @Test
    void acceptsTheSameTenantClientIdLengthAsCoreOrganizations() {
        String tenant = "t".repeat(255);
        PlaceService.Saved saved = service.create(tenant,
                geofence("EXAMPLE", "Example yard", List.of(), null), ACTOR);

        assertEquals(tenant, service.get(tenant, saved.place().id()).tenantCode());
        assertEquals(1, service.versions(tenant, saved.place().id()).size());
        assertTrue(service.list(TENANT, null, null, null, null, null).isEmpty());
    }

    @Test
    void savesReadsAndListsAGeofenceWithItsInnerGeofencesAndARoute() {
        PlaceService.Saved planta = service.create(TENANT,
                geofence("SCL", "Planta", List.of(inner(null, "Andén")), null), ACTOR);
        service.create(TENANT, request("route", "R68", "Ruta 68", LINE), ACTOR);
        service.create("other-client", request("geofence", "SCL", "Ajena", SQUARE), ACTOR);

        PlaceService.Saved read = service.getWithInners(TENANT, planta.place().id());
        assertEquals("SCL", read.place().externalCode());
        assertEquals(ACTOR, read.place().createdBy());
        assertEquals("1.0.0", read.place().currentVersion());
        assertNull(read.place().categoriesJson(), "without categories, null");
        Place otra = service.list("other-client", null, null, null, null, null).get(0);
        assertEquals("categorias_lugar", json(otra.categoriesJson()).path("selectable").asText());
        assertEquals("planta", json(otra.categoriesJson()).path("values").get(0).asText());
        assertEquals(List.of("Andén"), read.inners().stream().map(Place::name).toList());

        assertEquals(3, service.list(TENANT, null, null, null, null, null).size());
        assertEquals(List.of("Ruta 68"),
                service.list(TENANT, "route", null, "68", null, null).stream().map(Place::name).toList());
        double circle = rows("id = $1", Tuple.of(read.inners().get(0).id())).get(0).getDouble("area");
        assertEquals(Math.PI * 20 * 20, circle, Math.PI * 20 * 20 * 0.01, "a 20 m circle, within 1%");
    }

    @Test
    void everyEditIsAVersionWithThePlaceAsSaved() {
        PlaceService.Saved planta = service.create(TENANT,
                geofence("SCL", "Planta", List.of(inner(null, "Andén 1"), inner(null, "Andén 2")), null), ACTOR);
        UUID anden1 = planta.inners().get(0).id();

        PlaceService.Saved edited = service.update(TENANT, planta.place().id(), geofence("SCL", "Planta Norte",
                List.of(inner(anden1, "Andén 1"), inner(null, "Andén 3")), version("MINOR")), "luis@example.com");
        service.update(TENANT, planta.place().id(), geofence("SCL", "Planta Norte", null, version("MAJOR")), ACTOR);

        assertEquals("1.1.0", edited.place().currentVersion());
        assertEquals("luis@example.com", edited.place().updatedBy());
        List<PlaceVersion> versions = service.versions(TENANT, planta.place().id());
        assertEquals(List.of("1.0.0", "1.1.0", "2.0.0"), versions.stream().map(PlaceVersion::version).toList());
        assertEquals("MINOR", versions.get(1).bump());
        assertEquals("luis@example.com", versions.get(1).createdBy());
        JsonNode snapshot = json(versions.get(1).snapshotJson());
        assertEquals("Planta Norte", snapshot.path("name").asText());
        assertEquals(2, snapshot.path("inners").size());
        // the place table holds only what is current: the dropped inner geofence is deactivated, not archived
        assertEquals(1, rows("parent_id = $1 AND NOT is_active", Tuple.of(planta.place().id())).size());
        assertEquals(4, rows("tenant_code = $1", Tuple.of(TENANT)).size());
    }

    @Test
    void deletingAGeofenceDeletesItsInnerGeofencesAndFreesItsCode() {
        PlaceService.Saved planta = service.create(TENANT,
                geofence("SCL", "Planta", List.of(inner(null, "Andén")), null), ACTOR);

        service.delete(TENANT, "scl", ACTOR);

        assertTrue(service.list(TENANT, null, null, null, null, null).isEmpty());
        assertEquals(2, rows("id = ANY($1) AND NOT is_active",
                Tuple.of(new UUID[] {planta.place().id(), planta.inners().get(0).id()})).size(), "a delete is logical");
        assertTrue(store.findByCode(TENANT, "scl").isEmpty());
        Place nueva = service.create(TENANT, request("geofence", "scl", "Planta nueva", SQUARE), ACTOR).place();
        assertEquals(nueva.id(), store.findByCode(TENANT, "SCL").orElseThrow().id());
        assertTrue(store.findByCode("other-client", "SCL").isEmpty());
        var request = request("geofence", "SCL", "Repetida", SQUARE);
        assertThrows(IllegalStateException.class, () -> service.create(TENANT, request, ACTOR));
    }

    @Test
    void theDatabaseHoldsTheRulesToo() {
        Place planta = service.create(TENANT, request("geofence", "SCL", "Planta", SQUARE), ACTOR).place();
        var request = request("geofence", "SCL", "Repetida", SQUARE);
        assertThrows(IllegalStateException.class, () -> service.create(TENANT, request, ACTOR));
        var request2 = request("geofence", "scl", "Repetida en minúsculas", SQUARE);
        assertThrows(IllegalStateException.class, () -> service.create(TENANT, request2, ACTOR));
        // another organization can have the same code
        service.create("other-client", request("geofence", "SCL", "Ajena", SQUARE), ACTOR);
        // a code is the organization's, whatever the kind, as client_geofence_id is in the GPS
        var request3 = request("route", "SCL", "Ruta SCL", LINE);
        assertThrows(IllegalStateException.class, () -> service.create(TENANT, request3, ACTOR));
        // the same version twice
        var placeVersion = new PlaceVersion(null, planta.id(),
                TENANT, "1.0.0", null, null, "[]", "{}", ACTOR, null);
        assertThrows(IllegalStateException.class, () -> store.insertVersion(placeVersion));

        String point = """
                {"type":"Feature","geometry":{"type":"Point","coordinates":[-70,-33]},"properties":{"radius_m":20}}""";
        String circleWithoutRadius = """
                {"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[-70,-33],[-70,-32],[-69,-32],[-70,-33]]]},
                 "properties":{"shape":"circle","center":[-70,-33]}}""";
        String bowtie = """
                {"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[-70,-33],[-69,-32],[-69,-33],[-70,-32],[-70,-33]]]},
                 "properties":{}}""";
        String polygon = """
                {"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[-70,-33],[-70,-32],[-69,-32],[-70,-33]]]},
                 "properties":{}}""";
        assertThrows(IllegalArgumentException.class, () -> insertRaw("geofence", null, "Punto", point));
        assertThrows(IllegalArgumentException.class,
                () -> insertRaw("geofence", null, "Círculo sin radio", circleWithoutRadius));
        var plantaId = planta.id();
        assertThrows(IllegalArgumentException.class, () -> insertRaw("route", plantaId, "Ruta con padre", LINE));
        assertThrows(IllegalArgumentException.class, () -> insertRaw("inner_geofence", null, "Huérfana", polygon));
        assertThrows(IllegalArgumentException.class, () -> insertRaw("route", null, "Ruta polígono", SQUARE));
        assertThrows(IllegalArgumentException.class, () -> insertRaw("geofence", null, "Moño", bowtie));
        for (String bad : List.of("{}", "[\"planta\"]", "{\"selectable\":\"lista\",\"values\":[]}",
                "{\"selectable\":\" \",\"values\":[\"planta\"]}", "{\"values\":[\"planta\"]}")) {
            var place = new Place(null, TENANT, "route", null,
                    UUID.randomUUID().toString(), "Ruta", null, null, null, bad, "{}", LINE, null, null, "1.0.0", null,
                    ACTOR, null, null);
            assertThrows(IllegalArgumentException.class, () -> store.insert(place), bad);
        }
        assertThrows(IllegalArgumentException.class, () -> insertRaw("geofence", null, null, "Sin código", SQUARE));
        assertThrows(IllegalArgumentException.class, () -> insertRaw("route", null, null, "Ruta sin código", LINE));
        var plantaId2 = planta.id();
        assertThrows(IllegalArgumentException.class,
                () -> insertRaw("inner_geofence", plantaId2, null, "Interior sin código", SQUARE));
        assertThrows(IllegalArgumentException.class,
                () -> insertRaw("geofence", null, " SCL2", "Con espacio", SQUARE));
        assertThrows(IllegalArgumentException.class, () -> insertRaw("geofence", null, "   ", SQUARE));
    }

    @Test
    void aSyncedPlaceCanBeMadePendingAgainWithoutBeingEdited() {
        Place anf = service.create(TENANT, request("geofence", "ANF", "Antofagasta", SQUARE), ACTOR).place();
        assertTrue(store.markSynced(anf, false));
        assertEquals(List.of(), store.pending(100));

        store.markPending(anf);

        assertEquals(List.of("ANF"), store.pending(100).stream().map(p -> p.place().externalCode()).toList());
        assertEquals(anf.updatedAt(), service.get(TENANT, anf.id()).updatedAt(), "it is not an edit");
    }

    @Test
    void pendingAreTheGeofencesAndInnerGeofencesStreamHubLacksDeletionsFirst() {
        PlaceService.Saved planta = service.create(TENANT,
                geofence("SCL", "Planta", List.of(inner(null, "Andén")), null), ACTOR);
        service.create(TENANT, request("route", "R68", "Ruta 68", LINE), ACTOR);
        Place anf = service.create(TENANT, request("geofence", "ANF", "Antofagasta", SQUARE), ACTOR).place();
        service.delete(TENANT, "ANF", ACTOR);

        List<PlaceStore.Pending> pending = store.pending(100);
        assertEquals(3, pending.size(), "a route is never pending");
        assertEquals("ANF", pending.get(0).place().externalCode());
        assertTrue(pending.get(0).deleted());
        assertEquals(Set.of("SCL", "IN-Andén"),
                pending.subList(1, 3).stream().map(p -> p.place().externalCode()).collect(Collectors.toSet()));

        Place scl = planta.place();
        assertTrue(store.markSynced(scl, false));
        assertTrue(store.markSynced(anf, true));
        assertEquals(scl.updatedAt(), service.get(TENANT, scl.id()).updatedAt(), "marking is not an edit");
        assertEquals(List.of("IN-Andén"), store.pending(100).stream().map(p -> p.place().externalCode()).toList());

        Place anden = planta.inners().get(0);
        service.update(TENANT, scl.id(), geofence("SCL", "Planta Norte", List.of(inner(anden.id(), "Andén")),
                version("PATCH")), ACTOR);
        assertFalse(store.markSynced(anden, false), "edited since it was read: it stays pending");
        assertEquals(Set.of("SCL", "IN-Andén"),
                store.pending(100).stream().map(p -> p.place().externalCode()).collect(Collectors.toSet()));
    }
}
