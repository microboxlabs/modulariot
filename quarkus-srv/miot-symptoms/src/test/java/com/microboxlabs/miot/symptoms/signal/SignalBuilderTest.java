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
import org.junit.jupiter.api.Test;

class SignalBuilderTest {

    private static final Instant AT = Instant.parse("2026-10-21T12:00:00Z");
    private static final String SENDER = "sender-1";

    private static String frame(String asset, double speed, boolean panic) {
        return """
                {"requestId":"r-1","clientId":"sender-1@clients","timestamp":"2026-10-21T12:00:01Z",
                 "payload":{"asset_id":"%s","timestamp":"2026-10-21T12:00:00Z",
                            "gps":{"latitude":-33.45,"longitude":-70.66,"speed":%s},
                            "sensors":{"engine_status":true,"panic_button":%s}}}
                """.formatted(asset, speed, panic);
    }

    private static Trip trip(String id, String type, Instant start, Instant end) {
        return new Trip(id, SENDER, "ABCD12", type, "in_transit", start, end, false);
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

    private static GpsSignal.Trip senderTrip(GpsSignal s) {
        return s.trips() == null ? null : s.trips().get(SENDER);
    }

    @Test
    void carriesTheFrameAndWhatTheBuilderAdds() {
        GpsSignal s = build(refs(List.of(), List.of()), frame("ABCD12", 42.5, true));

        assertEquals(GpsSignal.SCHEMA_ID, s.schema());
        assertEquals("ABCD12", s.assetId());
        assertEquals(AT, s.at());
        assertEquals(List.of(SENDER), s.clients(), "the M2M suffix is dropped");
        assertEquals(42.5, s.frame().getGps().getSpeed());
        assertTrue(s.frame().getSensors().getEngineStatus());
        assertTrue(s.derived().moving());
        assertEquals(9, s.localHour(), "12:00 UTC is 09:00 in Santiago in October");
        assertTrue(s.frame().getSensors().isPanicButton());
        assertNull(s.trips(), "no client has a trip");
        assertNull(s.trip(), "the evaluator gives each organization its trip");
        assertNull(s.road());
    }

    @Test
    void movingIsAboveTenKmh() {
        assertFalse(build(refs(List.of(), List.of()), frame("ABCD12", 10, false)).derived().moving());
        assertTrue(build(refs(List.of(), List.of()), frame("ABCD12", 10.5, false)).derived().moving());
    }

    @Test
    void picksTheTripInProgress() {
        Instant hourAgo = AT.minusSeconds(3600);
        ReferenceCache refs = refs(List.of(
                trip("OTE", "ote", AT.minusSeconds(60), null),
                trip("V-OLD", "v", hourAgo.minusSeconds(3600), null),
                trip("V-NEW", "v", hourAgo, null),
                trip("V-ENDED", "v", AT.minusSeconds(30), AT.minusSeconds(10)),
                trip("V-NOT-DEPARTED", "v", null, null),
                trip("V-LATER", "v", AT.plusSeconds(60), null)), List.of());

        GpsSignal.Trip t = senderTrip(build(refs, frame("ABCD12", 0, false)));

        assertTrue(t.active());
        assertEquals("V-NEW", t.id(), "v trips before ote/otr, then the latest start");
    }

    @Test
    void eachClientGetsItsOwnTripAndNoOther() {
        Instant start = AT.minusSeconds(600);
        ReferenceCache refs = refs(List.of(
                new Trip("T-SENDER", SENDER, "ABCD12", "v", "in_transit", start, null, false),
                new Trip("T-SHARED", "client-a", "ABCD12", "v", "in_transit", start, null, true),
                new Trip("T-STRANGER", "client-z", "ABCD12", "v", "in_transit", start, null, false)),
                List.of(new Share("ABCD12", "client-a", true, null, null)));

        GpsSignal s = build(refs, frame("ABCD12", 0, false));

        assertEquals(List.of(SENDER, "client-a"), List.copyOf(s.trips().keySet()));
        assertEquals("T-SENDER", s.trips().get(SENDER).id());
        assertEquals("T-SHARED", s.trips().get("client-a").id());
        assertTrue(s.trips().get("client-a").doubleDriver());
    }

    @Test
    void addsTheClientsTheVehicleIsSharedWithAtTheFrameTime() {
        ReferenceCache refs = refs(List.of(), List.of(
                new Share("ABCD12", "client-b", true, AT.minusSeconds(60), AT.plusSeconds(60)),
                new Share("ABCD12", "client-a", true, null, null),
                new Share("ABCD12", SENDER, true, null, null),
                new Share("ABCD12", "expired", true, AT.minusSeconds(120), AT.minusSeconds(60)),
                new Share("ABCD12", "inactive", false, null, null),
                new Share("OTHER1", "client-c", true, null, null)));

        assertEquals(List.of(SENDER, "client-a", "client-b"), build(refs, frame("ABCD12", 0, false)).clients());
    }

    @Test
    void tripNoticesAndShareChangesUpdateTheCache() {
        ReferenceCache refs = refs(List.of(), List.of());
        refs.applyTrip("T-1", ReferenceCache.trip(new JsonObject("""
                {"trip_id":"T-1","tenant_code":"sender-1","asset_id":"ABCD12","trip_type":"v",
                 "status":"in_transit","start_time":"2026-10-21T11:00:00+00:00","end_time":null,
                 "double_driver":true}
                """)));
        GpsSignal.Trip on = senderTrip(build(refs, frame("ABCD12", 0, false)));
        assertEquals("T-1", on.id());
        assertTrue(on.doubleDriver());

        refs.applyTrip("T-1", new Trip("T-1", SENDER, "ABCD12", "v", "in_transit", AT.minusSeconds(3600),
                AT.minusSeconds(1800), false));
        assertNull(build(refs, frame("ABCD12", 0, false)).trips(), "ended");

        refs.applyTrip("T-1", null);
        assertEquals(0, refs.tripCount(), "a trip without a row is dropped");

        refs.applyShare(new JsonObject("""
                {"op":"c","after":{"asset_id":"ABCD12","shared_client_id":"client-a","active":true,
                 "valid_from":"2026-01-01T00:00:00Z","valid_to":"2027-01-01T00:00:00Z"}}
                """));
        assertEquals(List.of(SENDER, "client-a"), build(refs, frame("ABCD12", 0, false)).clients());
        refs.applyShare(new JsonObject("""
                {"op":"d","before":{"asset_id":"ABCD12","shared_client_id":"client-a"}}
                """));
        assertEquals(List.of(SENDER), build(refs, frame("ABCD12", 0, false)).clients());
    }

    @Test
    void aReloadReplacesTheRows() {
        Instant start = AT.minusSeconds(600);
        ReferenceCache refs = refs(List.of(trip("T-1", "v", start, null)),
                List.of(new Share("ABCD12", "client-a", true, null, null)));

        refs.load(List.of(trip("T-2", "v", start, null)),
                List.of(new Share("ABCD12", "client-b", true, null, null)));

        GpsSignal signal = build(refs, frame("ABCD12", 0, false));
        assertEquals(1, refs.tripCount());
        assertEquals("T-2", senderTrip(signal).id());
        assertEquals(List.of(SENDER, "client-b"), signal.clients());
    }

    @Test
    void aReloadKeepsChangesReceivedWhileItsQueriesRan() {
        Instant start = AT.minusSeconds(600);
        ReferenceCache refs = refs(List.of(trip("T-1", "v", start, null)),
                List.of(new Share("ABCD12", "client-a", true, null, null)));

        refs.beginReload();
        refs.applyTrip("T-1", trip("T-1", "v", start, AT.minusSeconds(60)));
        refs.applyShare(new JsonObject("""
                {"op":"d","before":{"asset_id":"ABCD12","shared_client_id":"client-a"}}
                """));
        refs.load(List.of(trip("T-1", "v", start, null)),
                List.of(new Share("ABCD12", "client-a", true, null, null)));

        GpsSignal signal = build(refs, frame("ABCD12", 0, false));
        assertNull(signal.trips(), "the trip ended while the reload ran");
        assertEquals(List.of(SENDER), signal.clients());
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
        GpsSignal s = build(refs(List.of(trip("T-1", "v", AT.minusSeconds(60), null)), List.of()),
                frame("ABCD12", 42.5, true));
        Map<String, Object> json = SignalStream.JSON.readValue(SignalStream.JSON.writeValueAsString(s),
                new TypeReference<>() {
                });

        assertEquals("2026-10-21T12:00:00Z", json.get("at"));
        assertEquals(Boolean.TRUE, ((Map<?, ?>) ((Map<?, ?>) json.get("frame")).get("sensors")).get("panic_button"));
        assertEquals("T-1", ((Map<?, ?>) ((Map<?, ?>) json.get("trips")).get(SENDER)).get("id"));
        assertFalse(json.containsKey("road"), "unknown parts are left out");
        assertFalse(((Map<?, ?>) ((Map<?, ?>) json.get("frame")).get("sensors")).containsKey("odometer"),
                "values the device did not send are left out");
    }

    /** A row of the trip query, as the reload and a notice read it. */
    private static final String ROW = """
            {"trip_id":"5c1f0a52-3a8e-4bb1-9c55-0d7d1e0e6a01","tenant_code":"sender-1","asset_id":"ABCD12",
             "trip_type":"v","status":"in_transit","code":"SVC-9001",
             "start_time":"2026-10-21T10:30:00+00:00","end_time":null,"double_driver":false,
             "estimated_arrival_time":"2026-10-21T11:45:00+00:00","origin_geofence_id":32,
             "origin_geofence_label":"ANF","origin_visited":true,"origin_is_internal":true,
             "destination_geofence_id":17,"destination_geofence_label":"SPC","destination_visited":false,
             "current_geofence_id":0,"carrier_tax_id":"11111111-1","carrier_name":"TRANSPORTES SUR",
             "type_load":"rampla","rampla_plate":"DEMO33","driver_assigned":true,
             "driver_fleet_id":"9b2e6d1c-0000-4000-8000-000000000001","driver_status":"suspended",
             "driver_license_expires":"2026-10-01T00:00:00+00:00"}
            """;

    @Test
    void carriesTheTripRowWithTheFleetsCarrierAndDriver() {
        ReferenceCache refs = refs(List.of(ReferenceCache.trip(new JsonObject(ROW))), List.of());

        GpsSignal s = build(refs, frame("ABCD12", 70, false));

        GpsSignal.Trip t = senderTrip(s);
        assertEquals("5c1f0a52-3a8e-4bb1-9c55-0d7d1e0e6a01", t.id());
        assertEquals("SVC-9001", t.code());
        assertEquals("v", t.type());
        assertEquals("in_transit", t.status());
        assertEquals(90.0, t.ageMin());
        assertEquals(15.0, t.lateMin(), "15 min past the estimated arrival");
        assertEquals(new GpsSignal.Origin(32, "ANF", true, true), t.origin());
        assertEquals(new GpsSignal.Destination(17, "SPC", false), t.destination());
        assertNull(t.currentZoneId(), "geofence 0 is no geofence");
        assertEquals(new GpsSignal.Carrier("11111111-1", "TRANSPORTES SUR"), t.carrier());
        assertEquals("rampla", t.loadType());
        assertEquals("DEMO33", t.trailerPlate());
        assertEquals(new GpsSignal.Driver("9b2e6d1c-0000-4000-8000-000000000001", true,
                GpsSignal.DriverStatus.SUSPENDED, true), t.driver());
    }

    @Test
    void aDriverTheFleetDoesNotHaveIsNotRegistered() {
        Trip row = ReferenceCache.trip(new JsonObject(ROW).put("driver_fleet_id", null).put("driver_status", null)
                .put("driver_license_expires", null));
        Trip noDriver = ReferenceCache.trip(new JsonObject(ROW).put("driver_assigned", false)
                .put("driver_fleet_id", null));

        assertEquals(new GpsSignal.Driver(null, false, null, null),
                senderTrip(build(refs(List.of(row), List.of()), frame("ABCD12", 70, false))).driver());
        assertNull(senderTrip(build(refs(List.of(noDriver), List.of()), frame("ABCD12", 70, false))).driver(),
                "a trip without a driver says nothing about one");
    }

    @Test
    void anInactiveFleetDriverIsDeactivated() {
        Trip row = ReferenceCache.trip(new JsonObject(ROW).put("driver_status", "inactive"));

        assertEquals(GpsSignal.DriverStatus.DEACTIVATED,
                senderTrip(build(refs(List.of(row), List.of()), frame("ABCD12", 70, false))).driver().status());
    }
}
