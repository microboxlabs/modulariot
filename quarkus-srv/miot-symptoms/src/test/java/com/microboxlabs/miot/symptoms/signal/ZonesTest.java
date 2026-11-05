package com.microboxlabs.miot.symptoms.signal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import cl.streamhub.gps.model.EnvelopedMessage;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ZonesTest {

    /** A square of 0.1° around (lon, lat), as the GPS database's ST_AsGeoJSON writes it. */
    private static String square(double lon, double lat) {
        double d = 0.05;
        return """
                {"type":"Polygon","coordinates":[[[%s,%s],[%s,%s],[%s,%s],[%s,%s],[%s,%s]]]}
                """.formatted(lon - d, lat - d, lon + d, lat - d, lon + d, lat + d, lon - d, lat + d, lon - d, lat - d);
    }

    private static Zones zones(Zones.Zone... z) {
        Zones zones = new Zones();
        zones.load(List.of(z));
        return zones;
    }

    @Test
    void anAuthorizedZoneAloneIsAuthorizedAndNotOutside() {
        Zones zones = zones(Zones.zone("c-1", 1, "0", square(-70.0, -33.0)));

        assertEquals(new GpsSignal.Geo(true, null, false, false), zones.at("c-1", -70.0, -33.0));
        assertEquals(new GpsSignal.Geo(false, null, false, true), zones.at("c-1", -71.0, -33.0), "in no zone");
        assertEquals(new GpsSignal.Geo(true, null, false, false), zones.at("c-1", -70.05, -33.0), "on the edge");
    }

    @Test
    void aRiskZoneOverlappingAnAuthorizedOneIsOutsideAuthorized() {
        Zones zones = zones(Zones.zone("c-1", 1, "0", square(-70.0, -33.0)),
                Zones.zone("c-1", 2, "1", square(-70.04, -33.0)));

        assertEquals(new GpsSignal.Geo(true, null, true, true), zones.at("c-1", -70.02, -33.0),
                "inside both: a zone that is not authorized makes it outside, as the GPS database reads it");
        assertEquals(new GpsSignal.Geo(false, null, true, true), zones.at("c-1", -70.08, -33.0), "risk zone only");
    }

    @Test
    void aZoneOfAnotherTypeIsNeitherAuthorizedNorRisk() {
        Zones zones = zones(Zones.zone("c-1", 1, "3", square(-70.0, -33.0)));

        assertEquals(new GpsSignal.Geo(false, null, false, true), zones.at("c-1", -70.0, -33.0));
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

        assertEquals(true, zones.at("c-1", 2, 2).riskZone());
        assertEquals(false, zones.at("c-1", 5, 5).riskZone(), "inside the hole");
        assertEquals(true, zones.at("c-1", 4, 5).riskZone(), "on the hole's edge");
        assertEquals(true, zones.at("c-2", 5.5, 5.5).riskZone());
        assertEquals(false, zones.at("c-2", 3, 3).riskZone());
    }

    @Test
    void aClientWithoutZonesGetsNoGeoAndOtherShapesAreSkipped() {
        Zones zones = zones(Zones.zone("c-1", 1, "0", square(-70.0, -33.0)));

        assertNull(zones.at("c-2", -70.0, -33.0));
        assertNull(Zones.zone("c-1", 3, "0", "{\"type\":\"Point\",\"coordinates\":[0,0]}"));
        assertEquals(1, zones.size());
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

        assertEquals(Map.of("sender-1", new GpsSignal.Geo(false, null, true, true)), s.geos());
        assertNull(s.geo(), "the evaluator gives each organization its zones");
        assertEquals(1, s.localHour(), "04:30 UTC is 01:30 in Santiago in October");
        assertEquals(90.5, s.localMinutes());

        GpsSignal noZones = new SignalBuilder(refs, ZoneId.of("America/Santiago"))
                .build(EnvelopedMessage.fromJson(json)).orElseThrow();
        assertNull(noZones.geos());
    }
}
