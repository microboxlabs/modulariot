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
        if (root == null || !root.isObject() || !root.path("coordinates").isArray()) {
            throw new IllegalArgumentException("not a polygon object");
        }
        String type = root.path("type").asText();
        JsonNode coordinates = root.path("coordinates");
        List<List<double[][]>> polygons = new ArrayList<>();
        switch (type) {
            case "Polygon" -> polygons.add(polygon(coordinates));
            case "MultiPolygon" -> coordinates.forEach(p -> polygons.add(polygon(p)));
            default -> throw new IllegalArgumentException("not a polygon: " + type);
        }
        if (polygons.isEmpty()) {
            throw new IllegalArgumentException("a shape without polygons");
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
        if (!rings.isArray() || rings.isEmpty()) {
            throw new IllegalArgumentException("a polygon without rings");
        }
        List<double[][]> out = new ArrayList<>();
        rings.forEach(ring -> out.add(ring(ring)));
        return out;
    }

    private static double[][] ring(JsonNode ring) {
        if (!ring.isArray() || ring.size() < 4) {
            throw new IllegalArgumentException("a ring needs at least four positions");
        }
        double[][] points = new double[ring.size()][];
        for (int i = 0; i < ring.size(); i++) {
            JsonNode point = ring.get(i);
            if (!point.isArray() || point.size() < 2 || !point.get(0).isNumber() || !point.get(1).isNumber()) {
                throw new IllegalArgumentException("a position needs numeric longitude and latitude");
            }
            double lon = point.get(0).asDouble();
            double lat = point.get(1).asDouble();
            if (!Double.isFinite(lon) || !Double.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) {
                throw new IllegalArgumentException("a position is outside longitude and latitude bounds");
            }
            points[i] = new double[] {lon, lat};
        }
        double[] first = points[0];
        double[] last = points[points.length - 1];
        if (first[0] != last[0] || first[1] != last[1]) {
            throw new IllegalArgumentException("a ring must be closed");
        }
        return points;
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
