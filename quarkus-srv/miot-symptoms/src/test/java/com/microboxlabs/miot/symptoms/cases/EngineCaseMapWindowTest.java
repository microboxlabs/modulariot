package com.microboxlabs.miot.symptoms.cases;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.microboxlabs.miot.symptoms.events.SymptomEvents;
import com.microboxlabs.miot.symptoms.map.TripWindows;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** The map's range in the treatment page's header: the case's trip, and the case's own time to highlight. */
class EngineCaseMapWindowTest {

    private static final String TENANT = "tenant-demo";
    private static final String TRIP = UUID.randomUUID().toString();
    private static final Instant DEPARTED = Instant.parse("2026-10-21T20:00:00Z");
    private static final Instant OPENED = Instant.parse("2026-10-22T05:40:00Z");
    private static final Instant NOW = OPENED.plus(Duration.ofMinutes(30));

    private final InMemoryEngineCases store = new InMemoryEngineCases();

    private EngineCaseService service(EngineCaseService.TripTracks tracks) {
        return new EngineCaseService(store, (t, a, d) -> { }, t -> null, Clock.fixed(NOW, ZoneOffset.UTC),
                SymptomEvents.NONE, EngineCaseService.Vehicles.NONE, tracks);
    }

    private static EngineCase onTrip(String tripId) {
        return new EngineCase(12, UUID.randomUUID(), "0.1.0", "Descanso", "driving", "vehicle-demo", OPENED, 2,
                tripId, null, null, null, null, 0, 2, null);
    }

    @Test
    void aCaseOnATripDrawsTheWholeTripAndKeepsItsOwnWindow() {
        store.add(onTrip(TRIP));
        EngineCaseService service = service((tenant, trip, asset) -> TRIP.equals(trip) && "vehicle-demo".equals(asset)
                ? Optional.of(new TripWindows.Window(DEPARTED, NOW))
                : Optional.empty());

        JsonNode map = service.header(TENANT, -12).path("map_window");

        assertTrue(map.path("on_trip").asBoolean());
        assertEquals(DEPARTED.toString(), map.path("track_from").asText());
        assertEquals(NOW.toString(), map.path("track_to").asText());
        assertEquals(OPENED.toString(), map.path("case_from").asText());
        assertEquals(NOW.toString(), map.path("case_to").asText());
        EngineCaseService.SignalWindow positions = service.signalWindow(TENANT, -12);
        assertEquals(new EngineCaseService.SignalWindow("vehicle-demo", DEPARTED, NOW, true), positions,
                "the positions the map reads are the header's track");
    }

    @Test
    void aCaseWithoutATripDrawsItsOwnWindow() {
        store.add(onTrip(null));
        EngineCaseService service = service((tenant, trip, asset) -> {
            throw new AssertionError("no trip to read");
        });

        JsonNode header = service.header(TENANT, -12);
        JsonNode map = header.path("map_window");

        assertFalse(map.path("on_trip").asBoolean());
        assertEquals(OPENED.minus(EngineCaseService.SIGNALS_BEFORE).toString(), map.path("track_from").asText());
        assertEquals(NOW.toString(), map.path("track_to").asText());
        assertEquals(OPENED.toString(), map.path("case_from").asText());
        assertEquals(header.path("timeline").get(0).path("start").asText(), map.path("case_from").asText(),
                "the timeline entry keeps the case window");
    }

    @Test
    void aTripWithoutARangeOrThatFailsToReadFallsBackToTheCaseWindow() {
        store.add(onTrip(TRIP));

        JsonNode unknown = service(EngineCaseService.TripTracks.NONE).header(TENANT, -12).path("map_window");
        JsonNode failing = service((tenant, trip, asset) -> {
            throw new IllegalStateException("down");
        }).header(TENANT, -12).path("map_window");

        for (JsonNode map : new JsonNode[] {unknown, failing}) {
            assertFalse(map.path("on_trip").asBoolean());
            assertEquals(OPENED.minus(EngineCaseService.SIGNALS_BEFORE).toString(), map.path("track_from").asText());
        }
    }

    @Test
    void theTrackStillCoversACaseThatOutlastsTheTrip() {
        store.add(onTrip(TRIP));
        Instant ended = OPENED.plus(Duration.ofMinutes(10));
        EngineCaseService service = service(
                (tenant, trip, asset) -> Optional.of(new TripWindows.Window(DEPARTED, ended)));

        EngineCaseService.SignalWindow w = service.signalWindow(TENANT, -12);

        assertEquals(DEPARTED, w.from());
        assertEquals(NOW, w.to(), "the open case runs past the trip's end");
    }
}
