package com.microboxlabs.miot.symptoms.signal;

import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * The GPS database's geofences per client, for {@code signal.geo}. A zone of type {@value #AUTHORIZED} is
 * authorized and one of type {@value #RISK} is a risk zone, as the GPS database's signal function reads
 * {@code properties.geofence_type}. A point on a zone's edge is inside it.
 */
public class Zones {

    static final String AUTHORIZED = "0";
    static final String RISK = "1";

    /**
     * One zone: its type and its polygons, each a list of rings of {@code [lon, lat]} points; the first ring
     * is the outline and the others are holes.
     */
    public record Zone(String clientId, int id, String type, List<List<double[][]>> polygons) {

        boolean covers(double lon, double lat) {
            for (List<double[][]> polygon : polygons) {
                if (!polygon.isEmpty() && inRing(polygon.get(0), lon, lat)
                        && polygon.stream().skip(1).noneMatch(hole -> inRing(hole, lon, lat) && !onEdge(hole, lon, lat))) {
                    return true;
                }
            }
            return false;
        }
    }

    private volatile Map<String, List<Zone>> byClient = Map.of();

    /** Replaces every client's zones. */
    public void load(List<Zone> zones) {
        Map<String, List<Zone>> next = new ConcurrentHashMap<>();
        zones.forEach(z -> next.computeIfAbsent(z.clientId(), k -> new ArrayList<>()).add(z));
        byClient = next;
    }

    public int size() {
        return byClient.values().stream().mapToInt(List::size).sum();
    }

    /**
     * Where the point is for the client's zones; null when the client has none, so a rule cannot tell "no
     * zones loaded" from "outside every zone".
     */
    public GpsSignal.Geo at(String clientId, double lon, double lat) {
        List<Zone> zones = byClient.get(clientId);
        if (zones == null || zones.isEmpty()) {
            return null;
        }
        boolean authorized = false;
        boolean risk = false;
        boolean other = false;
        boolean inAny = false;
        for (Zone z : zones) {
            if (!z.covers(lon, lat)) {
                continue;
            }
            inAny = true;
            authorized |= AUTHORIZED.equals(z.type());
            risk |= RISK.equals(z.type());
            other |= !AUTHORIZED.equals(z.type());
        }
        return new GpsSignal.Geo(authorized, null, risk, !inAny || other);
    }

    /** A zone from a GeoJSON {@code Polygon} or {@code MultiPolygon}; null for any other shape. */
    public static Zone zone(String clientId, int id, String type, String geoJson) {
        JsonObject shape = new JsonObject(geoJson);
        JsonArray coordinates = shape.getJsonArray("coordinates");
        List<List<double[][]>> polygons = new ArrayList<>();
        switch (shape.getString("type", "")) {
            case "Polygon" -> polygons.add(polygon(coordinates));
            case "MultiPolygon" -> coordinates.forEach(p -> polygons.add(polygon((JsonArray) p)));
            default -> {
                return null;
            }
        }
        return new Zone(clientId, id, type, polygons);
    }

    private static List<double[][]> polygon(JsonArray rings) {
        List<double[][]> out = new ArrayList<>();
        for (Object r : rings) {
            JsonArray ring = (JsonArray) r;
            double[][] points = new double[ring.size()][];
            for (int i = 0; i < ring.size(); i++) {
                JsonArray p = ring.getJsonArray(i);
                points[i] = new double[] {p.getDouble(0), p.getDouble(1)};
            }
            out.add(points);
        }
        return out;
    }

    /** Even-odd test on longitude and latitude as plane coordinates; zones are small enough for it. */
    static boolean inRing(double[][] ring, double lon, double lat) {
        if (onEdge(ring, lon, lat)) {
            return true;
        }
        boolean inside = false;
        for (int i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            double xi = ring[i][0];
            double yi = ring[i][1];
            double xj = ring[j][0];
            double yj = ring[j][1];
            if ((yi > lat) != (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) {
                inside = !inside;
            }
        }
        return inside;
    }

    private static boolean onEdge(double[][] ring, double lon, double lat) {
        for (int i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            double xi = ring[i][0];
            double yi = ring[i][1];
            double xj = ring[j][0];
            double yj = ring[j][1];
            double cross = (lon - xi) * (yj - yi) - (lat - yi) * (xj - xi);
            if (Math.abs(cross) < 1e-12 && lon >= Math.min(xi, xj) && lon <= Math.max(xi, xj)
                    && lat >= Math.min(yi, yj) && lat <= Math.max(yi, yj)) {
                return true;
            }
        }
        return false;
    }
}
