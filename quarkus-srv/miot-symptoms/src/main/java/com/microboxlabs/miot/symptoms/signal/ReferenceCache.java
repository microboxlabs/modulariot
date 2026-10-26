package com.microboxlabs.miot.symptoms.signal;

import io.vertx.core.json.JsonObject;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * The rows the signal builder joins to each frame: the trips from
 * {@code miot_trips.trip_live}, with their carrier and driver from the fleet,
 * and the clients a vehicle is shared with from the GPS database's
 * {@code asset_client_map}. Loaded in full; trips are then kept current from
 * the {@code miot_trips_live} notices, shares from their Debezium change events.
 */
public class ReferenceCache {

    /** A {@code trip_live} row, as far as the signal needs it. */
    public record Trip(String tripId, String tenant, String assetId, String tripType, String status,
            Instant startTime, Instant endTime, boolean doubleDriver, TripDetails details) {

        public Trip(String tripId, String tenant, String assetId, String tripType, String status, Instant startTime,
                Instant endTime, boolean doubleDriver) {
            this(tripId, tenant, assetId, tripType, status, startTime, endTime, doubleDriver, TripDetails.NONE);
        }

        /** Departed at or before {@code at} and not ended. */
        boolean inProgressAt(Instant at) {
            return startTime != null && !startTime.isAfter(at) && endTime == null;
        }

        /** Trips of type {@code v} first; {@code ote} and {@code otr} only when no {@code v} trip is open. */
        int priority() {
            return "ote".equals(tripType) || "otr".equals(tripType) ? 2 : 1;
        }
    }

    /**
     * The rest of a {@code trip_live} row. {@code driverAssigned} says the trip names a driver; the other driver
     * values are the fleet's, null when the fleet does not have that driver.
     */
    public record TripDetails(Instant eta, String code, Integer originId, String originLabel, Boolean originVisited,
            Boolean originInternal, Integer destinationId, String destinationLabel, Boolean destinationVisited,
            Integer currentGeofenceId, String carrierTaxId, String carrierName, String loadType, String trailerPlate,
            boolean driverAssigned, String driverId, String driverStatus, Instant driverLicenseExpires) {

        static final TripDetails NONE = new TripDetails(null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, false, null, null, null);
    }

    /** An {@code asset_client_map} row. */
    public record Share(String assetId, String clientId, boolean active, Instant validFrom, Instant validTo) {

        boolean validAt(Instant at) {
            return active && (validFrom == null || !validFrom.isAfter(at)) && (validTo == null || !validTo.isBefore(at));
        }
    }

    private static final String ASSET_ID = "asset_id";
    private static final String SHARED_CLIENT_ID = "shared_client_id";

    private static final Comparator<Trip> FIRST = Comparator.comparingInt(Trip::priority)
            .thenComparing(Trip::startTime, Comparator.reverseOrder());

    /** By trip id, the table's key. */
    private final Map<String, Trip> trips = new ConcurrentHashMap<>();
    private final Map<String, Map<String, Share>> shares = new ConcurrentHashMap<>();
    /** Rows changed since the current reload began; the reload's older copy does not replace them. */
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
     * and keeps the rows changed while the reload's queries ran.
     */
    public void load(List<Trip> allTrips, List<Share> allShares) {
        Map<String, Trip> nextTrips = new HashMap<>();
        allTrips.forEach(t -> nextTrips.put(t.tripId(), t));
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

    /**
     * Each client's trip in progress on the vehicle at {@code at}, in the order of {@code clients}: a vehicle
     * shared between organizations may be on a trip of each.
     */
    public Map<String, Trip> tripsAt(String assetId, Instant at, List<String> clients) {
        Map<String, Trip> out = new LinkedHashMap<>();
        for (String client : clients) {
            trips.values().stream()
                    .filter(t -> client.equals(t.tenant()) && assetId.equals(t.assetId()) && t.inProgressAt(at))
                    .min(FIRST).ifPresent(t -> out.put(client, t));
        }
        return out;
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

    /** The trip's row as read after a notice; null when the trip no longer has one. */
    public void applyTrip(String tripId, Trip row) {
        changed(changedTrips, tripId);
        if (row == null) {
            trips.remove(tripId);
        } else {
            trips.put(tripId, row);
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

    private void changed(Set<String> changes, String k) {
        if (reloading) {
            changes.add(k);
        }
    }

    private static String key(String first, String second) {
        return first + "\u0000" + second;
    }

    private void putShare(Share s) {
        shares.computeIfAbsent(s.assetId(), k -> new ConcurrentHashMap<>()).put(s.clientId(), s);
    }

    /** A trip from a row of {@link SignalStream}'s trip query, read as JSON. */
    static Trip trip(JsonObject row) {
        return new Trip(row.getString("trip_id"), row.getString("tenant_code"), row.getString(ASSET_ID),
                row.getString("trip_type"), row.getString("status"), instant(row.getString("start_time")),
                instant(row.getString("end_time")), Boolean.TRUE.equals(row.getBoolean("double_driver")),
                new TripDetails(instant(row.getString("estimated_arrival_time")), row.getString("code"),
                        row.getInteger("origin_geofence_id"), row.getString("origin_geofence_label"),
                        row.getBoolean("origin_visited"), row.getBoolean("origin_is_internal"),
                        row.getInteger("destination_geofence_id"), row.getString("destination_geofence_label"),
                        row.getBoolean("destination_visited"), row.getInteger("current_geofence_id"),
                        row.getString("carrier_tax_id"), row.getString("carrier_name"), row.getString("type_load"),
                        row.getString("rampla_plate"), Boolean.TRUE.equals(row.getBoolean("driver_assigned")),
                        row.getString("driver_fleet_id"), row.getString("driver_status"),
                        instant(row.getString("driver_license_expires"))));
    }

    static Instant instant(String iso) {
        return iso == null || iso.isBlank() ? null : OffsetDateTime.parse(iso).toInstant();
    }
}
