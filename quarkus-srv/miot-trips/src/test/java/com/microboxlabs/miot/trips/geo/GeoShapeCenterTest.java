package com.microboxlabs.miot.trips.geo;

import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.Test;

class GeoShapeCenterTest {
    @Test
    void referencePointStaysOutsideTheHoles() {
        GeoShape shape = GeoShape.parse("""
                {"type":"Polygon","coordinates":[[[0,0],[10,0],[10,10],[0,10],[0,0]],
                  [[3,3],[7,3],[7,7],[3,7],[3,3]]]}""");
        double[] point = shape.center();
        assertTrue(shape.contains(point[0], point[1]));
    }
}
