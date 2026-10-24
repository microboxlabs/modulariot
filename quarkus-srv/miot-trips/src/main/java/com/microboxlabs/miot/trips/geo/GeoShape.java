package com.microboxlabs.miot.trips.geo;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;

/**
 * A geofence's area: the polygons of a GeoJSON {@code Polygon} or {@code MultiPolygon}, in longitude and latitude.
 * A point on a hole is outside. Ray casting on the plane, which is accurate enough at geofence sizes.
 */
public final class GeoShape {

    private static final ObjectMapper JSON = new ObjectMapper();

    /** Each polygon is its rings: the outer one first, then the holes; each ring is [lon, lat] pairs. */
    private final List<List<double[][]>> polygons;

    private GeoShape(List<List<double[][]>> polygons) {
        this.polygons = polygons;
    }

    /** Throws {@link IllegalArgumentException} for anything but a Polygon or MultiPolygon. */
    public static GeoShape parse(String geojson) {
        JsonNode root;
        try {
            root = JSON.readTree(geojson);
        } catch (Exception e) {
            throw new IllegalArgumentException("not GeoJSON", e);
        }
        String type = root.path("type").asText();
        JsonNode coordinates = root.path("coordinates");
        List<List<double[][]>> polygons = new ArrayList<>();
        switch (type) {
            case "Polygon" -> polygons.add(polygon(coordinates));
            case "MultiPolygon" -> coordinates.forEach(p -> polygons.add(polygon(p)));
            default -> throw new IllegalArgumentException("not a polygon: " + type);
        }
        return new GeoShape(polygons);
    }

    public boolean contains(double lon, double lat) {
        for (List<double[][]> rings : polygons) {
            if (inside(rings.get(0), lon, lat) && rings.stream().skip(1).noneMatch(h -> inside(h, lon, lat))) {
                return true;
            }
        }
        return false;
    }

    private static List<double[][]> polygon(JsonNode rings) {
        List<double[][]> out = new ArrayList<>();
        rings.forEach(ring -> {
            double[][] points = new double[ring.size()][];
            for (int i = 0; i < ring.size(); i++) {
                points[i] = new double[] {ring.get(i).get(0).asDouble(), ring.get(i).get(1).asDouble()};
            }
            out.add(points);
        });
        if (out.isEmpty()) {
            throw new IllegalArgumentException("a polygon without rings");
        }
        return out;
    }

    private static boolean inside(double[][] ring, double x, double y) {
        boolean in = false;
        for (int i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            double xi = ring[i][0];
            double yi = ring[i][1];
            double xj = ring[j][0];
            double yj = ring[j][1];
            if ((yi > y) != (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) {
                in = !in;
            }
        }
        return in;
    }
}
