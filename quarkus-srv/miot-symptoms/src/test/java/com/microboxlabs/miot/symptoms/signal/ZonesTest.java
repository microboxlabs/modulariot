package com.microboxlabs.miot.symptoms.signal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import cl.streamhub.gps.model.EnvelopedMessage;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ZonesTest {

    private static final LocalTime NOON = LocalTime.NOON;
    private static final ZoneId SANTIAGO = ZoneId.of("America/Santiago");

    /** A square of 0.1° around (lon, lat), as the GPS database's ST_AsGeoJSON writes it. */
    private static String square(double lon, double lat) {
        double d = 0.05;
        return """
                {"type":"Polygon","coordinates":[[[%s,%s],[%s,%s],[%s,%s],[%s,%s],[%s,%s]]]}
                """.formatted(lon - d, lat - d, lon + d, lat - d, lon + d, lat + d, lon - d, lat + d, lon - d, lat - d);
    }

    /** Where the point is when no covering risk zone has a schedule. */
    private static GpsSignal.Geo geo(boolean authorized, String zone, boolean risk, boolean outside) {
        return new GpsSignal.Geo(authorized, zone, risk, outside, false, null);
    }

    private static Zones zones(Zones.Zone... z) {
        Zones zones = new Zones();
        zones.load(List.of(z));
        return zones;
    }

    @Test
    void anAuthorizedZoneAloneIsAuthorizedAndNotOutside() {
        Zones zones = zones(Zones.zone("c-1", 1, "0", square(-70.0, -33.0)));

        assertEquals(geo(true, null, false, false), zones.at("c-1", -70.0, -33.0, NOON));
        assertEquals(geo(false, null, false, true), zones.at("c-1", -71.0, -33.0, NOON), "in no zone");
        assertEquals(geo(true, null, false, false), zones.at("c-1", -70.05, -33.0, NOON), "on the edge");
    }

    @Test
    void aRiskZoneOverlappingAnAuthorizedOneIsOutsideAuthorized() {
        Zones zones = zones(Zones.zone("c-1", 1, "0", square(-70.0, -33.0)),
                Zones.zone("c-1", 2, "1", square(-70.04, -33.0)));

        assertEquals(geo(true, null, true, true), zones.at("c-1", -70.02, -33.0, NOON),
                "inside both: a zone that is not authorized makes it outside, as the GPS database reads it");
        assertEquals(geo(false, null, true, true), zones.at("c-1", -70.08, -33.0, NOON), "risk zone only");
    }

    @Test
    void aZoneOfAnotherTypeIsNeitherAuthorizedNorRisk() {
        Zones zones = zones(Zones.zone("c-1", 1, "3", square(-70.0, -33.0)));

        assertEquals(geo(false, null, false, true), zones.at("c-1", -70.0, -33.0, NOON));
    }

    @Test
    void holesAndMultiPolygons() {
        String withHole = """
                {"type":"Polygon","coordinates":[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[4,4],[6,4],[6,6],[4,6],[4,4]]]}
                """;
        String two = """
                {"type":"MultiPolygon","coordinates":[[[[0,0],[1,0],[1,1],[0,1],[0,0]]],[[[5,5],[6,5],[6,6],[5,6],[5,5]]]]}
                """;
        Zones zones = zones(Zones.zone("c-1", 1, "1", withHole), Zones.zone("c-2", 2, "1", two));

        assertEquals(true, zones.at("c-1", 2, 2, NOON).riskZone());
        assertEquals(false, zones.at("c-1", 5, 5, NOON).riskZone(), "inside the hole");
        assertEquals(true, zones.at("c-1", 4, 5, NOON).riskZone(), "on the hole's edge");
        assertEquals(true, zones.at("c-2", 5.5, 5.5, NOON).riskZone());
        assertEquals(false, zones.at("c-2", 3, 3, NOON).riskZone());
    }

    @Test
    void aClientWithoutZonesIsOutsideAfterASuccessfulLoadAndOtherShapesAreSkipped() {
        Zones zones = zones(Zones.zone("c-1", 1, "0", square(-70.0, -33.0)));

        assertEquals(geo(false, null, false, true), zones.at("c-2", -70.0, -33.0, NOON));
        assertNull(Zones.zone("c-1", 3, "0", "{\"type\":\"Point\",\"coordinates\":[0,0]}"));
        assertEquals(1, zones.size());
    }

    @Test
    void unavailableZonesDifferFromAKnownEmptySetIncludingAfterTheLastZoneIsDeleted() {
        Zones zones = new Zones();
        assertNull(zones.at("c-1", -70.0, -33.0, NOON));
        zones.load(List.of());
        assertEquals(geo(false, null, false, true), zones.at("c-1", -70.0, -33.0, NOON));
        zones.load(List.of(Zones.zone("c-1", 1, "0", square(-70.0, -33.0))));
        assertEquals(geo(true, null, false, false), zones.at("c-1", -70.0, -33.0, NOON));
        zones.load(List.of());
        assertEquals(geo(false, null, false, true), zones.at("c-1", -70.0, -33.0, NOON));
    }

    @Test
    void theBuilderGivesEachClientItsZonesAndTheLocalMinutes() {
        String json = """
                {"requestId":"r-1","clientId":"sender-1@clients","timestamp":"2026-10-21T04:31:01Z",
                 "payload":{"asset_id":"ABCD12","timestamp":"2026-10-21T04:30:30Z",
                            "gps":{"latitude":-33.45,"longitude":-70.66,"speed":0}}}
                """;
        Zones zones = zones(Zones.zone("sender-1", 1, "1", square(-70.66, -33.45)));
        ReferenceCache refs = new ReferenceCache();
        refs.load(List.of(), List.of());

        GpsSignal s = new SignalBuilder(refs, ZoneId.of("America/Santiago"), zones)
                .build(EnvelopedMessage.fromJson(json)).orElseThrow();

        assertEquals(Map.of("sender-1", geo(false, null, true, true)), s.geos());
        assertNull(s.geo(), "the evaluator gives each organization its zones");
        assertEquals(1, s.localHour(), "04:30 UTC is 01:30 in Santiago in October");
        assertEquals(90.5, s.localMinutes());

        GpsSignal noZones = new SignalBuilder(refs, ZoneId.of("America/Santiago"))
                .build(EnvelopedMessage.fromJson(json)).orElseThrow();
        assertNull(noZones.geos());
    }

    private static Zones.Zone risk(int id, String name, String schedule) {
        return Zones.zone("c-1", id, "1", name, schedule, square(-70.0, -33.0));
    }

    private static GpsSignal.Geo at(Zones zones, String hhmm) {
        return zones.at("c-1", -70.0, -33.0, LocalTime.parse(hhmm));
    }

    @Test
    void aZoneWithoutAScheduleIsNotScheduledAndTheNameIsFilled() {
        Zones zones = zones(risk(1, "Zona Uno", null));

        assertEquals(new GpsSignal.Geo(false, "Zona Uno", true, true, false, null), at(zones, "12:00"));
        assertEquals(geo(false, null, false, true), zones.at("c-1", -71.0, -33.0, NOON), "in no zone: no name");
        assertNull(zones(risk(1, "Z", "null")).at("c-1", -70.0, -33.0, NOON).inRiskSchedule(), "JSON null");
        assertEquals(false, zones(risk(1, "Z", "[]")).at("c-1", -70.0, -33.0, NOON).riskScheduled(),
                "no windows");
    }

    @Test
    void aSameDayWindowStartsInclusiveAndEndsExclusive() {
        Zones zones = zones(risk(1, "Z", "[{\"start\":\"08:00\",\"end\":\"18:00\"}]"));

        assertEquals(new GpsSignal.Geo(false, "Z", true, true, true, true), at(zones, "08:00"));
        assertEquals(true, at(zones, "17:59").inRiskSchedule());
        assertEquals(false, at(zones, "07:59").inRiskSchedule());
        assertEquals(false, at(zones, "18:00").inRiskSchedule());
        assertEquals(false, at(zones, "23:00").inRiskSchedule());
    }

    @Test
    void aWindowCrossingMidnight() {
        Zones zones = zones(risk(1, "Z", "[{\"start\":\"18:00\",\"end\":\"09:00\"}]"));

        assertEquals(false, at(zones, "17:59").inRiskSchedule());
        assertEquals(true, at(zones, "18:00").inRiskSchedule());
        assertEquals(true, at(zones, "23:00").inRiskSchedule());
        assertEquals(true, at(zones, "00:00").inRiskSchedule());
        assertEquals(true, at(zones, "08:59").inRiskSchedule());
        assertEquals(true, at(zones, "08:59:59").inRiskSchedule());
        assertEquals(false, at(zones, "09:00").inRiskSchedule());
        assertEquals(false, at(zones, "12:00").inRiskSchedule());
        assertEquals(true, at(zones, "12:00").riskZone(), "a scheduled zone is still a risk zone at every hour");
        assertEquals(true, at(zones, "12:00").riskScheduled());
    }

    @Test
    void twoWindows() {
        Zones zones = zones(risk(1, "Z", """
                [{"start":"06:00","end":"07:30"},{"start":"22:00","end":"02:00"}]
                """));

        assertEquals(true, at(zones, "06:15").inRiskSchedule());
        assertEquals(false, at(zones, "07:30").inRiskSchedule());
        assertEquals(false, at(zones, "12:00").inRiskSchedule());
        assertEquals(true, at(zones, "23:00").inRiskSchedule());
        assertEquals(true, at(zones, "01:00").inRiskSchedule());
        assertEquals(false, at(zones, "02:00").inRiskSchedule());
    }

    @Test
    void aMalformedScheduleIsReadAsNoneWithoutFailingTheLoad() {
        for (String bad : List.of("{\"start\":\"08:00\",\"end\":\"18:00\"}", "[{\"start\":\"8h\",\"end\":\"18:00\"}]",
                "[{\"start\":\"08:00\"}]", "[{\"start\":\"25:00\",\"end\":\"18:00\"}]",
                "[{\"start\":\"08:00\",\"end\":\"08:00\"}]", "[\"08:00-18:00\"]", "[{\"start\":800,\"end\":1800}]",
                "not json")) {
            Zones.Zone zone = risk(1, "Z", bad);
            assertNull(zone.schedule(), bad);
            assertEquals(bad, zone.badSchedule(), bad);
            Zones zones = zones(zone, Zones.zone("c-1", 2, "0", square(-70.0, -33.0)));
            assertEquals(new GpsSignal.Geo(true, "Z", true, true, false, null), at(zones, "12:00"), bad);
        }
        Zones.Zone good = risk(1, "Z", "[{\"start\":\"8:00\",\"end\":\"18:00\"}]");
        assertEquals(List.of(new Zones.Window(480, 1080)), good.schedule(), "one-digit hour");
        assertNull(good.badSchedule());
    }

    @Test
    void aScheduledRiskZoneDecidesForAPointInTwoRiskZones() {
        Zones zones = zones(risk(1, "Sin horario", null),
                risk(2, "Con horario", "[{\"start\":\"18:00\",\"end\":\"09:00\"}]"),
                Zones.zone("c-1", 0, "0", "Autorizada", null, square(-70.0, -33.0)));

        assertEquals(new GpsSignal.Geo(true, "Con horario", true, true, true, true), at(zones, "23:00"));
        assertEquals(new GpsSignal.Geo(true, "Con horario", true, true, true, false), at(zones, "12:00"));
    }

    @Test
    void theNamePrefersARiskZoneThenAnAuthorizedOneThenTheLowestId() {
        Zones zones = zones(Zones.zone("c-1", 5, "3", "Otra", null, square(-70.0, -33.0)),
                Zones.zone("c-1", 4, "0", "Autorizada B", null, square(-70.0, -33.0)),
                Zones.zone("c-1", 3, "0", "Autorizada A", null, square(-70.0, -33.0)),
                Zones.zone("c-1", 9, "1", "Riesgo B", null, square(-70.08, -33.0)),
                Zones.zone("c-1", 8, "1", "Riesgo A", null, square(-70.08, -33.0)));

        assertEquals("Autorizada A", zones.at("c-1", -70.0, -33.0, NOON).zone());
        assertEquals("Riesgo A", zones.at("c-1", -70.04, -33.0, NOON).zone(), "in both kinds");
        assertEquals("Otra", zones(Zones.zone("c-1", 5, "3", "Otra", null, square(-70.0, -33.0)))
                .at("c-1", -70.0, -33.0, NOON).zone());
    }

    @Test
    void theBuilderPassesTheFramesLocalTimeToTheSchedule() {
        Zones zones = zones(Zones.zone("sender-1", 1, "1", "Zona Uno", "[{\"start\":\"18:00\",\"end\":\"09:00\"}]",
                square(-70.66, -33.45)));
        ReferenceCache refs = new ReferenceCache();
        refs.load(List.of(), List.of());
        SignalBuilder builder = new SignalBuilder(refs, SANTIAGO, zones);

        GpsSignal night = builder.build(EnvelopedMessage.fromJson(frame("2026-10-21T04:30:30Z"))).orElseThrow();
        assertEquals(new GpsSignal.Geo(false, "Zona Uno", true, true, true, true), night.geos().get("sender-1"),
                "04:30 UTC is 01:30 in Santiago");
        GpsSignal noon = builder.build(EnvelopedMessage.fromJson(frame("2026-10-21T15:00:00Z"))).orElseThrow();
        assertEquals(12, noon.localHour());
        assertEquals(false, noon.geos().get("sender-1").inRiskSchedule());
        GpsSignal edge = builder.build(EnvelopedMessage.fromJson(frame("2026-10-21T21:00:00Z"))).orElseThrow();
        assertEquals(1080.0, edge.localMinutes());
        assertEquals(true, edge.geos().get("sender-1").inRiskSchedule(), "18:00 local opens the window");
    }

    static String frame(String at) {
        return """
                {"requestId":"r-1","clientId":"sender-1@clients","timestamp":"%s",
                 "payload":{"asset_id":"ABCD12","timestamp":"%s",
                            "gps":{"latitude":-33.45,"longitude":-70.66,"speed":0}}}
                """.formatted(at, at);
    }
}
