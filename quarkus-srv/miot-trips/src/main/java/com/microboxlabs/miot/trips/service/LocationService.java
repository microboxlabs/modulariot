package com.microboxlabs.miot.trips.service;

import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.trips.domain.Location;
import com.microboxlabs.miot.trips.dto.LocationRequest;
import com.microboxlabs.miot.trips.store.LocationStore;
import com.microboxlabs.miot.trips.store.TripStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.UUID;

/** Locations: the named places trips and mandates point at. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class LocationService {

    private final LocationStore store;
    private final TripStore trips;
    private final TripLiveProjector live;
    private final AuditService audit;
    private final Transactions tx;

    @Inject
    public LocationService(LocationStore store, TripStore trips, TripLiveProjector live, AuditService audit,
            Transactions tx) {
        this.store = store;
        this.trips = trips;
        this.live = live;
        this.audit = audit;
        this.tx = tx;
    }

    public List<Location> list(String tenantCode, String q, String type, Integer page, Integer size) {
        int p = page == null ? 0 : Math.max(page, 0);
        int s = size == null ? 50 : size;
        if (s < 1 || s > MandateService.MAX_PAGE_SIZE) {
            throw new IllegalArgumentException("size must be between 1 and " + MandateService.MAX_PAGE_SIZE);
        }
        return store.list(tenantCode, Check.blankToNull(q), Check.blankToNull(type), p, s);
    }

    public Location create(String tenantCode, String actor, LocationRequest body) {
        LocationRequest req = body == null ? LocationRequest.empty() : body;
        String type = Check.oneOf(Check.required(req.type(), "type", 32), "type",
                "planta", "puerto", "cd", "cliente", "zona");
        Location created = store.insert(new Location(null, tenantCode,
                Check.required(req.name(), "name", 255), type,
                Check.limitedOrNull(req.externalCode(), "externalCode", 128),
                req.geomGeojson() == null ? null : req.geomGeojson().toString(),
                null, actor, null, actor));
        audit.log(tenantCode, actor, "location.created", "location", created.id(), null,
                Map.of("name", created.name(), "type", type));
        return created;
    }

    /** Refreshes the hot row of the open trips that start or end there; their label is the location's name. */
    public Location update(String tenantCode, String actor, UUID id, LocationRequest body) {
        return tx.inTransaction(() -> {
            LocationRequest req = body == null ? LocationRequest.empty() : body;
            Location l = store.find(tenantCode, id)
                    .orElseThrow(() -> new NoSuchElementException("location not found"));
            String type = req.type() == null ? l.type()
                    : Check.oneOf(req.type(), "type", "planta", "puerto", "cd", "cliente", "zona");
            Location updated = store.update(new Location(l.id(), tenantCode,
                    req.name() == null ? l.name() : Check.required(req.name(), "name", 255), type,
                    Check.orKeep(req.externalCode(), l.externalCode(), "externalCode", 128),
                    req.geomGeojson() == null ? l.geomGeojson() : req.geomGeojson().toString(),
                    l.createdAt(), l.createdBy(), null, actor))
                    .orElseThrow(() -> new NoSuchElementException("location not found"));
            // always: the name read above is not locked, so a concurrent rename can make it stale
            live.refreshAll(tenantCode, trips.openTripsAt(tenantCode, id));
            audit.log(tenantCode, actor, "location.updated", "location", updated.id(), null, Map.of());
            return updated;
        });
    }
}
