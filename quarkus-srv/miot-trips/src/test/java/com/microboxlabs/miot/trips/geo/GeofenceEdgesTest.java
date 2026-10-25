package com.microboxlabs.miot.trips.geo;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class GeofenceEdgesTest {

    private static final String HOLED = """
            {"type":"Polygon","coordinates":[
              [[0,0],[10,0],[10,10],[0,10],[0,0]],
              [[4,4],[6,4],[6,6],[4,6],[4,4]]]}""";
    private static final String TWO = """
            {"type":"MultiPolygon","coordinates":[
              [[[0,0],[1,0],[1,1],[0,1],[0,0]]],
              [[[5,5],[6,5],[6,6],[5,6],[5,5]]]]}""";

    private static GeoShape square(double lon, double lat) {
        return GeoShape.parse(String.format(java.util.Locale.ROOT,
                "{\"type\":\"Polygon\",\"coordinates\":[[[%f,%f],[%f,%f],[%f,%f],[%f,%f],[%f,%f]]]}",
                lon - 1, lat - 1, lon + 1, lat - 1, lon + 1, lat + 1, lon - 1, lat + 1, lon - 1, lat - 1));
    }

    @Test
    void aPointInAHoleIsOutside() {
        GeoShape s = GeoShape.parse(HOLED);
        assertTrue(s.contains(2, 2));
        assertFalse(s.contains(5, 5));
        assertFalse(s.contains(11, 5));
    }

    @Test
    void aMultiPolygonHoldsEachPart() {
        GeoShape s = GeoShape.parse(TWO);
        assertTrue(s.contains(0.5, 0.5));
        assertTrue(s.contains(5.5, 5.5));
        assertFalse(s.contains(3, 3));
    }

    @Test
    void onlyPolygonsAreShapes() {
        assertThrows(IllegalArgumentException.class, () -> GeoShape.parse("{\"type\":\"Point\",\"coordinates\":[0,0]}"));
        assertThrows(IllegalArgumentException.class, () -> GeoShape.parse("not json"));
    }

    @Test
    void malformedShapesAreRejectedAsValidationErrors() {
        for (String input : List.of("", "null", "[]",
                "{\"type\":\"MultiPolygon\",\"coordinates\":[]}",
                "{\"type\":\"Polygon\",\"coordinates\":[[[0],[1,1],[2,2],[0]]]}")) {
            assertThrows(IllegalArgumentException.class, () -> GeoShape.parse(input));
        }
    }

    @Test
    void aTripLeavesItsOriginAndEntersItsDestination() {
        Map<Integer, GeoShape> shapes = Map.of(10, square(0, 0), 20, square(10, 10));
        GeofenceEdges.Watch w = new GeofenceEdges.Watch(10, 20, null, null, false, false);

        GeofenceEdges.Move atOrigin = GeofenceEdges.move(w, GeofenceEdges.zoneOf(w, shapes, 0, 0));
        assertEquals(List.of(new GeofenceEdges.Edge("entered_origin", 10)), atOrigin.edges());
        assertTrue(atOrigin.originVisited());

        w = new GeofenceEdges.Watch(10, 20, null, 10, true, false);
        GeofenceEdges.Move away = GeofenceEdges.move(w, GeofenceEdges.zoneOf(w, shapes, 5, 5));
        assertEquals(List.of(new GeofenceEdges.Edge("left_origin", 10)), away.edges());
        assertNull(away.current());

        w = new GeofenceEdges.Watch(10, 20, null, null, true, false);
        GeofenceEdges.Move arrived = GeofenceEdges.move(w, GeofenceEdges.zoneOf(w, shapes, 10, 10));
        assertEquals(List.of(new GeofenceEdges.Edge("entered_destination", 20)), arrived.edges());
        assertTrue(arrived.destinationVisited());

        w = new GeofenceEdges.Watch(10, 20, null, 20, true, true);
        assertEquals(List.of(), GeofenceEdges.move(w, GeofenceEdges.zoneOf(w, shapes, 10.5, 10)).edges(),
                "staying inside gives nothing");
    }

    @Test
    void aRoundTripArrivesWhenItComesBack() {
        GeofenceEdges.Watch start = new GeofenceEdges.Watch(10, 10, null, null, false, false);
        assertEquals("entered_origin", GeofenceEdges.move(start, 10).edges().get(0).kind());
        GeofenceEdges.Watch out = new GeofenceEdges.Watch(10, 10, null, 10, true, false);
        assertEquals("left_origin", GeofenceEdges.move(out, null).edges().get(0).kind());
        GeofenceEdges.Watch back = new GeofenceEdges.Watch(10, 10, null, null, true, false);
        assertEquals("entered_destination", GeofenceEdges.move(back, 10).edges().get(0).kind());
        GeofenceEdges.Watch again = new GeofenceEdges.Watch(10, 10, null, 10, true, true);
        assertEquals("left_destination", GeofenceEdges.move(again, null).edges().get(0).kind());
    }

    @Test
    void movingStraightBetweenTwoGeofencesLeavesThenEnters() {
        GeofenceEdges.Watch w = new GeofenceEdges.Watch(10, 20, List.of(30), 30, true, false);
        assertEquals(List.of(new GeofenceEdges.Edge("left_stop", 30), new GeofenceEdges.Edge("entered_destination", 20)),
                GeofenceEdges.move(w, 20).edges());
    }
}
