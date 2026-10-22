package com.microboxlabs.miot.symptoms.signal;

import io.vertx.core.json.JsonObject;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * The GPS database rows the signal builder joins to each frame: trips from
 * {@code live_trip} and the clients a vehicle is shared with from
 * {@code asset_client_map}. Loaded in full, then kept current from their
 * Debezium change events.
 */
public class ReferenceCache {

    /** A {@code live_trip} row, as far as the signal needs it. */
    public record Trip(String tripId, String assetId, String tripType, String status, Instant startTime,
            Instant endTime, boolean doubleDriver) {

        /** In progress at {@code at}, as the GPS database's signal function decides it. */
        boolean inProgressAt(Instant at) {
            return "SCHEDULED".equals(status) && startTime != null && !startTime.isAfter(at) && endTime == null;
        }

        /** Trips of type {@code v} first; {@code ote} and {@code otr} only when no {@code v} trip is open. */
        int priority() {
            return "ote".equals(tripType) || "otr".equals(tripType) ? 2 : 1;
        }
    }

    /** An {@code asset_client_map} row. */
    public record Share(String assetId, String clientId, boolean active, Instant validFrom, Instant validTo) {

        boolean validAt(Instant at) {
            return active && (validFrom == null || !validFrom.isAfter(at)) && (validTo == null || !validTo.isBefore(at));
        }
    }

    private static final String TRIP_ID = "trip_id";
    private static final String ASSET_ID = "asset_id";
    private static final String SHARED_CLIENT_ID = "shared_client_id";

    private static final Comparator<Trip> FIRST = Comparator.comparingInt(Trip::priority)
            .thenComparing(Trip::startTime, Comparator.reverseOrder());

    /** By trip id and vehicle, the table's key. */
    private final Map<String, Trip> trips = new ConcurrentHashMap<>();
    private final Map<String, Map<String, Share>> shares = new ConcurrentHashMap<>();
    /** Rows changed by a change event since the current reload began; the reload's older copy does not replace them. */
    private final Set<String> changedTrips = ConcurrentHashMap.newKeySet();
    private final Set<String> changedShares = ConcurrentHashMap.newKeySet();
    private volatile boolean reloading;
    private volatile boolean loaded;

    /** Called before the reload's queries run. */
    public void beginReload() {
        changedTrips.clear();
        changedShares.clear();
        reloading = true;
    }

    /**
     * Replaces the rows without emptying the maps first, so frames built during a reload still find them,
     * and keeps the rows change events updated while the reload's queries ran.
     */
    public void load(List<Trip> allTrips, List<Share> allShares) {
        Map<String, Trip> nextTrips = new HashMap<>();
        allTrips.forEach(t -> nextTrips.put(key(t.tripId(), t.assetId()), t));
        nextTrips.forEach((k, t) -> {
            if (!changedTrips.contains(k)) {
                trips.put(k, t);
            }
        });
        trips.keySet().removeIf(k -> !nextTrips.containsKey(k) && !changedTrips.contains(k));

        Set<String> nextShares = new HashSet<>();
        allShares.forEach(s -> {
            String k = key(s.assetId(), s.clientId());
            nextShares.add(k);
            if (!changedShares.contains(k)) {
                putShare(s);
            }
        });
        shares.values().forEach(byClient -> byClient.values().removeIf(s -> {
            String k = key(s.assetId(), s.clientId());
            return !nextShares.contains(k) && !changedShares.contains(k);
        }));
        reloading = false;
        loaded = true;
    }

    public boolean loaded() {
        return loaded;
    }

    /** The vehicle's trip in progress at {@code at}, the way the GPS database's signal function picks it. */
    public Optional<Trip> tripAt(String assetId, Instant at) {
        return trips.values().stream()
                .filter(t -> assetId.equals(t.assetId()) && t.inProgressAt(at))
                .min(FIRST);
    }

    /** The client that sent the frame, then the clients the vehicle is shared with at {@code at}. */
    public List<String> clientsAt(String assetId, String sender, Instant at) {
        Set<String> out = new LinkedHashSet<>();
        if (sender != null && !sender.isBlank()) {
            out.add(sender);
        }
        shares.getOrDefault(assetId, Map.of()).values().stream()
                .filter(s -> s.validAt(at))
                .map(Share::clientId)
                .sorted()
                .forEach(out::add);
        return new ArrayList<>(out);
    }

    /** Applies a {@code live_trip} Debezium change event. */
    public void applyTrip(JsonObject change) {
        JsonObject after = change.getJsonObject("after");
        if ("d".equals(change.getString("op"))) {
            JsonObject before = change.getJsonObject("before");
            if (before != null && before.getString(TRIP_ID) != null) {
                trips.remove(changed(changedTrips, key(before.getString(TRIP_ID), before.getString(ASSET_ID))));
            }
        } else if (after != null && after.getString(TRIP_ID) != null) {
            trips.put(changed(changedTrips, key(after.getString(TRIP_ID), after.getString(ASSET_ID))), trip(after));
        }
    }

    /** Applies an {@code asset_client_map} Debezium change event. */
    public void applyShare(JsonObject change) {
        if ("d".equals(change.getString("op"))) {
            JsonObject before = change.getJsonObject("before");
            if (before != null && before.getString(ASSET_ID) != null && before.getString(SHARED_CLIENT_ID) != null) {
                changed(changedShares, key(before.getString(ASSET_ID), before.getString(SHARED_CLIENT_ID)));
                Map<String, Share> byClient = shares.get(before.getString(ASSET_ID));
                if (byClient != null) {
                    byClient.remove(before.getString(SHARED_CLIENT_ID));
                }
            }
        } else {
            JsonObject after = change.getJsonObject("after");
            if (after != null && after.getString(ASSET_ID) != null && after.getString(SHARED_CLIENT_ID) != null) {
                changed(changedShares, key(after.getString(ASSET_ID), after.getString(SHARED_CLIENT_ID)));
                putShare(new Share(after.getString(ASSET_ID), after.getString(SHARED_CLIENT_ID),
                        Boolean.TRUE.equals(after.getBoolean("active")), instant(after.getString("valid_from")),
                        instant(after.getString("valid_to"))));
            }
        }
    }

    int tripCount() {
        return trips.size();
    }

    private String changed(Set<String> changes, String k) {
        if (reloading) {
            changes.add(k);
        }
        return k;
    }

    private static String key(String first, String second) {
        return first + "\u0000" + second;
    }

    private void putShare(Share s) {
        shares.computeIfAbsent(s.assetId(), k -> new ConcurrentHashMap<>()).put(s.clientId(), s);
    }

    private static Trip trip(JsonObject row) {
        return new Trip(row.getString(TRIP_ID), row.getString(ASSET_ID), row.getString("trip_type"),
                row.getString("status"), instant(row.getString("start_time")), instant(row.getString("end_time")),
                Boolean.TRUE.equals(row.getBoolean("double_driver")));
    }

    static Instant instant(String iso) {
        return iso == null || iso.isBlank() ? null : OffsetDateTime.parse(iso).toInstant();
    }
}
