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
    private static final double METERS_PER_DEGREE = 111_320;

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
        return of(root);
    }

    /** {@link #parse} on a tree already read. */
    public static GeoShape of(JsonNode root) {
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

    /** A point of the largest polygon: its area centroid, or the middle of its widest crossing at that latitude. */
    public double[] center() {
        double[][] outer = null;
        double best = -1;
        for (List<double[][]> rings : polygons) {
            double a = Math.abs(area(rings.get(0)));
            if (a > best) {
                best = a;
                outer = rings.get(0);
            }
        }
        double a = area(outer);
        if (a == 0) {
            return outer[0].clone();
        }
        double cx = 0;
        double cy = 0;
        for (int i = 0; i < outer.length - 1; i++) {
            double f = outer[i][0] * outer[i + 1][1] - outer[i + 1][0] * outer[i][1];
            cx += (outer[i][0] + outer[i + 1][0]) * f;
            cy += (outer[i][1] + outer[i + 1][1]) * f;
        }
        cx /= 6 * a;
        cy /= 6 * a;
        return contains(cx, cy) ? new double[] {cx, cy} : widestCrossing(outer, cy);
    }

    /** Meters from the point to the nearest edge, on an equirectangular projection around the point. */
    public double distanceMeters(double lon, double lat) {
        double kx = METERS_PER_DEGREE * Math.cos(Math.toRadians(lat));
        double best = Double.MAX_VALUE;
        for (List<double[][]> rings : polygons) {
            for (double[][] ring : rings) {
                for (int i = 0; i < ring.length - 1; i++) {
                    best = Math.min(best, segment((ring[i][0] - lon) * kx, (ring[i][1] - lat) * METERS_PER_DEGREE,
                            (ring[i + 1][0] - lon) * kx, (ring[i + 1][1] - lat) * METERS_PER_DEGREE));
                }
            }
        }
        return best;
    }

    private static double segment(double x1, double y1, double x2, double y2) {
        double dx = x2 - x1;
        double dy = y2 - y1;
        double len = dx * dx + dy * dy;
        double t = len == 0 ? 0 : Math.max(0, Math.min(1, -(x1 * dx + y1 * dy) / len));
        return Math.hypot(x1 + t * dx, y1 + t * dy);
    }

    private static double area(double[][] ring) {
        double a = 0;
        for (int i = 0; i < ring.length - 1; i++) {
            a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
        }
        return a / 2;
    }

    private static double[] widestCrossing(double[][] ring, double y) {
        List<Double> xs = new ArrayList<>();
        for (int i = 0; i < ring.length - 1; i++) {
            double y1 = ring[i][1];
            double y2 = ring[i + 1][1];
            if ((y1 > y) != (y2 > y)) {
                xs.add(ring[i][0] + (y - y1) * (ring[i + 1][0] - ring[i][0]) / (y2 - y1));
            }
        }
        xs.sort(null);
        double[] out = ring[0].clone();
        double width = -1;
        for (int i = 0; i + 1 < xs.size(); i += 2) {
            if (xs.get(i + 1) - xs.get(i) > width) {
                width = xs.get(i + 1) - xs.get(i);
                out = new double[] {(xs.get(i) + xs.get(i + 1)) / 2, y};
            }
        }
        return out;
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
