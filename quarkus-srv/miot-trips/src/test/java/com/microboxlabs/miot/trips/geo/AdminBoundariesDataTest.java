package com.microboxlabs.miot.trips.geo;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.HashSet;
import java.util.zip.GZIPInputStream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class AdminBoundariesDataTest {
    @ParameterizedTest
    @CsvSource({"PE,districts-pe,1834,8", "CL,communes-cl,345,0"})
    void packagedReferencePointsStayInsideTheirBoundaries(String country, String file, int count, int absent) throws Exception {
        AdminBoundaries boundaries = new AdminBoundaries();
        int withoutShape = 0;
        HashSet<String> codes = new HashSet<>();
        try (var input = getClass().getResourceAsStream("/geo/" + file + ".json.gz")) {
            assertNotNull(input);
            var data = new ObjectMapper().readTree(new GZIPInputStream(input)).path("boundaries");
            assertEquals(count, data.size());
            for (var entry : data) {
                String code = entry.path("code").asText();
                assertTrue(codes.add(code));
                var boundary = boundaries.byCode(country, code).orElseThrow();
                if (boundary.shape() == null) {
                    withoutShape++;
                    assertTrue(boundary.centroid().isEmpty());
                } else {
                    assertEquals(2, boundary.centroid().size());
                    assertEquals(4, boundary.bbox().size());
                    assertTrue(boundary.shape().contains(boundary.centroid().get(0), boundary.centroid().get(1)),
                            country + " " + code);
                }
            }
        }
        assertEquals(absent, withoutShape);
    }
}
