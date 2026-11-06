package com.microboxlabs.miot.symptoms.signal;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Each vehicle's bearing of travel: the planar azimuth from its previous position to the current one, in whole
 * degrees clockwise from north, as PostGIS {@code ST_Azimuth} gives it on a 4326 geometry. A frame at the same
 * position keeps the last bearing. A frame older than the last one, or a vehicle silent for longer than
 * {@code forget}, does not use the previous position.
 */
public class Bearings {

    private record Last(Instant at, double lon, double lat, Integer bearing) {
    }

    private final Map<String, Last> last = new ConcurrentHashMap<>();
    private final Duration forget;

    public Bearings(Duration forget) {
        this.forget = forget;
    }

    /** The bearing at this frame, or null when it is not known. */
    public Integer next(String assetId, Instant at, double lon, double lat) {
        Last prev = last.get(assetId);
        if (prev != null && at.isBefore(prev.at())) {
            return null;
        }
        Integer bearing = null;
        if (prev != null && Duration.between(prev.at(), at).compareTo(forget) <= 0) {
            bearing = azimuth(prev.lon(), prev.lat(), lon, lat);
            if (bearing == null) {
                bearing = prev.bearing();
            }
        }
        last.put(assetId, new Last(at, lon, lat, bearing));
        return bearing;
    }

    /** Drops the vehicles last seen before {@code now - forget}. */
    public void prune(Instant now) {
        last.values().removeIf(l -> l.at().isBefore(now.minus(forget)));
    }

    public int size() {
        return last.size();
    }

    static Integer azimuth(double lon0, double lat0, double lon1, double lat1) {
        double dx = lon1 - lon0;
        double dy = lat1 - lat0;
        if (dx == 0 && dy == 0) {
            return null;
        }
        double deg = Math.toDegrees(Math.atan2(dx, dy));
        return (int) Math.round(deg < 0 ? deg + 360 : deg);
    }
}
