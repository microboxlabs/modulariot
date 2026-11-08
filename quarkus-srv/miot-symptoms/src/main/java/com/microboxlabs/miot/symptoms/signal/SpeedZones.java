package com.microboxlabs.miot.symptoms.signal;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Each organization's own speed limits ({@link CustomSpeedTracks}): a polygon with a limit forward
 * and one backward. Forward is a bearing of travel inside {@code [forwardFrom, forwardTo]} (clockwise from north,
 * wrapping past 360); without that range the zone has one limit, forward or else backward. With a
 * {@code heading} the zone only applies to a vehicle whose device heading points the same way, as the legacy
 * speed function compares {@code azimuth_degree}. Where zones overlap, the lowest id applies.
 */
public class SpeedZones {

    /** The limits and optional direction filters attached to a zone. */
    public record Limits(Integer forward, Integer backward, Integer forwardFrom, Integer forwardTo, Integer heading) {
    }

    /**
     * One zone; polygons as {@link Zones.Zone} reads them.
     *
     * @param name the zone's name in the table, or null
     */
    public record Zone(String tenant, int id, Integer forward, Integer backward, Integer forwardFrom,
            Integer forwardTo, Integer heading, List<List<double[][]>> polygons, String name) {

        boolean covers(double lon, double lat) {
            return new Zones.Zone(tenant, id, null, polygons).covers(lon, lat);
        }

        boolean headingMatches(Double deviceHeading) {
            if (heading == null) {
                return true;
            }
            if (deviceHeading == null || !Double.isFinite(deviceHeading)) {
                return false;
            }
            int h = (int) Math.round(deviceHeading);
            return quadrant(heading) == quadrant(h) && quadrant(h) > 0 || Math.abs(heading - h) < 90;
        }

        /** The limit for the bearing of travel; null when the zone has no limit that way or the bearing is needed and unknown. */
        Integer limit(Integer bearing) {
            if (forwardFrom == null || forwardTo == null) {
                return positive(positive(forward) != null ? forward : backward);
            }
            if (bearing == null) {
                return forward != null && forward.equals(backward) ? positive(forward) : null;
            }
            return positive(within(bearing, forwardFrom, forwardTo) ? forward : backward);
        }

        private static Integer positive(Integer v) {
            return v == null || v <= 0 ? null : v;
        }
    }

    /** The organization's limit at a point and the zone it comes from; {@code zoneName} may be null. */
    public record Limit(double maxspeed, int zoneId, String zoneName) {

        public Limit(double maxspeed, int zoneId) {
            this(maxspeed, zoneId, null);
        }
    }

    /** A zone and its bounding box. */
    private record Boxed(Zone zone, double minLon, double minLat, double maxLon, double maxLat) {

        static Boxed of(Zone z) {
            double minLon = Double.MAX_VALUE;
            double minLat = Double.MAX_VALUE;
            double maxLon = -Double.MAX_VALUE;
            double maxLat = -Double.MAX_VALUE;
            for (List<double[][]> polygon : z.polygons()) {
                for (double[][] ring : polygon) {
                    for (double[] p : ring) {
                        minLon = Math.min(minLon, p[0]);
                        maxLon = Math.max(maxLon, p[0]);
                        minLat = Math.min(minLat, p[1]);
                        maxLat = Math.max(maxLat, p[1]);
                    }
                }
            }
            return new Boxed(z, minLon, minLat, maxLon, maxLat);
        }

        boolean inBox(double lon, double lat) {
            return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
        }
    }

    private final AtomicReference<Map<String, List<Boxed>>> byTenant = new AtomicReference<>();

    public void load(List<Zone> zones) {
        Map<String, List<Boxed>> next = new HashMap<>();
        zones.stream().sorted(Comparator.comparingInt(Zone::id))
                .forEach(z -> next.computeIfAbsent(z.tenant(), k -> new ArrayList<>()).add(Boxed.of(z)));
        next.replaceAll((t, loaded) -> List.copyOf(loaded));
        byTenant.set(Map.copyOf(next));
    }

    public int size() {
        Map<String, List<Boxed>> loaded = byTenant.get();
        return loaded == null ? 0 : loaded.values().stream().mapToInt(List::size).sum();
    }

    /**
     * The tenant's limit at the point; null when no zone covers it, the covering zone has no limit for the
     * direction of travel, or nothing is loaded.
     */
    public Limit at(String tenant, double lon, double lat, Double deviceHeading, Integer bearing) {
        Map<String, List<Boxed>> loaded = byTenant.get();
        if (loaded == null) {
            return null;
        }
        for (Boxed b : loaded.getOrDefault(tenant, List.of())) {
            Zone z = b.zone();
            if (b.inBox(lon, lat) && z.headingMatches(deviceHeading) && z.covers(lon, lat)) {
                Integer limit = z.limit(bearing);
                return limit == null ? null : new Limit(limit, z.id(), z.name());
            }
        }
        return null;
    }

    /** A zone from a GeoJSON polygon; null for another shape. */
    public static Zone zone(String tenant, int id, Limits limits, String geoJson) {
        return zone(tenant, id, limits, geoJson, null);
    }

    public static Zone zone(String tenant, int id, Limits limits, String geoJson, String name) {
        Zones.Zone shape = Zones.zone(tenant, id, null, geoJson);
        return shape == null ? null
                : new Zone(tenant, id, limits.forward(), limits.backward(), limits.forwardFrom(), limits.forwardTo(),
                        limits.heading(), shape.polygons(), name == null || name.isBlank() ? null : name.trim());
    }

    /** 1 to 4 for 0–90, 91–180, 181–270, 271–360; 0 outside. */
    static int quadrant(int deg) {
        if (deg >= 0 && deg <= 90) {
            return 1;
        }
        if (deg >= 91 && deg <= 180) {
            return 2;
        }
        if (deg >= 181 && deg <= 270) {
            return 3;
        }
        return deg >= 271 && deg <= 360 ? 4 : 0;
    }

    static boolean within(int bearing, int from, int to) {
        return from <= to ? bearing >= from && bearing <= to : bearing >= from || bearing <= to;
    }
}
