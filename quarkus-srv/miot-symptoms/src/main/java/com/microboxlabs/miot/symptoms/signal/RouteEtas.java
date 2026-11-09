package com.microboxlabs.miot.symptoms.signal;

import com.google.common.geometry.S2CellId;
import com.google.common.geometry.S2LatLng;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

/**
 * The GPS database's route history ({@code s2cell_triproute_transition_stats}): for an origin, a destination and
 * the S2 level-12 cell a vehicle is in, the 75th percentile of the time past trips took from that cell to the
 * destination. Only the rows for any start hour and any number of drivers, the ones the GPS database's signal
 * function reads. Loaded in full: a few thousand rows.
 */
public class RouteEtas {

    static final int LEVEL = 12;

    /** One row: seconds from the cell to the destination. */
    public record Cell(int originId, int destinationId, String token, int remainingSeconds) {
    }

    private record Key(int originId, int destinationId, String token) {
    }

    private final AtomicReference<Map<Key, Integer>> cells = new AtomicReference<>(Map.of());

    /** Replaces every route's cells. */
    public void load(List<Cell> rows) {
        Map<Key, Integer> next = new HashMap<>();
        rows.forEach(c -> next.put(new Key(c.originId(), c.destinationId(), c.token()), c.remainingSeconds()));
        cells.set(Map.copyOf(next));
    }

    public int size() {
        return cells.get().size();
    }

    /** Seconds the route's past trips took from the point's cell to the destination; null off the route's cells. */
    public Integer remainingSeconds(int originId, int destinationId, double lon, double lat) {
        return cells.get().get(new Key(originId, destinationId, token(lon, lat)));
    }

    /** The point's S2 cell token at level 12, as the GPS database stores it ({@code s2tokens.level_12}). */
    static String token(double lon, double lat) {
        return S2CellId.fromLatLng(S2LatLng.fromDegrees(lat, lon)).parent(LEVEL).toToken();
    }
}
