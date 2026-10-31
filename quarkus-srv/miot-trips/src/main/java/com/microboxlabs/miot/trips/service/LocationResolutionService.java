package com.microboxlabs.miot.trips.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.integrations.service.GeocodeUsageService;
import com.microboxlabs.miot.integrations.service.GeocodeUsageService.Resolution;
import com.microboxlabs.miot.trips.domain.Location;
import com.microboxlabs.miot.trips.domain.Location.Placement;
import com.microboxlabs.miot.trips.dto.LocationPointRequest;
import com.microboxlabs.miot.trips.dto.LocationRequest;
import com.microboxlabs.miot.trips.dto.LocationResolveRequest;
import com.microboxlabs.miot.trips.dto.LocationResolveResult;
import com.microboxlabs.miot.trips.dto.LocationView;
import com.microboxlabs.miot.trips.service.LocationResolver.Outcome;
import com.microboxlabs.miot.trips.service.LocationResolver.Site;
import com.microboxlabs.miot.trips.store.GeofenceDirectory;
import com.microboxlabs.miot.trips.store.LocationStore;
import com.microboxlabs.miot.trips.store.TripStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.UUID;
import java.util.function.Function;
import org.jboss.logging.Logger;

/**
 * Locates sites with {@link LocationResolver} and keeps the result on the location. A resolved site points at a GPS
 * geofence of the tenant: the one that matched, or a new one around the point, sized by the site's type. The GPS
 * write happens before the modulith transaction; a retry finds the geofence by its code. Each resolution is
 * recorded in the geocoding usage.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class LocationResolutionService {
    private static final Logger LOG = Logger.getLogger(LocationResolutionService.class);
    private static final String LOCATION = "location";
    private static final String LOCATION_NOT_FOUND = "location not found";
    public static final int MAX_BATCH = 200;
    private static final int NOTE_MAX = 255;
    private static final int CIRCLE_VERTICES = 32;
    private static final double METERS_PER_DEGREE = 111_320;
    private static final ObjectMapper JSON = new ObjectMapper();

    /** Geofence radius in meters by location type. */
    static final Map<String, Integer> RADIUS = Map.of("plant", 500, "port", 1000, "distribution_center", 300,
            "customer", 150, "zone", 200);

    private final LocationStore store;
    private final LocationService locations;
    private final LocationResolver resolver;
    private final GeofenceDirectory geofences;
    private final TripStore trips;
    private final TripLiveProjector live;
    private final AuditService audit;
    private final Transactions tx;
    private final GeocodeUsageService usage;

    @Inject
    public LocationResolutionService(LocationStore store, LocationService locations, LocationResolver resolver,
            GeofenceDirectory geofences, TripStore trips, TripLiveProjector live, AuditService audit,
            Transactions tx, GeocodeUsageService usage) {
        this.store = store;
        this.locations = locations;
        this.resolver = resolver;
        this.geofences = geofences;
        this.trips = trips;
        this.live = live;
        this.audit = audit;
        this.tx = tx;
        this.usage = usage;
    }

    /**
     * Fields the request leaves out keep what the location has. {@code organization} is whose geocoding quota a
     * provider call uses.
     */
    public Location resolve(String organization, String tenantCode, String actor, LocationResolveRequest req) {
        if (req == null) {
            throw new IllegalArgumentException("body is required");
        }
        Location l = target(tenantCode, actor, req);
        Placement p = l.placement();
        Site site = new Site(code(l), l.name(), or(req.address(), p.address()), or(req.country(), p.country()),
                districtCode(req.districtCode(), req.district(), p),
                req.districtCode() != null ? req.district() : or(req.district(), p.districtName()),
                pointCode(req.plusCode(), req.latitude(), req.longitude(), p),
                latitude(req.plusCode(), req.latitude(), req.longitude(), p),
                longitude(req.plusCode(), req.latitude(), req.longitude(), p));
        Outcome outcome = resolver.resolve(organization, tenantCode, site);
        Location resolved;
        try {
            resolved = finish(tenantCode, actor, l, outcome);
        } catch (RuntimeException e) {
            // A provider call that was made is still charged.
            recordUsage(organization, tenantCode, actor, outcome.placement(), outcome.usage());
            throw e;
        }
        recordUsage(organization, tenantCode, actor, resolved.placement(), outcome.usage());
        return resolved;
    }

    /** Usage is for charging; a failure to record it does not undo the resolution. */
    private void recordUsage(String organization, String tenantCode, String actor, Placement p,
            LocationResolver.Usage u) {
        try {
            usage.recordResolution(new Resolution(organization, tenantCode, actor, p.source(), p.status(), u.provider(), u.cacheHit(),
                    u.called(), u.costUsd()));
        } catch (RuntimeException e) {
            LOG.warnf("Geocoding usage of %s not recorded: %s", tenantCode, e.getMessage());
        }
    }

    /** Each site on its own: one that fails does not stop the others. */
    public List<LocationResolveResult> resolveAll(String organization, String tenantCode, String actor,
            List<LocationResolveRequest> sites) {
        return resolveAll(organization, tenantCode, actor, sites, Function.identity());
    }

    public <T> List<LocationResolveResult> resolveAll(String organization, String tenantCode, String actor, List<T> sites,
            Function<T, LocationResolveRequest> decode) {
        if (sites == null || sites.isEmpty()) {
            throw new IllegalArgumentException("sites are required");
        }
        if (sites.size() > MAX_BATCH) {
            throw new IllegalArgumentException("at most " + MAX_BATCH + " sites per request");
        }
        List<LocationResolveResult> out = new ArrayList<>();
        for (int i = 0; i < sites.size(); i++) {
            try {
                out.add(new LocationResolveResult(i, LocationView.of(resolve(organization, tenantCode, actor, decode.apply(sites.get(i)))),
                        null));
            } catch (IllegalArgumentException | NoSuchElementException e) {
                out.add(new LocationResolveResult(i, null, e.getMessage()));
            } catch (RuntimeException e) {
                LOG.warnf(e, "Location resolution failed for item %d", i);
                out.add(new LocationResolveResult(i, null, "could not resolve site"));
            }
        }
        return out;
    }

    /** A point set by hand; rejected with the reason when it fails the district check. */
    public Location place(String tenantCode, String actor, UUID id, LocationPointRequest req) {
        if (req == null) {
            throw new IllegalArgumentException("body is required");
        }
        Location l = store.find(tenantCode, id).orElseThrow(() -> new NoSuchElementException(LOCATION_NOT_FOUND));
        Placement p = l.placement();
        Outcome outcome = resolver.place(new Site(code(l), l.name(), p.address(), or(req.country(), p.country()),
                districtCode(req.districtCode(), req.district(), p),
                req.districtCode() != null ? req.district() : or(req.district(), p.districtName()),
                pointCode(req.plusCode(), req.latitude(), req.longitude(), p),
                latitude(req.plusCode(), req.latitude(), req.longitude(), p),
                longitude(req.plusCode(), req.latitude(), req.longitude(), p)));
        if (!outcome.resolved()) {
            throw new IllegalArgumentException(outcome.placement().note());
        }
        Location placed = finish(tenantCode, actor, l, outcome);
        if (!Location.RESOLVED.equals(placed.placement().status())) {
            throw new IllegalStateException(placed.placement().note());
        }
        return placed;
    }

    /** Marks the site as one that cannot be located; its point and geofence stay as they are. */
    public Location reject(String tenantCode, String actor, UUID id, String note) {
        Location l = store.find(tenantCode, id).orElseThrow(() -> new NoSuchElementException(LOCATION_NOT_FOUND));
        Placement p = l.placement();
        Placement rejected = p.withResult(p.plusCode(), p.latitude(), p.longitude(), p.source(), Location.REJECTED,
                Check.limitedOrNull(note, "note", NOTE_MAX));
        Location updated = store.setPlacement(tenantCode, id, rejected, null, actor)
                .orElseThrow(() -> new NoSuchElementException(LOCATION_NOT_FOUND));
        audit.log(tenantCode, actor, "location.rejected", LOCATION, updated.id(), null, Map.of());
        return updated;
    }

    private Location target(String tenantCode, String actor, LocationResolveRequest req) {
        if (req.locationId() != null && !req.locationId().isBlank()) {
            UUID id;
            try {
                id = UUID.fromString(req.locationId().strip());
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("locationId must be a UUID");
            }
            return store.find(tenantCode, id).orElseThrow(() -> new NoSuchElementException(LOCATION_NOT_FOUND));
        }
        String code = Check.blankToNull(req.externalCode());
        if (code != null) {
            var existing = locations.byCode(tenantCode, code);
            if (existing.isPresent()) {
                return existing.get();
            }
        }
        return locations.create(tenantCode, actor, new LocationRequest(
                req.name() != null ? req.name() : code, req.type() != null ? req.type() : LocationService.FEED_TYPE,
                code, null));
    }

    private Location finish(String tenantCode, String actor, Location l, Outcome outcome) {
        Placement placement = outcome.placement();
        Integer geofenceId = outcome.geofenceId();
        if (outcome.resolved() && geofenceId == null) {
            String area = circle(placement.longitude(), placement.latitude(), RADIUS.getOrDefault(l.type(), 200));
            var created = LocationResolver.MANUAL.equals(placement.source())
                    ? geofences.place(tenantCode, l.id(), l.name(), area, properties(l, placement))
                    : geofences.create(tenantCode, code(l), l.name(), area, properties(l, placement));
            if (created.isPresent()) {
                geofenceId = created.get().id();
            } else {
                placement = placement.withResult(placement.plusCode(), placement.latitude(), placement.longitude(),
                        placement.source(), Location.NEEDS_REVIEW, "the GPS database is not configured");
            }
        }
        Placement stored = placement.withResult(placement.plusCode(), placement.latitude(), placement.longitude(),
                placement.source(), placement.status(), note(placement.note()));
        Integer linked = geofenceId;
        return tx.inTransaction(() -> {
            Location updated = store.setPlacement(tenantCode, UUID.fromString(l.id()), stored, linked, actor)
                    .orElseThrow(() -> new NoSuchElementException(LOCATION_NOT_FOUND));
            if (linked != null) {
                live.refreshAll(tenantCode, trips.openTripsAt(tenantCode, UUID.fromString(l.id())));
            }
            Map<String, Object> details = new HashMap<>();
            details.put("status", stored.status());
            details.put("source", stored.source());
            details.put("geofenceId", updated.geofenceId());
            audit.log(tenantCode, actor, "location." + stored.status(), LOCATION, updated.id(), null, details);
            return updated;
        });
    }

    private static String districtCode(String incomingCode, String incomingName, Placement current) {
        if (incomingCode != null) return incomingCode;
        return incomingName == null ? current.districtCode() : null;
    }

    private static boolean hasPoint(String code, Double lat, Double lon) {
        return code != null || lat != null || lon != null;
    }

    private static String pointCode(String code, Double lat, Double lon, Placement current) {
        return hasPoint(code, lat, lon) ? code : current.plusCode();
    }

    private static Double latitude(String code, Double lat, Double lon, Placement current) {
        return hasPoint(code, lat, lon) ? lat : current.latitude();
    }

    private static Double longitude(String code, Double lat, Double lon, Placement current) {
        return hasPoint(code, lat, lon) ? lon : current.longitude();
    }

    /** The geofence's code: the location's external code, or its id when it has none. */
    private static String code(Location l) {
        return l.externalCode() != null ? l.externalCode() : l.id();
    }

    private static String or(String incoming, String current) {
        return incoming != null ? incoming : current;
    }

    private static String note(String note) {
        return note == null || note.length() <= NOTE_MAX ? note : note.substring(0, NOTE_MAX);
    }

    private static String properties(Location l, Placement p) {
        Map<String, Object> props = new HashMap<>();
        props.put("created_by", "miot-trips");
        props.put("location_id", l.id());
        props.put("location_type", l.type());
        props.put("resolution_source", p.source());
        props.put("plus_code", p.plusCode());
        try {
            return JSON.writeValueAsString(props);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    /** A GeoJSON polygon approximating a circle of {@code meters} around the point. */
    static String circle(double lon, double lat, int meters) {
        double dLat = meters / METERS_PER_DEGREE;
        double dLon = dLat / Math.cos(Math.toRadians(lat));
        StringBuilder sb = new StringBuilder("{\"type\":\"Polygon\",\"coordinates\":[[");
        for (int i = 0; i <= CIRCLE_VERTICES; i++) {
            double a = 2 * Math.PI * (i % CIRCLE_VERTICES) / CIRCLE_VERTICES;
            sb.append(i == 0 ? "" : ",").append(String.format(Locale.ROOT, "[%.6f,%.6f]",
                    lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)));
        }
        return sb.append("]]}").toString();
    }
}
