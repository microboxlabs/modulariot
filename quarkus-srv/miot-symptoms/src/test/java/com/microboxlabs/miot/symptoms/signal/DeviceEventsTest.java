package com.microboxlabs.miot.symptoms.signal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.symptoms.signal.DeviceEvents.Accepted;
import com.microboxlabs.miot.symptoms.signal.DeviceEvents.DeviceEvent;
import com.microboxlabs.miot.symptoms.signal.DeviceEvents.Request;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class DeviceEventsTest {

    private static final String TENANT = "tenant-a";
    private static final Instant NOW = Instant.parse("2026-10-01T15:10:00Z");
    private static final OffsetDateTime AT = OffsetDateTime.parse("2026-10-01T12:00:00-03:00");
    private static final ObjectMapper JSON = new ObjectMapper();

    /** Ids in memory. */
    private static final class Ids implements DeviceEvents.Seen {
        final Set<String> kept = new HashSet<>();

        @Override
        public synchronized boolean publishIfNew(String tenant, String eventId, DeviceEvent event, Runnable publish) {
            if (kept.contains(tenant + "/" + eventId)) {
                return false;
            }
            publish.run();
            return kept.add(tenant + "/" + eventId);
        }
    }

    /** Keeps what it publishes; fails when told to. */
    private static final class Channel extends DeviceSignalChannel {
        final List<String> keys = new ArrayList<>();
        final List<String> published = new ArrayList<>();
        boolean fail;

        @Override
        public void publish(String assetId, String json) {
            if (fail) {
                throw new DeviceEvents.UnavailableException("down");
            }
            keys.add(assetId);
            published.add(json);
        }
    }

    private final Ids ids = new Ids();
    private final Channel channel = new Channel();
    private final List<ReferenceCache.Trip> trips = new ArrayList<>();
    private final DeviceEvents events = new DeviceEvents(true, ids, (tenant, asset) -> trips.stream()
            .filter(t -> t.tenant().equals(tenant) && t.assetId().equals(asset)).toList(), channel,
            Clock.fixed(NOW, ZoneOffset.UTC), () -> null);

    private static DeviceEvent event(String id, String type, String code) {
        return new DeviceEvent(id, "ABCD12", type, AT, code, null, null);
    }

    private static Request request(DeviceEvent... e) {
        return new Request(List.of(e));
    }

    private static Map<String, Object> read(String json) throws Exception {
        return JSON.readValue(json, new TypeReference<>() {
        });
    }

    @Test
    void anEventBecomesASignalOfItsOrganizationKeyedByVehicle() throws Exception {
        Accepted a = events.accept(TENANT, request(new DeviceEvent("app-1", " ABCD12 ", "Emergencia", AT, null,
                "high", "Botón de la aplicación")));

        assertEquals(new Accepted(1, 0), a);
        assertEquals(List.of("ABCD12"), channel.keys);
        Map<String, Object> signal = read(channel.published.get(0));
        assertEquals(GpsSignal.EVENTS_SCHEMA_ID, signal.get("schema"));
        assertEquals("2026-10-01T15:00:00Z", signal.get("at"));
        assertEquals(List.of(TENANT), signal.get("clients"));
        assertFalse(signal.containsKey("trips"), "no trip in progress");
        Map<?, ?> frame = (Map<?, ?>) signal.get("frame");
        assertFalse(frame.containsKey("gps"), "no position: trip geofences skip it");
        assertEquals(List.of(Map.of("event_type", "Emergencia", "timestamp", "2026-10-01T15:00:00Z",
                "severity", "high", "description", "Botón de la aplicación")), frame.get("events"));
    }

    @Test
    void theOrganizationsTripInProgressGoesWithTheEvent() throws Exception {
        trips.add(new ReferenceCache.Trip("T-1", TENANT, "ABCD12", "v", "IN_PROGRESS",
                NOW.minusSeconds(7200), null, false));
        trips.add(new ReferenceCache.Trip("T-2", TENANT, "ABCD12", "v", "SCHEDULED", NOW.plusSeconds(3600), null,
                false));

        events.accept(TENANT, request(event("cam-1", "FYS", "109")));

        Map<?, ?> trip = (Map<?, ?>) ((Map<?, ?>) read(channel.published.get(0)).get("trips")).get(TENANT);
        assertEquals("T-1", trip.get("id"));
        assertEquals(true, trip.get("active"));
        assertEquals(110.0, trip.get("age_min"), "timed against the event");
    }

    @Test
    void aRepeatedIdIsAcceptedButNotSentAgain() {
        events.accept(TENANT, request(event("app-1", "Emergencia", null)));

        assertEquals(new Accepted(0, 2), events.accept(TENANT,
                request(event("app-1", "Emergencia", null), event("app-1", "Emergencia", null))));
        assertEquals(1, channel.published.size());
        assertEquals(new Accepted(1, 0), events.accept("tenant-b", request(event("app-1", "Emergencia", null))),
                "ids are per organization");
    }

    @Test
    void withoutAnIdTheSameFactIsRecognised() {
        events.accept(TENANT, request(event(null, "FYSS", "111")));
        events.accept(TENANT, request(new DeviceEvent(null, "ABCD12", "FYSS",
                AT.withOffsetSameInstant(ZoneOffset.UTC), "111", null, null)));

        assertEquals(1, channel.published.size(), "the same instant in another offset is the same event");
        String id = DeviceEvents.eventId(event(null, "FYSS", "111"));
        assertTrue(id.startsWith("derived:"));
        assertNotEquals(id, DeviceEvents.eventId(event(null, "FYSS", "112")));
    }

    @Test
    void separatorsInProducerFieldsCannotAliasAnotherDerivedId() {
        DeviceEvent first = new DeviceEvent(null, "A\nB", "C", AT, null, null, null);
        DeviceEvent second = new DeviceEvent(null, "A", "B\nC", AT, null, null, null);
        assertNotEquals(DeviceEvents.eventId(first), DeviceEvents.eventId(second));
    }

    @Test
    void aFailedPublicationForgetsTheIdSoTheProducerCanRetry() {
        channel.fail = true;
        Request emergency = request(event("app-1", "Emergencia", null));
        assertThrows(DeviceEvents.UnavailableException.class,
                () -> events.accept(TENANT, emergency));
        assertTrue(ids.kept.isEmpty());

        channel.fail = false;
        assertEquals(new Accepted(1, 0), events.accept(TENANT, request(event("app-1", "Emergencia", null))));
    }

    @Test
    void everyEventIsCheckedBeforeAnyIsSent() {
        IllegalArgumentException e = assertInvalid(request(event("ok", "AAS", null),
                new DeviceEvent("bad", "ABCD12", " ", AT, null, null, null)));
        assertEquals("events[1].type is required", e.getMessage());
        assertTrue(channel.published.isEmpty());

        assertInvalid(new Request(List.of()));
        assertInvalid(null);
        assertInvalid(request(new DeviceEvent("x", "ABCD12", "FYS", null, null, null, null)));
        IllegalArgumentException future = assertInvalid(request(new DeviceEvent("x", "ABCD12", "FYS",
                OffsetDateTime.ofInstant(NOW.plusSeconds(600), ZoneOffset.UTC), null, null, null)));
        assertEquals("events[0].occurredAt is in the future", future.getMessage());
        assertInvalid(request(new DeviceEvent("x", "ABCD12", "FYS", AT, null, "critical", null)));
        assertInvalid(request(new DeviceEvent("x", "ABCD12", "FYS", AT, null, null, "x".repeat(501))));
        List<DeviceEvent> many = new ArrayList<>();
        for (int i = 0; i <= DeviceEvents.MAX_EVENTS; i++) {
            many.add(event("e" + i, "AAS", null));
        }
        assertInvalid(new Request(many));
    }

    private IllegalArgumentException assertInvalid(Request request) {
        return assertThrows(IllegalArgumentException.class, () -> events.accept(TENANT, request));
    }

    @Test
    void offUnlessEnabled() {
        DeviceEvents off = new DeviceEvents(false, ids, (t, a) -> List.of(), channel, Clock.systemUTC(), () -> null);
        Request emergency = request(event("app-1", "Emergencia", null));
        assertThrows(DeviceEvents.UnavailableException.class,
                () -> off.accept(TENANT, emergency));
    }
}
