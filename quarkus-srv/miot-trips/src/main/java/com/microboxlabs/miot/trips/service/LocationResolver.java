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
import java.util.Set;

/**
 * Finds a site's point. Sources, first that applies: a geofence of the tenant with the site's code or name, a Plus
 * Code (a short one is recovered from the district's centroid), the caller's coordinates, the internal address
 * table (Chile), the shared geocode cache, then the geocoding provider through the tenant's own connection. A
 * resolved point from any source but a manual one is linked to the tenant's geofence that contains it. The
 * address sources need a district with a boundary: the declared one, the one the address names after its house
 * number, or the one of the internal address that matches it across the country. The internal table is matched by
 * street words (see {@link Addresses#streetScore}), and the provider counts only address-level results. The provider
 * is asked only when the {@link GeocodingGate} allows it; when the organization's quota is used up the site needs
 * review. The point must fall in the declared district, or
 * within {@link #BORDER_METERS} of it, to resolve; otherwise, or with no source, the site needs review.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class LocationResolver {

    /** Slack at district borders: the boundary layers are simplified. */
    static final double BORDER_METERS = 500;
    private static final org.jboss.logging.Logger LOG = org.jboss.logging.Logger.getLogger(LocationResolver.class);
    private static final String DISTRICT = "district ";
    private static final Set<String> COUNTRIES = Set.of(Locale.getISOCountries());

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

    /** What the address sources found: a point, or a note on why not; {@code district} when the address named it. */
    private record ByAddress(Found found, String note, Usage usage, Boundary district) {

        ByAddress(Found found, String note, Usage usage) {
            this(found, note, usage, null);
        }
    }

    /** Internal addresses read per lookup; a house number repeats at most a few hundred times in one commune. */
    private static final int ADDRESS_CANDIDATES = 1000;

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
        String country = country(site.country());
        District district = district(country, site);
        Boundary b = district.boundary();
        Placement declared = new Placement(site.address(), country,
                b != null ? b.code() : bounded(site.districtCode(), 16),
                b != null ? b.name() : bounded(site.districtName(), 255),
                null, null, null, null, null, null);
        ByAddress selected = fromSources(organization, tenantCode, site, manual, b, country);
        if (b == null && selected.district() != null) {
            b = selected.district();
            declared = new Placement(site.address(), country, b.code(), b.name(), null, null, null, null, null, null);
        }
        Found found = selected.found();
        Usage usage = selected.usage();
        if (found == null || found.point() == null) {
            return review(declared, null, null, selected.note(), usage);
        }
        String source = manual ? MANUAL : found.source();
        Point p = found.point();
        if (b == null) {
            return review(declared, p, source, district.note(), usage);
        }
        if (b.shape() == null) {
            return review(declared, p, source, DISTRICT + b.code() + " has no boundary to check against",
                    usage);
        }
        if (!inside(b, p)) {
            String where = boundaries.containing(country, p.lon(), p.lat())
                    .map(o -> "the point is in " + o.name() + " (" + o.code() + ")")
                    .orElse("the point is outside " + country);
            return review(declared, p, source, where + ", not in " + b.name() + " (" + b.code() + ")", usage);
        }
        Integer geofenceId = found.geofenceId();
        if (geofenceId == null && !manual) {
            try {
                geofenceId = covering(tenantCode, p);
            } catch (RuntimeException e) {
                LOG.warn("Geofence containment lookup failed", e);
                return review(declared, p, source, "could not check geofences for the point", usage);
            }
        }
        return new Outcome(declared.withResult(plusCode(p), p.lat(), p.lon(), source, Location.RESOLVED, null),
                geofenceId, usage);
    }

    /** The first geofence of the tenant that contains the point; which one wins among several is not decided yet. */
    private Integer covering(String tenantCode, Point p) {
        if (tenantCode == null) return null;
        return geofences.containing(tenantCode, p.lon(), p.lat(), 1).stream().findFirst().map(Geofence::id)
                .orElse(null);
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
        Found internal = fromInternal(country, b, address);
        if (internal != null) return new ByAddress(internal, null, Usage.NONE);
        String key = b.code() + "|" + Addresses.key(address, b.name());
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
        if (!r.storable()) {
            return new ByAddress(null, "geocoding results cannot be stored with this provider configuration", usage);
        }
        List<Candidate> exact = r.candidates().stream().filter(Candidate::addressLevel).toList();
        if (exact.isEmpty()) {
            String best = "nothing";
            if (!r.candidates().isEmpty()) {
                String type = r.candidates().get(0).type();
                best = "only " + (type == null ? "a coarser place" : type);
            }
            return new ByAddress(null, r.provider() + " found " + best + ", not an address", usage);
        }
        Candidate pick = exact.stream().filter(c -> inside(b, new Point(c.lon(), c.lat()))).findFirst()
                .orElse(exact.get(0));
        Point p = new Point(pick.lon(), pick.lat());
        if (inside(b, p)) cacheResult(key, country, p, r.provider());
        return new ByAddress(new Found(p, PROVIDER, null, null), null, usage);
    }

    private Found fromInternal(String country, Boundary boundary, String address) {
        var street = Addresses.street(address);
        if (!addresses.supports(country) || street.isEmpty()) {
            return null;
        }
        var best = bestStreet(street.get().name(), addresses.numbered(country,
                Addresses.spellings(boundary.name(), false), street.get().number(), ADDRESS_CANDIDATES));
        return best == null ? null : new Found(new Point(best.point().lon(), best.point().lat()), INTERNAL, null, null);
    }

    /**
     * An address with no district declared: the district it names after the house number, then the internal table
     * across the country, whose row gives the district.
     */
    private ByAddress fromAddressAlone(String organization, String tenantCode, String country, String address) {
        var named = boundaries.namedIn(country, Addresses.afterNumber(address)).filter(n -> n.shape() != null);
        if (named.isPresent()) {
            ByAddress r = fromAddress(organization, tenantCode, country, named.get(), address);
            return new ByAddress(r.found(), r.note(), r.usage(), named.get());
        }
        if (!addresses.supports(country)) {
            return new ByAddress(null, "an address needs a district with a boundary to be geocoded", Usage.NONE);
        }
        var street = Addresses.street(address);
        if (street.isPresent()) {
            var best = bestStreet(street.get().name(),
                    addresses.numbered(country, List.of(), street.get().number(), ADDRESS_CANDIDATES));
            List<Boundary> commune = best == null ? List.of() : boundaries.byName(country, best.commune());
            if (commune.size() == 1) {
                return new ByAddress(new Found(new Point(best.point().lon(), best.point().lat()), INTERNAL, null, null),
                        null, Usage.NONE, commune.get(0));
            }
        }
        return new ByAddress(null, "the address names no district and is not in the internal addresses", Usage.NONE);
    }

    /** The candidate whose street matches the name best; null when none does or two different streets tie. */
    private static InternalAddresses.Candidate bestStreet(String name, List<InternalAddresses.Candidate> candidates) {
        List<String> words = Addresses.streetTokens(name);
        InternalAddresses.Candidate best = null;
        double top = 0;
        boolean tie = false;
        for (var c : candidates) {
            double score = Addresses.streetScore(words, Addresses.streetTokens(c.street()));
            if (score > top) {
                best = c;
                top = score;
                tie = false;
            } else if (score > 0 && score == top && !sameStreet(best, c)) {
                tie = true;
            }
        }
        return tie ? null : best;
    }

    private static boolean sameStreet(InternalAddresses.Candidate a, InternalAddresses.Candidate b) {
        return Addresses.fold(a.commune()).equals(Addresses.fold(b.commune()))
                && Addresses.streetTokens(a.street()).equals(Addresses.streetTokens(b.street()));
    }

    private void cacheResult(String key, String country, Point point, String provider) {
        try {
            cache.put(key, country, new GeocodeCache.Entry(point.lat(), point.lon(), PROVIDER, provider,
                    OffsetDateTime.now(java.time.ZoneOffset.UTC)));
        } catch (RuntimeException cause) {
            LOG.warn("Geocoding result was resolved but could not be cached", cause);
        }
    }

    private ByAddress fromSources(String organization, String tenantCode, Site site, boolean manual, Boundary district, String country) {
        Found point = fromPointSources(tenantCode, site, manual, district);
        if (point.point() != null) return new ByAddress(point, null, Usage.NONE);
        if (!manual && blankToNull(site.address()) != null) {
            if (district != null && district.shape() != null) {
                return fromAddress(organization, tenantCode, country, district, site.address());
            }
            boolean undeclared = blankToNull(site.districtCode()) == null && blankToNull(site.districtName()) == null;
            if (district == null && country != null && undeclared) {
                return fromAddressAlone(organization, tenantCode, country, site.address());
            }
        }
        return new ByAddress(null, point.note() != null ? point.note() : nothingNote(site, district), Usage.NONE);
    }

    private Found fromPointSources(String tenantCode, Site site, boolean manual, Boundary district) {
        Found found = manual ? null : fromGeofence(tenantCode, site);
        if (found != null) return found;
        String note = null;
        if (site.plusCode() != null && !site.plusCode().isBlank()) {
            found = fromPlusCode(site.plusCode(), district);
            if (found.point() != null) return found;
            note = found.note();
        }
        if (site.latitude() != null || site.longitude() != null) {
            found = fromCoordinates(site.latitude(), site.longitude());
            if (found.point() != null) return found;
            return new Found(null, found.source(), null, note == null ? found.note() : note);
        }
        return new Found(null, null, null, note);
    }

    private static String country(String raw) {
        String code = raw == null ? null : raw.strip().toUpperCase(Locale.ROOT);
        return code != null && COUNTRIES.contains(code) ? code : null;
    }

    private static String bounded(String raw, int max) {
        String value = blankToNull(raw);
        return value != null && value.length() <= max ? value : null;
    }

    private District district(String country, Site site) {
        if (country == null || country.isBlank()) {
            return new District(null, "country is required to check the district");
        }
        if (site.districtCode() != null && site.districtCode().strip().length() > 16) {
            return new District(null, "district code is too long");
        }
        if (site.districtName() != null && site.districtName().strip().length() > 255) {
            return new District(null, "district name is too long");
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
                ? DISTRICT + site.districtName().strip() + " not found in " + country
                : DISTRICT + site.districtName().strip() + " is ambiguous in " + country + "; send its code");
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
            if (district == null || district.centroid().size() != 2) {
                return new Found(null, PLUS_CODE, null, "a short plus code needs a district with a boundary");
            }
            olc = olc.recover(district.centroid().get(1), district.centroid().get(0));
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
