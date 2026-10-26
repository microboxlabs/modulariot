package com.microboxlabs.miot.fleet.resources.service;

import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.core.fleet.FleetResources;
import com.microboxlabs.miot.fleet.resources.dto.CarrierRequest;
import com.microboxlabs.miot.fleet.resources.dto.DriverRequest;
import com.microboxlabs.miot.fleet.resources.dto.TrailerRequest;
import com.microboxlabs.miot.fleet.resources.dto.TruckRequest;
import com.microboxlabs.miot.fleet.resources.store.ResourceStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * {@link FleetResources} for other modules: lockless reads of the current rows, and registrations that join the
 * caller's transaction.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.fleet.enabled", stringValue = "true")
public class FleetResourcesService implements FleetResources {

    private static final String TRUCK = "truck";
    private static final String TRAILER = "trailer";
    private static final String DRIVER = "driver";
    private static final String CARRIER = "carrier";
    private static final String RESOURCE_TYPE = "resourceType";
    /** Recorded as the source system of what other modules register. */
    private static final String REGISTERED_BY = "trips-feed";

    private final ResourceStore store;
    private final ResourceService resources;
    private final Transactions tx;

    @Inject
    public FleetResourcesService(ResourceStore store, ResourceService resources, Transactions tx) {
        this.store = store;
        this.resources = resources;
        this.tx = tx;
    }

    /** Registrations run on the caller's transaction through the store, so none of their own is needed. */
    public FleetResourcesService(ResourceStore store) {
        this(store, Transactions.none());
    }

    public FleetResourcesService(ResourceStore store, Transactions tx) {
        this(store, new ResourceService(store, tx), tx);
    }

    @Override
    public boolean exists(String tenantCode, String resourceType, UUID id) {
        return store.isCurrent(tenantCode, Check.oneOf(resourceType, RESOURCE_TYPE, TRUCK, TRAILER, DRIVER),
                id);
    }

    @Override
    public Optional<Vehicle> vehicle(String tenantCode, String resourceType, UUID id) {
        return store.vehicle(tenantCode, Check.oneOf(resourceType, RESOURCE_TYPE, TRUCK, TRAILER), id);
    }

    @Override
    public Optional<Driver> driver(String tenantCode, UUID id) {
        return store.driverSummary(tenantCode, id);
    }

    @Override
    public Optional<Carrier> carrier(String tenantCode, UUID id) {
        return store.carrierSummary(tenantCode, id);
    }

    @Override
    public List<Carrier> carriers(String tenantCode, String query, int limit) {
        String q = query == null || query.isBlank() ? null : query.trim();
        return store.listActiveCarriers(tenantCode, q, limit).stream()
                .map(c -> new Carrier(UUID.fromString(c.id()), c.legalName(), c.phone(), c.rut()))
                .toList();
    }

    @Override
    public Optional<Match> byPlate(String tenantCode, String resourceType, String plate) {
        String table = Check.oneOf(resourceType, RESOURCE_TYPE, TRUCK, TRAILER);
        return key(plate).flatMap(k -> store.findByKey(tenantCode, table, k));
    }

    @Override
    public Optional<Match> driverByDocument(String tenantCode, String document) {
        return key(document).flatMap(k -> store.findByKey(tenantCode, DRIVER, k));
    }

    @Override
    public Optional<Match> carrierByTaxId(String tenantCode, String taxId) {
        return key(taxId).flatMap(k -> store.findByKey(tenantCode, CARRIER, k));
    }

    @Override
    public UUID registerCarrier(String tenantCode, String actor, String taxId, String legalName) {
        String tax = Check.required(taxId, "taxId", 32);
        String name = legalName == null || legalName.isBlank() ? tax : legalName.trim();
        return register(tenantCode, CARRIER, tax, () -> resources.createCarrier(tenantCode, actor,
                new CarrierRequest(null, tax, name, null, null, null, null, null, null, null, REGISTERED_BY)).id());
    }

    @Override
    public UUID registerVehicle(String tenantCode, String actor, String resourceType, String plate,
            UUID carrierId) {
        String carrier = Check.required(carrierId == null ? null : carrierId.toString(), "carrierId", 64);
        String type = Check.oneOf(resourceType, RESOURCE_TYPE, TRUCK, TRAILER);
        return register(tenantCode, type, plate, () -> switch (type) {
            case TRUCK -> resources.createTruck(tenantCode, actor, new TruckRequest(carrier, null, plate, null,
                    null, null, null, null, null, REGISTERED_BY)).id();
            default -> resources.createTrailer(tenantCode, actor, new TrailerRequest(carrier, null, plate, null,
                    null, null, null, null, REGISTERED_BY)).id();
        });
    }

    @Override
    public UUID registerDriver(String tenantCode, String actor, String document, String fullName,
            String mobilePhone, UUID carrierId) {
        return register(tenantCode, DRIVER, document, () -> resources.createDriver(tenantCode, actor, new DriverRequest(
                carrierId == null ? null : carrierId.toString(), null, document, null, null, fullName, null,
                mobilePhone, null, null, null, null, REGISTERED_BY)).id());
    }

    /**
     * Rechecks the normalized key after a transaction-scoped lock. One tenant lock also avoids deadlocks when
     * concurrent services name several new drivers in different orders. Known resources keep the lockless read path.
     */
    private UUID register(String tenantCode, String type, String rawKey, Supplier<String> create) {
        String normalized = key(rawKey).orElseThrow(() -> new IllegalArgumentException("resource key is required"));
        return tx.inTransaction(() -> {
            store.lockRegistrations(tenantCode);
            Optional<Match> existing = store.findByKey(tenantCode, type, normalized);
            if (existing.isPresent() && !existing.get().active()) {
                throw new IllegalStateException(type + " " + rawKey + " is inactive");
            }
            return existing.map(Match::id).orElseGet(() -> UUID.fromString(create.get()));
        });
    }

    /** A plate or document upper-cased and stripped to letters and digits; empty when nothing is left. */
    static Optional<String> key(String raw) {
        String k = raw == null ? "" : raw.replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT);
        return k.isEmpty() ? Optional.empty() : Optional.of(k);
    }
}
