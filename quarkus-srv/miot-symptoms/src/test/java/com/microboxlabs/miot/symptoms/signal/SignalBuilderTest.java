package com.microboxlabs.miot.symptoms.signal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import cl.streamhub.gps.model.EnvelopedMessage;
import com.fasterxml.jackson.core.type.TypeReference;
import com.microboxlabs.miot.symptoms.signal.ReferenceCache.Share;
import com.microboxlabs.miot.symptoms.signal.ReferenceCache.Trip;
import io.vertx.core.json.JsonObject;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class SignalBuilderTest {

    private static final Instant AT = Instant.parse("2026-10-21T12:00:00Z");

    private static String frame(String asset, double speed, boolean panic) {
        return """
                {"requestId":"r-1","clientId":"sender-1@clients","timestamp":"2026-10-21T12:00:01Z",
                 "payload":{"asset_id":"%s","timestamp":"2026-10-21T12:00:00Z",
                            "gps":{"latitude":-33.45,"longitude":-70.66,"speed":%s},
                            "sensors":{"engine_status":true,"panic_button":%s}}}
                """.formatted(asset, speed, panic);
    }

    private static Trip trip(String id, String type, String status, Instant start, Instant end) {
        return new Trip(id, "ABCD12", type, status, start, end, false);
    }

    private static ReferenceCache refs(List<Trip> trips, List<Share> shares) {
        ReferenceCache refs = new ReferenceCache();
        refs.load(trips, shares);
        return refs;
    }

    private static GpsSignal build(ReferenceCache refs, String json) {
        return new SignalBuilder(refs, ZoneId.of("America/Santiago")).build(EnvelopedMessage.fromJson(json))
                .orElseThrow();
    }

    @Test
    void carriesTheFrameAndWhatTheBuilderAdds() {
        GpsSignal s = build(refs(List.of(), List.of()), frame("ABCD12", 42.5, true));

        assertEquals(GpsSignal.SCHEMA_ID, s.schema());
        assertEquals("ABCD12", s.assetId());
        assertEquals(AT, s.at());
        assertEquals(List.of("sender-1"), s.clients(), "the M2M suffix is dropped");
        assertEquals(42.5, s.frame().getGps().getSpeed());
        assertTrue(s.frame().getSensors().getEngineStatus());
        assertTrue(s.derived().moving());
        assertEquals(9, s.localHour(), "12:00 UTC is 09:00 in Santiago in October");
        assertTrue(s.frame().getSensors().isPanicButton());
        assertFalse(s.trip().active());
        assertNull(s.road());
    }

    @Test
    void movingIsAboveTenKmh() {
        assertFalse(build(refs(List.of(), List.of()), frame("ABCD12", 10, false)).derived().moving());
        assertTrue(build(refs(List.of(), List.of()), frame("ABCD12", 10.5, false)).derived().moving());
    }

    @Test
    void picksTheTripInProgressLikeTheGpsDatabase() {
        Instant hourAgo = AT.minusSeconds(3600);
        ReferenceCache refs = refs(List.of(
                trip("OTE", "ote", "SCHEDULED", AT.minusSeconds(60), null),
                trip("V-OLD", "v", "SCHEDULED", hourAgo.minusSeconds(3600), null),
                trip("V-NEW", "v", "SCHEDULED", hourAgo, null),
                trip("V-ENDED", "v", "SCHEDULED", AT.minusSeconds(30), AT.minusSeconds(10)),
                trip("V-ADDED", "v", "ADDED", AT.minusSeconds(30), null),
                trip("V-LATER", "v", "SCHEDULED", AT.plusSeconds(60), null)), List.of());

        GpsSignal s = build(refs, frame("ABCD12", 0, false));

        assertTrue(s.trip().active());
        assertEquals("V-NEW", s.trip().id(), "v trips before ote/otr, then the latest start");
    }

    @Test
    void addsTheClientsTheVehicleIsSharedWithAtTheFrameTime() {
        ReferenceCache refs = refs(List.of(), List.of(
                new Share("ABCD12", "client-b", true, AT.minusSeconds(60), AT.plusSeconds(60)),
                new Share("ABCD12", "client-a", true, null, null),
                new Share("ABCD12", "sender-1", true, null, null),
                new Share("ABCD12", "expired", true, AT.minusSeconds(120), AT.minusSeconds(60)),
                new Share("ABCD12", "inactive", false, null, null),
                new Share("OTHER1", "client-c", true, null, null)));

        assertEquals(List.of("sender-1", "client-a", "client-b"), build(refs, frame("ABCD12", 0, false)).clients());
    }

    @Test
    void debeziumChangesUpdateTheCache() {
        ReferenceCache refs = refs(List.of(), List.of());
        refs.applyTrip(new JsonObject("""
                {"op":"c","before":null,"after":{"trip_id":"T-1","asset_id":"ABCD12","trip_type":"v",
                 "status":"SCHEDULED","start_time":"2026-10-21T11:00:00Z","end_time":null,"double_driver":true}}
                """));
        GpsSignal on = build(refs, frame("ABCD12", 0, false));
        assertEquals("T-1", on.trip().id());
        assertTrue(on.trip().doubleDriver());

        refs.applyTrip(new JsonObject("""
                {"op":"u","before":null,"after":{"trip_id":"T-1","asset_id":"ABCD12","trip_type":"v",
                 "status":"SCHEDULED","start_time":"2026-10-21T11:00:00Z","end_time":"2026-10-21T11:30:00Z"}}
                """));
        assertFalse(build(refs, frame("ABCD12", 0, false)).trip().active(), "ended");

        refs.applyTrip(new JsonObject("""
                {"op":"d","before":{"trip_id":"T-1","asset_id":"ABCD12"},"after":null}
                """));
        assertEquals(0, refs.tripCount());

        refs.applyShare(new JsonObject("""
                {"op":"c","after":{"asset_id":"ABCD12","shared_client_id":"client-a","active":true,
                 "valid_from":"2026-01-01T00:00:00Z","valid_to":"2027-01-01T00:00:00Z"}}
                """));
        assertEquals(List.of("sender-1", "client-a"), build(refs, frame("ABCD12", 0, false)).clients());
        refs.applyShare(new JsonObject("""
                {"op":"d","before":{"asset_id":"ABCD12","shared_client_id":"client-a"}}
                """));
        assertEquals(List.of("sender-1"), build(refs, frame("ABCD12", 0, false)).clients());
    }

    @Test
    void aReloadReplacesTheRows() {
        Instant start = AT.minusSeconds(600);
        ReferenceCache refs = refs(List.of(trip("T-1", "v", "SCHEDULED", start, null)),
                List.of(new Share("ABCD12", "client-a", true, null, null)));

        refs.load(List.of(trip("T-2", "v", "SCHEDULED", start, null)),
                List.of(new Share("ABCD12", "client-b", true, null, null)));

        GpsSignal signal = build(refs, frame("ABCD12", 0, false));
        assertEquals(1, refs.tripCount());
        assertEquals("T-2", signal.trip().id());
        assertEquals(List.of("sender-1", "client-b"), signal.clients());
    }

    @Test
    void tripsAreKeptPerVehicle() {
        Instant start = AT.minusSeconds(600);
        ReferenceCache refs = refs(List.of(trip("T-1", "v", "SCHEDULED", start, null),
                new Trip("T-1", "OTHER1", "v", "SCHEDULED", start, null, false)), List.of());
        assertEquals(2, refs.tripCount());

        refs.applyTrip(new JsonObject("""
                {"op":"d","before":{"trip_id":"T-1","asset_id":"OTHER1"},"after":null}
                """));

        assertEquals("T-1", build(refs, frame("ABCD12", 0, false)).trip().id());
        assertFalse(build(refs, frame("OTHER1", 0, false)).trip().active());
    }

    @Test
    void aReloadKeepsChangesReceivedWhileItsQueriesRan() {
        Instant start = AT.minusSeconds(600);
        ReferenceCache refs = refs(List.of(trip("T-1", "v", "SCHEDULED", start, null)),
                List.of(new Share("ABCD12", "client-a", true, null, null)));

        refs.beginReload();
        refs.applyTrip(new JsonObject("""
                {"op":"u","after":{"trip_id":"T-1","asset_id":"ABCD12","trip_type":"v",
                 "status":"SCHEDULED","start_time":"2026-10-21T11:00:00Z","end_time":"2026-10-21T11:30:00Z"}}
                """));
        refs.applyShare(new JsonObject("""
                {"op":"d","before":{"asset_id":"ABCD12","shared_client_id":"client-a"}}
                """));
        refs.load(List.of(trip("T-1", "v", "SCHEDULED", start, null)),
                List.of(new Share("ABCD12", "client-a", true, null, null)));

        GpsSignal signal = build(refs, frame("ABCD12", 0, false));
        assertFalse(signal.trip().active(), "the trip ended while the reload ran");
        assertEquals(List.of("sender-1"), signal.clients());
    }

    @Test
    void skipsFramesWithoutVehicleOrTime() {
        SignalBuilder builder = new SignalBuilder(refs(List.of(), List.of()), ZoneId.of("UTC"));

        assertTrue(builder.build(EnvelopedMessage.fromJson(frame("", 0, false))).isEmpty());
        assertTrue(builder.build(EnvelopedMessage.fromJson("""
                {"clientId":"c","payload":{"asset_id":"ABCD12"}}
                """)).isEmpty());
    }

    @Test
    void serializesUnderTheRuleEditorPaths() throws Exception {
        GpsSignal s = build(refs(List.of(), List.of()), frame("ABCD12", 42.5, true));
        Map<String, Object> json = SignalStream.JSON.readValue(SignalStream.JSON.writeValueAsString(s),
                new TypeReference<>() {
                });

        assertEquals("2026-10-21T12:00:00Z", json.get("at"));
        assertEquals(Boolean.TRUE, ((Map<?, ?>) ((Map<?, ?>) json.get("frame")).get("sensors")).get("panic_button"));
        assertEquals(Boolean.FALSE, ((Map<?, ?>) json.get("trip")).get("active"));
        assertFalse(json.containsKey("road"), "unknown parts are left out");
        assertFalse(((Map<?, ?>) ((Map<?, ?>) json.get("frame")).get("sensors")).containsKey("odometer"),
                "values the device did not send are left out");
    }

    /** A live_trip row as Debezium and the reload send it, names and phones included. */
    private static final String ROW = """
            {"trip_id":"TRIP-9001","asset_id":"ABCD12","trip_type":"v","status":"SCHEDULED",
             "start_time":"2026-10-21T10:30:00Z","end_time":null,"double_driver":false,
             "estimated_arrival_time":"2026-10-21T11:45:00Z","origin_geofence_id":32,
             "origin_geofence_label":"ANF","origin_visited":true,"origin_is_internal":true,
             "destination_geofence_id":17,"destination_geofence_label":"SPC","destination_visited":false,
             "current_geofence_id":0,"carrier_id":"11111111-1","carrier_name":"TRANSPORTES SUR",
             "type_load":"rampla","rampla_plate":"DEMO33","driver_id":"12345678-5",
             "driver_name":"Nombre Apellido","driver_contact_phone":"+56900000000",
             "created_by_client_id":"tenant-client"}
            """;

    @Test
    void carriesTheTripRowAndTheRegisteredDriver() throws Exception {
        ReferenceCache refs = refs(List.of(ReferenceCache.trip(new JsonObject(ROW))), List.of());
        refs.loadDrivers(List.of(
                new ReferenceCache.Driver("d-other", "other-client", "12.345.678-5", "ACTIVE", null),
                new ReferenceCache.Driver("d-1", "tenant-client", "12345678-5", "SUSPENDED",
                        Instant.parse("2026-10-01T00:00:00Z"))));

        GpsSignal s = build(refs, frame("ABCD12", 70, false));

        GpsSignal.Trip t = s.trip();
        assertEquals("TRIP-9001", t.id());
        assertEquals("v", t.type());
        assertEquals(90.0, t.ageMin());
        assertEquals(15.0, t.lateMin(), "15 min past the estimated arrival");
        assertEquals(new GpsSignal.Origin(32, "ANF", true, true), t.origin());
        assertEquals(new GpsSignal.Destination(17, "SPC", false), t.destination());
        assertNull(t.currentZoneId(), "geofence 0 is no geofence");
        assertEquals(new GpsSignal.Carrier("11111111-1", "TRANSPORTES SUR"), t.carrier());
        assertEquals("rampla", t.loadType());
        assertEquals("DEMO33", t.trailerPlate());
        assertEquals(new GpsSignal.Driver("d-1", true, GpsSignal.DriverStatus.SUSPENDED, true), t.driver(),
                "the trip creator's driver first");
        String json = SignalStream.JSON.writeValueAsString(s);
        assertFalse(json.contains("12345678"), "no national id");
        assertFalse(json.contains("Nombre") || json.contains("+569"), "no name or phone");
    }

    @Test
    void anUnknownDriverIsUnregisteredOnlyOnceTheRegistryIsLoaded() {
        ReferenceCache refs = refs(List.of(ReferenceCache.trip(new JsonObject(ROW))), List.of());

        assertNull(build(refs, frame("ABCD12", 70, false)).trip().driver(), "registry not loaded: unknown");
        refs.loadDrivers(List.of());
        assertEquals(new GpsSignal.Driver(null, false, null, null),
                build(refs, frame("ABCD12", 70, false)).trip().driver());
    }

    @Test
    void aRegistryPublishedDuringTheLookupIsNotAnUnregisteredDriver() {
        // The first registry lands after the lookup read the unloaded one: the driver is unknown, not unregistered.
        ReferenceCache refs = new ReferenceCache() {
            @Override
            public Optional<Driver> driver(String nationalId, String clientId) {
                Optional<Driver> stale = super.driver(nationalId, clientId);
                loadDrivers(List.of(new Driver("d-1", "tenant-client", "12345678-5", "ACTIVE", null)));
                return stale;
            }
        };
        refs.load(List.of(ReferenceCache.trip(new JsonObject(ROW))), List.of());

        assertNull(build(refs, frame("ABCD12", 70, false)).trip().driver());
    }
}
