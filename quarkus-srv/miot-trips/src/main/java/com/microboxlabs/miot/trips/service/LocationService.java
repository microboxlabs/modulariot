package com.microboxlabs.miot.trips.service;

import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.trips.domain.Location;
import com.microboxlabs.miot.trips.dto.LocationRequest;
import com.microboxlabs.miot.trips.store.GeofenceDirectory;
import com.microboxlabs.miot.trips.store.LocationStore;
import com.microboxlabs.miot.trips.store.TripStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.NoSuchElementException;
import java.util.UUID;

/**
 * Locations: the named places trips and mandates point at. A feed names them by external code, matched as sent; an
 * unknown code creates a zone with that code as its name. Each may point at one GPS geofence of the tenant.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class LocationService {
    private static final String LOCATION = "location";

    private static final String LOCATION_NOT_FOUND = "location not found";

    /** The type of a location a feed creates. */
    public static final String FEED_TYPE = "zone";
    private static final int NAME_MAX = 255;
    private static final int CODE_MAX = 128;

    private final LocationStore store;
    private final GeofenceDirectory geofences;
    private final TripStore trips;
    private final TripLiveProjector live;
    private final AuditService audit;
    private final Transactions tx;

    @Inject
    public LocationService(LocationStore store, GeofenceDirectory geofences, TripStore trips, TripLiveProjector live,
            AuditService audit, Transactions tx) {
        this.store = store;
        this.geofences = geofences;
        this.trips = trips;
        this.live = live;
        this.audit = audit;
        this.tx = tx;
    }

    public List<Location> list(String tenantCode, String q, String type, String status, Integer page,
            Integer size) {
        int p = page == null ? 0 : Math.max(page, 0);
        int s = size == null ? 50 : size;
        if (s < 1 || s > MandateService.MAX_PAGE_SIZE) {
            throw new IllegalArgumentException("size must be between 1 and " + MandateService.MAX_PAGE_SIZE);
        }
        String st = Check.blankToNull(status);
        if (st != null) {
            Check.oneOf(st, "status", Location.RESOLVED, Location.NEEDS_REVIEW, Location.REJECTED);
        }
        return store.list(tenantCode, Check.blankToNull(q), Check.blankToNull(type), st, p, s);
    }

    public Location create(String tenantCode, String actor, LocationRequest body) {
        LocationRequest req = body == null ? LocationRequest.empty() : body;
        String type = Check.oneOf(Check.required(req.type(), "type", 32), "type",
                "plant", "port", "distribution_center", "customer", "zone");
        Location created = store.insert(new Location(null, tenantCode,
                Check.required(req.name(), "name", NAME_MAX), type,
                Check.limitedOrNull(req.externalCode(), "externalCode", CODE_MAX),
                req.geomGeojson() == null ? null : req.geomGeojson().toString(),
                null, actor, null, actor));
        audit.log(tenantCode, actor, "location.created", LOCATION, created.id(), null,
                Map.of("name", created.name(), "type", type));
        return created;
    }

    /** Refreshes the hot row of the open trips that start or end there; their label is the location's name. */
    public Location update(String tenantCode, String actor, UUID id, LocationRequest body) {
        return tx.inTransaction(() -> {
            LocationRequest req = body == null ? LocationRequest.empty() : body;
            Location l = store.find(tenantCode, id)
                    .orElseThrow(() -> new NoSuchElementException(LOCATION_NOT_FOUND));
            String type = req.type() == null ? l.type()
                    : Check.oneOf(req.type(), "type", "plant", "port", "distribution_center", "customer", "zone");
            Location updated = store.update(new Location(l.id(), tenantCode,
                    req.name() == null ? l.name() : Check.required(req.name(), "name", NAME_MAX), type,
                    Check.orKeep(req.externalCode(), l.externalCode(), "externalCode", CODE_MAX),
                    req.geomGeojson() == null ? l.geomGeojson() : req.geomGeojson().toString(),
                    l.geofenceId(), l.createdAt(), l.createdBy(), null, actor))
                    .orElseThrow(() -> new NoSuchElementException(LOCATION_NOT_FOUND));
            // always: the name read above is not locked, so a concurrent rename can make it stale
            live.refreshAll(tenantCode, trips.openTripsAt(tenantCode, id));
            audit.log(tenantCode, actor, "location.updated", LOCATION, updated.id(), null, Map.of());
            return updated;
        });
    }

    /** Points the location at a GPS geofence of the tenant, or at none; the open trips there pick it up. */
    public Location linkGeofence(String tenantCode, String actor, UUID id, Integer geofenceId) {
        if (geofenceId != null && geofences.find(tenantCode, geofenceId).isEmpty()) {
            throw new IllegalArgumentException("geofence " + geofenceId + " not found");
        }
        return tx.inTransaction(() -> {
            Location updated = store.setGeofence(tenantCode, id, geofenceId, actor)
                    .orElseThrow(() -> new NoSuchElementException(LOCATION_NOT_FOUND));
            live.refreshAll(tenantCode, trips.openTripsAt(tenantCode, id));
            Map<String, Object> details = new HashMap<>();
            details.put("geofenceId", geofenceId);
            audit.log(tenantCode, actor, "location.geofence_linked", LOCATION, updated.id(), null, details);
            return updated;
        });
    }

    public List<GeofenceDirectory.Geofence> geofences(String tenantCode, String q, Integer size) {
        int s = size == null ? 50 : size;
        if (s < 1 || s > MandateService.MAX_PAGE_SIZE) {
            throw new IllegalArgumentException("size must be between 1 and " + MandateService.MAX_PAGE_SIZE);
        }
        return geofences.search(tenantCode, Check.blankToNull(q), s);
    }

    /** The current location with that external code as sent, without creating it. */
    public Optional<Location> byCode(String tenantCode, String code) {
        return store.byCode(tenantCode, Check.limited(code, LOCATION, CODE_MAX));
    }

    /** The location with that external code as sent; created as a zone named after the code when missing. */
    public Location resolve(String tenantCode, String actor, String code) {
        String c = Check.limited(code, LOCATION, CODE_MAX);
        if (c.isBlank()) {
            throw new IllegalArgumentException("location is required");
        }
        return store.byCode(tenantCode, c).orElseGet(() -> store.insertIfAbsent(new Location(null, tenantCode,
                c, FEED_TYPE, c, null, null, actor, null, actor)).map(created -> {
                    audit.log(tenantCode, actor, "location.created", LOCATION, created.id(), null,
                            Map.of("name", created.name(), "type", FEED_TYPE));
                    return created;
                }).or(() -> store.byCode(tenantCode, c))
                .orElseThrow(() -> new IllegalStateException("location " + c + " could not be created")));
    }
}
