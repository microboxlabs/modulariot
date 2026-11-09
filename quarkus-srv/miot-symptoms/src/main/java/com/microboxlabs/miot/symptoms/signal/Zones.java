package com.microboxlabs.miot.symptoms.signal;

import io.vertx.core.json.Json;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jboss.logging.Logger;

/**
 * The GPS database's geofences per client, for {@code signal.geo}. A zone of type {@value #AUTHORIZED} is
 * authorized and one of type {@value #RISK} is a risk zone, as the GPS database's signal function reads
 * {@code properties.geofence_type}. A point on a zone's edge is inside it. A zone may carry its own risk schedule,
 * {@code properties.schedule}: a list of {@code {"start":"HH:MM","end":"HH:MM"}} windows in local time. The schedule
 * is only exposed; a scheduled zone is still a risk zone at every hour.
 */
public class Zones {

    private static final Logger LOG = Logger.getLogger(Zones.class);
    static final String AUTHORIZED = "0";
    static final String RISK = "1";
    private static final Pattern HH_MM = Pattern.compile("([01]?\\d|2[0-3]):([0-5]\\d)");

    /**
     * A window of the day in minutes from local midnight: start inclusive, end exclusive. A start after the end
     * crosses midnight.
     */
    public record Window(int start, int end) {

        boolean contains(double minutes) {
            return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
        }
    }

    /**
     * One zone: its type, name, risk schedule and polygons, each a list of rings of {@code [lon, lat]} points; the
     * first ring is the outline and the others are holes. {@code schedule} is null when the zone has none or its
     * schedule is malformed; {@code badSchedule} then keeps the malformed text.
     */
    public record Zone(String clientId, int id, String type, String name, List<Window> schedule, String badSchedule,
            List<List<double[][]>> polygons) {

        /** A zone without name or schedule. */
        public Zone(String clientId, int id, String type, List<List<double[][]>> polygons) {
            this(clientId, id, type, null, null, null, polygons);
        }

        boolean covers(double lon, double lat) {
            for (List<double[][]> polygon : polygons) {
                if (!polygon.isEmpty() && inRing(polygon.get(0), lon, lat)
                        && polygon.stream().skip(1).noneMatch(hole -> inRing(hole, lon, lat) && !onEdge(hole, lon, lat))) {
                    return true;
                }
            }
            return false;
        }

        boolean risk() {
            return RISK.equals(type);
        }

        boolean scheduled() {
            return schedule != null;
        }
    }

    private final AtomicReference<Map<String, List<Zone>>> byClient = new AtomicReference<>();
    private final Set<String> reported = ConcurrentHashMap.newKeySet();

    /** Replaces every client's zones in id order. A malformed schedule is logged once while its zone stays loaded. */
    public void load(List<Zone> zones) {
        Map<String, List<Zone>> next = new HashMap<>();
        Set<String> current = new HashSet<>();
        zones.forEach(z -> {
            next.computeIfAbsent(z.clientId(), k -> new ArrayList<>()).add(z);
            current.add(zoneKey(z));
        });
        reported.retainAll(current);
        next.replaceAll((client, loaded) -> loaded.stream().sorted(Comparator.comparingInt(Zone::id)).toList());
        zones.stream().filter(z -> z.badSchedule() != null)
                .filter(z -> reported.add(zoneKey(z)))
                .forEach(z -> LOG.warnf("Signal builder: zone %d of %s has a malformed schedule, read as none: %s",
                        z.id(), z.clientId(), z.badSchedule()));
        byClient.set(Map.copyOf(next));
    }

    private static String zoneKey(Zone zone) {
        return zone.clientId() + "/" + zone.id();
    }

    public int size() {
        Map<String, List<Zone>> loaded = byClient.get();
        return loaded == null ? 0 : loaded.values().stream().mapToInt(List::size).sum();
    }

    /**
     * Where the point is for the client's zones at the frame's local time; null before a successful complete load.
     * A known-empty set places the point outside every authorized zone.
     *
     * <p>{@code zone} names one covering zone: a risk zone first, then an authorized zone, then any other; among
     * several, the lowest id, except that among risk zones one with its own schedule comes first. That risk zone
     * also decides {@code risk_scheduled} (it has a schedule) and {@code in_risk_schedule} (the local time falls in
     * one of its windows; null when it has no schedule or the time is unknown). So when a point is in several risk
     * zones, a zone with a schedule decides both fields.
     *
     * @param local the frame's local time, as {@code signal.local_minutes} reads it; null when unknown
     */
    public GpsSignal.Geo at(String clientId, double lon, double lat, LocalTime local) {
        Map<String, List<Zone>> loaded = byClient.get();
        if (loaded == null) {
            return null;
        }
        List<Zone> zones = loaded.getOrDefault(clientId, List.of());
        Zone riskZone = null;
        Zone authorizedZone = null;
        Zone otherZone = null;
        for (Zone z : zones) {
            if (!z.covers(lon, lat)) {
                continue;
            }
            if (authorizedZone == null && AUTHORIZED.equals(z.type())) {
                authorizedZone = z;
            }
            if (otherZone == null && !AUTHORIZED.equals(z.type())) {
                otherZone = z;
            }
            riskZone = preferredRiskZone(riskZone, z);
        }
        return geo(riskZone, authorizedZone, otherZone, local);
    }

    private static Zone preferredRiskZone(Zone current, Zone candidate) {
        if (candidate.risk() && (current == null || candidate.scheduled() && !current.scheduled())) {
            return candidate;
        }
        return current;
    }

    private static GpsSignal.Geo geo(Zone riskZone, Zone authorizedZone, Zone otherZone, LocalTime local) {
        Zone named = authorizedZone != null ? authorizedZone : otherZone;
        if (riskZone != null) {
            named = riskZone;
        }
        boolean scheduled = riskZone != null && riskZone.scheduled();
        Boolean inSchedule = scheduled && local != null ? inSchedule(riskZone.schedule(), local) : null;
        return new GpsSignal.Geo(authorizedZone != null, named == null ? null : named.name(), riskZone != null,
                named == null || otherZone != null, scheduled, inSchedule);
    }

    private static boolean inSchedule(List<Window> schedule, LocalTime local) {
        double minutes = local.toSecondOfDay() / 60.0;
        return schedule.stream().anyMatch(w -> w.contains(minutes));
    }

    /** A zone from a GeoJSON {@code Polygon} or {@code MultiPolygon}, without name or schedule. */
    public static Zone zone(String clientId, int id, String type, String geoJson) {
        return zone(clientId, id, type, null, null, geoJson);
    }

    /**
     * A zone from a GeoJSON {@code Polygon} or {@code MultiPolygon}; null for any other shape. {@code scheduleJson}
     * is {@code properties.schedule} as JSON text, null when absent.
     */
    public static Zone zone(String clientId, int id, String type, String name, String scheduleJson, String geoJson) {
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
        boolean absent = scheduleJson == null || scheduleJson.isBlank() || "null".equals(scheduleJson.strip());
        Optional<List<Window>> parsed = absent ? Optional.of(List.of()) : schedule(scheduleJson);
        List<Window> windows = parsed.orElse(List.of());
        return new Zone(clientId, id, type, name, windows.isEmpty() ? null : windows,
                parsed.isEmpty() ? scheduleJson : null, polygons);
    }

    /**
     * The windows of {@code properties.schedule}; an empty optional when malformed: not an array, a window that
     * is not an object with {@code start} and {@code end} as {@code HH:MM}, or a window that starts where it ends.
     */
    static Optional<List<Window>> schedule(String json) {
        try {
            Object parsed = Json.decodeValue(json);
            if (!(parsed instanceof JsonArray windows)) {
                return Optional.empty();
            }
            List<Window> out = new ArrayList<>();
            for (Object w : windows) {
                if (!(w instanceof JsonObject window)) {
                    return Optional.empty();
                }
                Integer start = minutes(window.getValue("start"));
                Integer end = minutes(window.getValue("end"));
                if (start == null || end == null || start.equals(end)) {
                    return Optional.empty();
                }
                out.add(new Window(start, end));
            }
            return Optional.of(List.copyOf(out));
        } catch (RuntimeException e) {
            return Optional.empty();
        }
    }

    private static Integer minutes(Object value) {
        if (!(value instanceof String text)) {
            return null;
        }
        Matcher m = HH_MM.matcher(text.strip());
        return m.matches() ? Integer.parseInt(m.group(1)) * 60 + Integer.parseInt(m.group(2)) : null;
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
