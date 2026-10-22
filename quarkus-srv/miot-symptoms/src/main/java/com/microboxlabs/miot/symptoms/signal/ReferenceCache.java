package com.microboxlabs.miot.symptoms.signal;

import io.vertx.core.json.JsonObject;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
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

    private static final Comparator<Trip> FIRST = Comparator.comparingInt(Trip::priority)
            .thenComparing(Trip::startTime, Comparator.reverseOrder());

    private final Map<String, Trip> trips = new ConcurrentHashMap<>();
    private final Map<String, Map<String, Share>> shares = new ConcurrentHashMap<>();
    private volatile boolean loaded;

    /** Replaces the rows without emptying the maps first, so frames built during a reload still find them. */
    public void load(List<Trip> allTrips, List<Share> allShares) {
        Map<String, Trip> nextTrips = new HashMap<>();
        allTrips.forEach(t -> nextTrips.put(t.tripId(), t));
        trips.putAll(nextTrips);
        trips.keySet().retainAll(nextTrips.keySet());
        Map<String, Map<String, Share>> nextShares = new HashMap<>();
        allShares.forEach(s -> nextShares.computeIfAbsent(s.assetId(), k -> new ConcurrentHashMap<>())
                .put(s.clientId(), s));
        shares.putAll(nextShares);
        shares.keySet().retainAll(nextShares.keySet());
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
            if (before != null && before.getString("trip_id") != null) {
                trips.remove(before.getString("trip_id"));
            }
        } else if (after != null && after.getString("trip_id") != null) {
            trips.put(after.getString("trip_id"), trip(after));
        }
    }

    /** Applies an {@code asset_client_map} Debezium change event. */
    public void applyShare(JsonObject change) {
        if ("d".equals(change.getString("op"))) {
            JsonObject before = change.getJsonObject("before");
            if (before != null && before.getString("asset_id") != null) {
                Map<String, Share> byClient = shares.get(before.getString("asset_id"));
                if (byClient != null && before.getString("shared_client_id") != null) {
                    byClient.remove(before.getString("shared_client_id"));
                }
            }
        } else {
            JsonObject after = change.getJsonObject("after");
            if (after != null && after.getString("asset_id") != null && after.getString("shared_client_id") != null) {
                putShare(new Share(after.getString("asset_id"), after.getString("shared_client_id"),
                        Boolean.TRUE.equals(after.getBoolean("active")), instant(after.getString("valid_from")),
                        instant(after.getString("valid_to"))));
            }
        }
    }

    int tripCount() {
        return trips.size();
    }

    private void putShare(Share s) {
        shares.computeIfAbsent(s.assetId(), k -> new ConcurrentHashMap<>()).put(s.clientId(), s);
    }

    private static Trip trip(JsonObject row) {
        return new Trip(row.getString("trip_id"), row.getString("asset_id"), row.getString("trip_type"),
                row.getString("status"), instant(row.getString("start_time")), instant(row.getString("end_time")),
                Boolean.TRUE.equals(row.getBoolean("double_driver")));
    }

    static Instant instant(String iso) {
        return iso == null || iso.isBlank() ? null : OffsetDateTime.parse(iso).toInstant();
    }
}
