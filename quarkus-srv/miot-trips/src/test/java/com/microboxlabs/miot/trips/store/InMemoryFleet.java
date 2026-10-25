package com.microboxlabs.miot.trips.store;

import com.microboxlabs.miot.core.fleet.FleetResources;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/** A fleet for service tests: ids it knows, and the vehicles, drivers and carriers the board shows. */
public class InMemoryFleet implements FleetResources {

    private final Set<UUID> known = new HashSet<>();
    private final Map<UUID, Vehicle> vehicles = new HashMap<>();
    private final Map<UUID, Driver> drivers = new HashMap<>();
    private final Map<UUID, Carrier> carriers = new HashMap<>();
    private final Map<String, Match> byKey = new HashMap<>();

    /** A truck, trailer or driver found by its plate or document; an inactive one cannot be assigned. */
    public UUID add(String resourceType, String naturalKey, boolean active) {
        UUID id = UUID.randomUUID();
        if (active) {
            known.add(id);
        }
        byKey.merge(resourceType + ":" + key(naturalKey), new Match(id, active),
                (existing, added) -> existing.active() ? existing : added);
        return id;
    }

    private static String key(String raw) {
        return raw.replaceAll("[^A-Za-z0-9]", "").toUpperCase(java.util.Locale.ROOT);
    }

    @Override
    public Optional<Match> byPlate(String tenantCode, String resourceType, String plate) {
        return plate == null ? Optional.empty() : Optional.ofNullable(byKey.get(resourceType + ":" + key(plate)));
    }

    @Override
    public Optional<Match> driverByDocument(String tenantCode, String document) {
        return document == null ? Optional.empty() : Optional.ofNullable(byKey.get("driver:" + key(document)));
    }

    /** A resource id the fleet knows, with no details. */
    public UUID add() {
        UUID id = UUID.randomUUID();
        known.add(id);
        return id;
    }

    public UUID add(Vehicle vehicle) {
        UUID id = add();
        vehicles.put(id, vehicle);
        return id;
    }

    public UUID add(Driver driver) {
        UUID id = add();
        drivers.put(id, driver);
        return id;
    }

    public void add(Carrier carrier) {
        carriers.put(carrier.id(), carrier);
    }

    @Override
    public boolean exists(String tenantCode, String resourceType, UUID id) {
        return known.contains(id);
    }

    @Override
    public Optional<Vehicle> vehicle(String tenantCode, String resourceType, UUID id) {
        return Optional.ofNullable(vehicles.get(id));
    }

    @Override
    public Optional<Driver> driver(String tenantCode, UUID id) {
        return Optional.ofNullable(drivers.get(id));
    }

    @Override
    public Optional<Carrier> carrier(String tenantCode, UUID id) {
        return Optional.ofNullable(carriers.get(id));
    }
}
