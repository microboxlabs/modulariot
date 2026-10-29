package com.microboxlabs.miot.trips.service;

import com.google.openlocationcode.OpenLocationCode;
import com.microboxlabs.miot.core.geocoding.AllowAllGeocodingGate;
import com.microboxlabs.miot.core.geocoding.GeocodingGate;
import com.microboxlabs.miot.integrations.geocoding.Geocoder;
import com.microboxlabs.miot.integrations.geocoding.GeocodingMetrics;
import com.microboxlabs.miot.integrations.geocoding.GeocodingProvider.Candidate;
import com.microboxlabs.miot.integrations.geocoding.GeocodingProvider.Query;
import com.microboxlabs.miot.trips.domain.Location;
import com.microboxlabs.miot.trips.domain.Location.Placement;
import com.microboxlabs.miot.trips.geo.AdminBoundaries;
import com.microboxlabs.miot.trips.geo.AdminBoundaries.Boundary;
import com.microboxlabs.miot.trips.geo.Addresses;
import com.microboxlabs.miot.trips.geo.GeoShape;
import com.microboxlabs.miot.trips.store.GeocodeCache;
import com.microboxlabs.miot.trips.store.GeofenceDirectory;
import com.microboxlabs.miot.trips.store.GeofenceDirectory.Geofence;
import com.microboxlabs.miot.trips.store.InternalAddresses;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Finds a site's point. Sources, first that applies: a geofence of the tenant with the site's code or name, a Plus
 * Code (a short one is recovered from the district's centroid), the caller's coordinates, the internal address
 * table (Chile), the shared geocode cache, then the geocoding provider. The address sources need a district with a
 * boundary, and the provider counts only address-level results. The provider is asked only when the
 * {@link GeocodingGate} allows it; when the organization's quota is used up the site needs review. The point must fall in the declared district, or
 * within {@link #BORDER_METERS} of it, to resolve; otherwise, or with no source, the site needs review.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class LocationResolver {

    /** Slack at district borders: the boundary layers are simplified. */
    static final double BORDER_METERS = 500;

    public static final String GEOFENCE = "geofence";
    public static final String PLUS_CODE = "plus_code";
    public static final String COORDINATES = "coordinates";
    public static final String MANUAL = "manual";
    public static final String INTERNAL = "internal";
    public static final String PROVIDER = "provider";

    /** What the caller declares about a site; {@code code} and {@code name} match an existing geofence. */
    public record Site(String code, String name, String address, String country, String districtCode,
            String districtName, String plusCode, Double latitude, Double longitude) {
    }

    /**
     * The provider behind the result: {@code provider} asked or whose cached result was used, {@code called} when it
     * answered during this resolution, at {@code costUsd}.
     */
    public record Usage(String provider, boolean cacheHit, boolean called, BigDecimal costUsd) {
        static final Usage NONE = new Usage(null, false, false, null);
    }

    /** {@code geofenceId} is the existing geofence that resolved the site, or null. */
    public record Outcome(Placement placement, Integer geofenceId, Usage usage) {

        public Outcome(Placement placement, Integer geofenceId) {
            this(placement, geofenceId, Usage.NONE);
        }

        public boolean resolved() {
            return Location.RESOLVED.equals(placement.status());
        }
    }

    private record Point(double lon, double lat) {
    }

    private record Found(Point point, String source, Integer geofenceId, String note) {
    }

    private record District(Boundary boundary, String note) {
    }

    /** What the address sources found: a point, or a note on why not. */
    private record ByAddress(Found found, String note, Usage usage) {
    }

    private final GeofenceDirectory geofences;
    private final AdminBoundaries boundaries;
    private final InternalAddresses addresses;
    private final GeocodeCache cache;
    private final Geocoder geocoder;
    private final GeocodingGate gate;
    private final GeocodingMetrics metrics;

    /** Every provider call allowed, no meters. */
    public LocationResolver(GeofenceDirectory geofences, AdminBoundaries boundaries, InternalAddresses addresses,
            GeocodeCache cache, Geocoder geocoder) {
        this(geofences, boundaries, addresses, cache, geocoder, new AllowAllGeocodingGate(), GeocodingMetrics.NONE);
    }

    @Inject
    public LocationResolver(GeofenceDirectory geofences, AdminBoundaries boundaries, InternalAddresses addresses,
            GeocodeCache cache, Geocoder geocoder, GeocodingGate gate, GeocodingMetrics metrics) {
        this.geofences = geofences;
        this.boundaries = boundaries;
        this.addresses = addresses;
        this.cache = cache;
        this.geocoder = geocoder;
        this.gate = gate;
        this.metrics = metrics;
    }

    /** Tries the sources in order. {@code organization} is whose quota a provider call uses; it may be null. */
    public Outcome resolve(String organization, String tenantCode, Site site) {
        return locate(organization, tenantCode, site, false);
    }

    /** A point set by hand: Plus Code or coordinates, never an existing geofence; the source is manual. */
    public Outcome place(Site site) {
        return locate(null, null, site, true);
    }

    private Outcome locate(String organization, String tenantCode, Site site, boolean manual) {
        String country = site.country() == null ? null : site.country().strip().toUpperCase(Locale.ROOT);
        District district = district(country, site);
        Boundary b = district.boundary();
        Placement declared = new Placement(site.address(), country,
                b != null ? b.code() : site.districtCode(), b != null ? b.name() : site.districtName(),
                null, null, null, null, null, null);
        Found found = manual ? null : fromGeofence(tenantCode, site);
        String note = null;
        if (found == null && site.plusCode() != null && !site.plusCode().isBlank()) {
            found = fromPlusCode(site.plusCode(), b);
            note = found.note();
            found = found.point() == null ? null : found;
        }
        if (found == null && (site.latitude() != null || site.longitude() != null)) {
            found = fromCoordinates(site.latitude(), site.longitude());
            note = note == null ? found.note() : note;
            found = found.point() == null ? null : found;
        }
        Usage usage = Usage.NONE;
        if (found == null && !manual && blankToNull(site.address()) != null && b != null && b.shape() != null) {
            ByAddress byAddress = fromAddress(organization, tenantCode, country, b, site.address());
            found = byAddress.found();
            note = note == null ? byAddress.note() : note;
            usage = byAddress.usage();
        }
        if (found == null) {
            return review(declared, null, null, note != null ? note : nothingNote(site, b), usage);
        }
        String source = manual ? MANUAL : found.source();
        Point p = found.point();
        if (b == null) {
            return review(declared, p, source, district.note(), usage);
        }
        if (b.shape() == null) {
            return review(declared, p, source, "district " + b.code() + " has no boundary to check against",
                    usage);
        }
        if (!inside(b, p)) {
            String where = boundaries.containing(country, p.lon(), p.lat())
                    .map(o -> "the point is in " + o.name() + " (" + o.code() + ")")
                    .orElse("the point is outside " + country);
            return review(declared, p, source, where + ", not in " + b.name() + " (" + b.code() + ")", usage);
        }
        return new Outcome(declared.withResult(plusCode(p), p.lat(), p.lon(), source, Location.RESOLVED, null),
                found.geofenceId(), usage);
    }

    private static String nothingNote(Site site, Boundary b) {
        if (blankToNull(site.address()) == null) {
            return "no geofence, plus code or coordinates";
        }
        return b == null || b.shape() == null
                ? "an address needs a district with a boundary to be geocoded"
                : "no geofence, plus code or coordinates";
    }

    private static boolean inside(Boundary b, Point p) {
        return b.shape().contains(p.lon(), p.lat()) || b.shape().distanceMeters(p.lon(), p.lat()) <= BORDER_METERS;
    }

    /**
     * Steps 4 and 5: the internal address table, then the shared cache, then the provider if the gate allows it. A
     * provider result is kept in the cache only when it resolves and the provider's terms allow storing it.
     */
    private ByAddress fromAddress(String organization, String tenantCode, String country, Boundary b,
            String address) {
        if (addresses.supports(country)) {
            var street = Addresses.street(address);
            if (street.isPresent()) {
                var match = addresses.find(country, Addresses.spellings(b.name(), false),
                        Addresses.spellings(street.get().name(), true), street.get().number());
                if (match.isPresent()) {
                    return new ByAddress(new Found(new Point(match.get().lon(), match.get().lat()), INTERNAL, null,
                            null), null, Usage.NONE);
                }
            }
        }
        String key = Addresses.key(address, b.name());
        var cached = cache.find(key, country);
        metrics.cacheLookup(cached.isPresent());
        if (cached.isPresent()) {
            return new ByAddress(new Found(new Point(cached.get().lon(), cached.get().lat()), PROVIDER, null, null),
                    null, new Usage(cached.get().provider(), true, false, null));
        }
        GeocodingGate.Refusal refusal = gate.checkProviderCall(organization, tenantCode);
        if (refusal != null) {
            return new ByAddress(null, "geocoding: " + refusal.message(), Usage.NONE);
        }
        Geocoder.Result r = geocoder.forward(tenantCode, new Query(address, b.name(), country));
        Usage usage = new Usage(r.provider(), false, r.called(), r.costUsd());
        if (!r.called()) {
            return new ByAddress(null, "geocoding: " + r.error(), usage);
        }
        List<Candidate> exact = r.candidates().stream().filter(Candidate::addressLevel).toList();
        if (exact.isEmpty()) {
            String type = r.candidates().isEmpty() ? null : r.candidates().get(0).type();
            String best = r.candidates().isEmpty() ? "nothing" : "only " + (type == null ? "a coarser place" : type);
            return new ByAddress(null, r.provider() + " found " + best + ", not an address", usage);
        }
        Candidate pick = exact.stream().filter(c -> inside(b, new Point(c.lon(), c.lat()))).findFirst()
                .orElse(exact.get(0));
        Point p = new Point(pick.lon(), pick.lat());
        if (r.storable() && inside(b, p)) {
            cache.put(key, country, new GeocodeCache.Entry(p.lat(), p.lon(), PROVIDER, r.provider(),
                    OffsetDateTime.now()));
        }
        return new ByAddress(new Found(p, PROVIDER, null, null), null, usage);
    }

    private District district(String country, Site site) {
        if (country == null || country.isBlank()) {
            return new District(null, "country is required to check the district");
        }
        if (!boundaries.supports(country)) {
            return new District(null, "country " + country + " has no district boundaries");
        }
        if (site.districtCode() != null && !site.districtCode().isBlank()) {
            return boundaries.byCode(country, site.districtCode()).map(b -> new District(b, null))
                    .orElseGet(() -> new District(null, "district code " + site.districtCode().strip()
                            + " not found in " + country));
        }
        if (site.districtName() == null || site.districtName().isBlank()) {
            return new District(null, "district is required");
        }
        List<Boundary> named = boundaries.byName(country, site.districtName());
        if (named.size() == 1) {
            return new District(named.get(0), null);
        }
        return new District(null, named.isEmpty()
                ? "district " + site.districtName().strip() + " not found in " + country
                : "district " + site.districtName().strip() + " is ambiguous in " + country + "; send its code");
    }

    private Found fromGeofence(String tenantCode, Site site) {
        String code = blankToNull(site.code());
        String name = blankToNull(site.name());
        List<Geofence> matches = geofences.matching(tenantCode, code, name, 2);
        Optional<Geofence> match = matches.stream().filter(g -> code != null && code.equals(g.code())).findFirst()
                .or(() -> matches.size() == 1 ? Optional.of(matches.get(0)) : Optional.empty());
        if (match.isEmpty()) {
            return null;
        }
        String shape = geofences.shapes(List.of(match.get().id())).get(match.get().id());
        if (shape == null) {
            return null;
        }
        try {
            double[] c = GeoShape.parse(shape).center();
            return new Found(new Point(c[0], c[1]), GEOFENCE, match.get().id(), null);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static Found fromPlusCode(String raw, Boundary district) {
        String code = raw.strip().split("\\s+")[0].toUpperCase(Locale.ROOT);
        if (!OpenLocationCode.isValidCode(code)) {
            return new Found(null, PLUS_CODE, null, "plus code " + code + " is not valid");
        }
        OpenLocationCode olc = new OpenLocationCode(code);
        if (olc.isShort()) {
            if (district == null || district.centroid() == null) {
                return new Found(null, PLUS_CODE, null, "a short plus code needs a district with a boundary");
            }
            olc = olc.recover(district.centroid()[1], district.centroid()[0]);
        }
        OpenLocationCode.CodeArea area = olc.decode();
        return new Found(new Point(area.getCenterLongitude(), area.getCenterLatitude()), PLUS_CODE, null, null);
    }

    private static Found fromCoordinates(Double lat, Double lon) {
        if (lat == null || lon == null) {
            return new Found(null, COORDINATES, null, "latitude and longitude go together");
        }
        if (!Double.isFinite(lat) || !Double.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180
                || (lat == 0 && lon == 0)) {
            return new Found(null, COORDINATES, null, "coordinates out of range");
        }
        return new Found(new Point(lon, lat), COORDINATES, null, null);
    }

    private static Outcome review(Placement declared, Point p, String source, String note, Usage usage) {
        return new Outcome(declared.withResult(p == null ? null : plusCode(p), p == null ? null : p.lat(),
                p == null ? null : p.lon(), source, Location.NEEDS_REVIEW, note), null, usage);
    }

    private static String plusCode(Point p) {
        return OpenLocationCode.encode(p.lat(), p.lon());
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.strip();
    }
}
