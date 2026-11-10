package com.microboxlabs.miot.places.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.places.dto.PlaceRequest;
import com.microboxlabs.miot.places.dto.PlaceRequest.VersionRequest;
import com.microboxlabs.miot.places.store.InMemoryPlaceStore;
import com.microboxlabs.miot.places.store.PlaceStore.Place;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;

/** Every place a write touches reaches {@link PlaceSync} by its organization and code, once the write commits. */
class PlaceSyncTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final String TENANT = "acme-client";
    private static final String ACTOR = "ana@example.com";
    private static final String SQUARE = """
            {"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[-70,-33],[-70,-32],[-69,-32],[-70,-33]]]},
             "properties":{}}""";
    private static final String CIRCLE = """
            {"type":"Feature","geometry":{"type":"Point","coordinates":[-70,-33]},"properties":{"radius_m":20}}""";
    private static final String LINE = """
            {"type":"Feature","geometry":{"type":"LineString","coordinates":[[-70,-33],[-69,-32]]}}""";

    private final List<String> heard = new ArrayList<>();
    private boolean failing;
    /** Runs once, while a copy is in StreamHub's hands: another write landing meanwhile. */
    private Runnable meanwhile;
    private final PlaceSync recorder = new PlaceSync() {
        @Override
        public void saved(String tenantCode, String externalCode, Place place) {
            heard.add("saved " + place.kind() + " " + tenantCode + "/" + externalCode);
            if (meanwhile != null) {
                Runnable other = meanwhile;
                meanwhile = null;
                other.run();
            }
            if (failing) {
                throw new IllegalStateException("StreamHub is down");
            }
        }

        @Override
        public void deleted(String tenantCode, String externalCode, Place place) {
            heard.add("deleted " + place.kind() + " " + tenantCode + "/" + externalCode);
            if (meanwhile != null) {
                Runnable other = meanwhile;
                meanwhile = null;
                other.run();
            }
            if (failing) {
                throw new IllegalStateException("StreamHub is down");
            }
        }
    };
    private final InMemoryPlaceStore store = new InMemoryPlaceStore();
    private final PlaceService service = new PlaceService(store, Transactions.none(), recorder);

    private static JsonNode json(String text) {
        try {
            return MAPPER.readTree(text);
        } catch (Exception e) {
            throw new IllegalArgumentException(e);
        }
    }

    private static PlaceRequest geofence(List<PlaceRequest> inners, VersionRequest version) {
        return new PlaceRequest("geofence", null, "SCL", "Planta", null, null, null, null, null, json(SQUARE), null,
                null, null, inners, version);
    }

    private static PlaceRequest inner(UUID id, String code) {
        return new PlaceRequest(null, null, code, code, null, null, null, null, null, json(CIRCLE), null, null,
                id == null ? null : id.toString(), null, null);
    }

    private static PlaceRequest route(String code, VersionRequest version) {
        return new PlaceRequest("route", null, code, "Ruta", null, null, null, null, null, json(LINE), null, null,
                null, null, version);
    }

    private static VersionRequest patch() {
        return new VersionRequest("PATCH", "Ajuste", List.of());
    }

    @Test
    void aCopyOverwrittenByAnOlderOneStaysPending() {
        Place planta = service.create(TENANT, geofence(null, null), ACTOR).place();
        UUID id = planta.id();
        // a newer edit lands, and is copied and marked, while the older one's copy is still being written
        meanwhile = () -> service.update(TENANT, id, geofence(null, patch()), ACTOR);

        service.update(TENANT, id, geofence(null, patch()), ACTOR);

        assertEquals(List.of(id), store.pending(100).stream().map(p -> p.place().id()).toList(),
                "StreamHub may hold the older version: the current one is copied again");
        assertEquals(1, service.retryPending(100));
        assertEquals(List.of(), store.pending(100));
    }

    @Test
    void anOldSaveThatOvertakesANewOwnersCopyLeavesTheNewOwnerPending() {
        Place previous = service.create(TENANT, geofence(null, null), ACTOR).place();
        meanwhile = () -> {
            service.delete(TENANT, "SCL", ACTOR);
            service.create(TENANT, geofence(null, null), ACTOR);
        };

        service.update(TENANT, previous.id(), geofence(null, patch()), ACTOR);

        UUID newOwner = store.findByCode(TENANT, "SCL").orElseThrow().id();
        assertTrue(store.pending(100).stream().anyMatch(p -> p.place().id().equals(newOwner)),
                "the stale save may have replaced the new owner's copy");
        service.retryPending(100);
        assertEquals(List.of(), store.pending(100));
    }

    @Test
    void anOldDeleteThatOvertakesANewOwnersCopyNeedsNoRepair() {
        service.create(TENANT, geofence(null, null), ACTOR);
        meanwhile = () -> service.create(TENANT, geofence(null, null), ACTOR);

        service.delete(TENANT, "SCL", ACTOR);

        UUID newOwner = store.findByCode(TENANT, "SCL").orElseThrow().id();
        assertTrue(store.find(TENANT, newOwner).isPresent());
        assertEquals(0, service.retryPending(100));
        assertEquals(List.of(), store.pending(100));
    }

    @Test
    void aDeleteStillReachesStreamHubWhenTheCodeComesBackInAnotherCase() {
        service.create(TENANT, geofence(null, null), ACTOR);
        failing = true;
        service.delete(TENANT, "SCL", ACTOR);
        failing = false;
        service.create(TENANT, new PlaceRequest("geofence", null, "scl", "Planta", null, null, null, null, null,
                json(SQUARE), null, null, null, null, null), ACTOR);
        heard.clear();

        service.retryPending(100);

        assertTrue(heard.contains("deleted geofence acme-client/SCL"),
                "StreamHub's key is case sensitive: 'scl' is another row, so 'SCL' is removed");
    }

    @Test
    void createHearsTheGeofenceAndEachInnerGeofence() {
        service.create(TENANT, geofence(List.of(inner(null, "AND-1"), inner(null, "PAT-1")), null), ACTOR);

        assertEquals(List.of("saved geofence acme-client/SCL", "saved inner_geofence acme-client/AND-1",
                "saved inner_geofence acme-client/PAT-1"), heard);
    }

    @Test
    void anEditHearsTheInnerGeofencesItDropsSavesAndAdds() {
        PlaceService.Saved planta = service.create(TENANT,
                geofence(List.of(inner(null, "AND-1"), inner(null, "PAT-1")), null), ACTOR);
        UUID anden = planta.inners().get(0).id();
        heard.clear();

        service.update(TENANT, planta.place().id(), geofence(List.of(inner(anden, "AND-1"), inner(null, "PAT-2")),
                patch()), ACTOR);

        assertEquals(List.of("saved geofence acme-client/SCL", "deleted inner_geofence acme-client/PAT-1",
                "saved inner_geofence acme-client/AND-1", "saved inner_geofence acme-client/PAT-2"), heard);
    }

    @Test
    void anEditWithoutInnersLeavesThemUnheard() {
        PlaceService.Saved planta = service.create(TENANT, geofence(List.of(inner(null, "AND-1")), null), ACTOR);
        heard.clear();

        service.update(TENANT, planta.place().id(), geofence(null, patch()), ACTOR);

        assertEquals(List.of("saved geofence acme-client/SCL"), heard);
    }

    @Test
    void aRouteWhoseCodeChangesLetsGoOfTheOldOne() {
        Place ruta = service.create(TENANT, route("RUTA-1", null), ACTOR).place();
        heard.clear();

        service.update(TENANT, ruta.id(), route("RUTA-2", patch()), ACTOR);

        assertEquals(List.of("deleted route acme-client/RUTA-1", "saved route acme-client/RUTA-2"), heard);
    }

    @Test
    void deletingAGeofenceDeletesEachInnerGeofenceByItsCode() {
        service.create(TENANT, geofence(List.of(inner(null, "AND-1"), inner(null, "PAT-1")), null), ACTOR);
        heard.clear();

        service.delete(TENANT, "scl", ACTOR);

        assertEquals(List.of("deleted inner_geofence acme-client/AND-1", "deleted inner_geofence acme-client/PAT-1",
                "deleted geofence acme-client/SCL"), heard);
        assertTrue(store.findByCode(TENANT, "AND-1").isEmpty());
    }

    @Test
    void aFailedWriteIsNeverHeard() {
        // the geofence is inserted, then its inner geofences fail: the write rolls back
        var request = geofence(List.of(inner(UUID.randomUUID(), "AJENA")), null);
        assertThrows(IllegalArgumentException.class, () -> service.create(TENANT, request, ACTOR));
        assertThrows(java.util.NoSuchElementException.class, () -> service.delete(TENANT, "NO-EXISTE", ACTOR));

        assertEquals(List.of(), heard);
    }

    @Test
    void aSyncThatFailsDoesNotUndoTheWrite() {
        failing = true;

        PlaceService.Saved planta = service.create(TENANT, geofence(List.of(inner(null, "AND-1")), null), ACTOR);

        assertEquals(2, heard.size(), "the next place is still heard");
        assertEquals(planta.place().id(), store.findByCode(TENANT, "SCL").orElseThrow().id());
    }

    @Test
    void aBusyReplicaLeavesBothApiWritesAndRetriesPending() {
        boolean[] busy = {true};
        InMemoryPlaceStore shared = new InMemoryPlaceStore() {
            @Override
            public <T> Optional<T> syncExclusively(Supplier<T> work) {
                return busy[0] ? Optional.empty() : Optional.ofNullable(work.get());
            }
        };
        PlaceService api = new PlaceService(shared, Transactions.none(), recorder);
        api.create(TENANT, geofence(null, null), ACTOR);
        assertEquals(0, api.retryPending(100));
        assertEquals(List.of(), heard);
        assertEquals(1, shared.pending(100).size());
        busy[0] = false;
        assertEquals(1, api.retryPending(100));
        assertEquals(0, api.retryPending(100));
        assertEquals(1, heard.size());
    }

    @Test
    void aSyncThatWorksLeavesNothingPendingButRoutesAreNeverMarked() {
        service.create(TENANT, geofence(List.of(inner(null, "AND-1")), null), ACTOR);
        service.create(TENANT, route("RUTA-1", null), ACTOR);
        service.delete(TENANT, "RUTA-1", ACTOR);

        assertEquals(List.of(), store.pending(100));
    }

    @Test
    void theRetryCopiesWhatFailedDeletionsFirst() {
        failing = true;
        service.create(TENANT, geofence(List.of(inner(null, "AND-1")), null), ACTOR);
        service.create(TENANT, new PlaceRequest("geofence", null, "ANF", "Antofagasta", null, null, null, null, null,
                json(SQUARE), null, null, null, null, null), ACTOR);
        service.delete(TENANT, "ANF", ACTOR);
        assertEquals(3, store.pending(100).size());
        failing = false;
        heard.clear();

        assertEquals(3, service.retryPending(100));

        assertEquals(List.of("deleted geofence acme-client/ANF", "saved geofence acme-client/SCL",
                "saved inner_geofence acme-client/AND-1"), heard);
        assertEquals(List.of(), store.pending(100));
        assertEquals(0, service.retryPending(100));
    }

    @Test
    void aDeletionWhoseCodeIsTakenAgainStillDeletesByItsSourceId() {
        service.create(TENANT, geofence(null, null), ACTOR);
        failing = true;
        service.delete(TENANT, "SCL", ACTOR);
        failing = false;
        // The old UUID is still deleted; the GPS predicate protects the new owner's copy.
        service.create(TENANT, geofence(null, null), ACTOR);
        heard.clear();

        assertEquals(1, service.retryPending(100));

        assertEquals(List.of("deleted geofence acme-client/SCL"), heard);
        assertEquals(List.of(), store.pending(100));
    }

    @Test
    void aPendingReplacementNeverHidesThePreviousOwnersFailedDelete() {
        Map<String, UUID> gpsRows = new HashMap<>();
        boolean[] failures = {false, false}; // saves, deletes
        PlaceSync owned = new PlaceSync() {
            @Override
            public void saved(String tenant, String code, Place place) {
                if (failures[0]) throw new IllegalStateException("GPS save failed");
                gpsRows.put(code, place.id());
            }

            @Override
            public void deleted(String tenant, String code, Place place) {
                if (failures[1]) throw new IllegalStateException("GPS delete failed");
                gpsRows.remove(code, place.id());
            }
        };
        PlaceService writer = new PlaceService(store, Transactions.none(), owned);
        Place previous = writer.create(TENANT, geofence(null, null), ACTOR).place();
        failures[1] = true;
        writer.delete(TENANT, "SCL", ACTOR);
        failures[0] = true;
        Place replacement = writer.create(TENANT, geofence(null, null), ACTOR).place();
        assertEquals(previous.id(), gpsRows.get("SCL"));
        failures[1] = false;

        assertEquals(1, writer.retryPending(100));

        assertTrue(gpsRows.isEmpty(), "the previous owner's row must be removed even while its code is reused");
        assertEquals(List.of(replacement.id()), store.pending(100).stream().map(p -> p.place().id()).toList());
        writer.delete(TENANT, "SCL", ACTOR);
        assertTrue(gpsRows.isEmpty());
        assertTrue(store.pending(100).isEmpty());
    }

    @Test
    void whileNothingReallyCopiesEveryPlaceStaysPending() {
        PlaceSync off = new PlaceSync() {
            @Override
            public void saved(String tenantCode, String externalCode, Place place) {
                heard.add("saved " + externalCode);
            }

            @Override
            public void deleted(String tenantCode, String externalCode, Place place) {
                heard.add("deleted " + externalCode);
            }

            @Override
            public boolean copies() {
                return false;
            }
        };
        PlaceService stub = new PlaceService(store, Transactions.none(), off);

        stub.create(TENANT, geofence(List.of(inner(null, "AND-1")), null), ACTOR);

        assertEquals(List.of(), heard, "nothing is called while it does not copy");
        assertEquals(2, store.pending(100).size());
        assertEquals(0, stub.retryPending(100));
        assertEquals(2, store.pending(100).size(), "left for the sync that will copy");
    }
}
