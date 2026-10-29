package com.microboxlabs.miot.trips.service;

import com.google.openlocationcode.OpenLocationCode;
import com.microboxlabs.miot.trips.domain.Location;
import com.microboxlabs.miot.trips.domain.Location.Placement;
import com.microboxlabs.miot.trips.geo.AdminBoundaries;
import com.microboxlabs.miot.trips.geo.AdminBoundaries.Boundary;
import com.microboxlabs.miot.trips.geo.GeoShape;
import com.microboxlabs.miot.trips.store.GeofenceDirectory;
import com.microboxlabs.miot.trips.store.GeofenceDirectory.Geofence;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Finds a site's point without an external provider. Sources, first that applies: a geofence of the tenant with the
 * site's code or name, a Plus Code (a short one is recovered from the district's centroid), the caller's
 * coordinates. The point must fall in the declared district, or within {@link #BORDER_METERS} of it, to resolve;
 * otherwise, or with no source, the site needs review.
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

    /** What the caller declares about a site; {@code code} and {@code name} match an existing geofence. */
    public record Site(String code, String name, String address, String country, String districtCode,
            String districtName, String plusCode, Double latitude, Double longitude) {
    }

    /** {@code geofenceId} is the existing geofence that resolved the site, or null. */
    public record Outcome(Placement placement, Integer geofenceId) {

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

    private final GeofenceDirectory geofences;
    private final AdminBoundaries boundaries;

    @Inject
    public LocationResolver(GeofenceDirectory geofences, AdminBoundaries boundaries) {
        this.geofences = geofences;
        this.boundaries = boundaries;
    }

    /** Tries the three sources in order. */
    public Outcome resolve(String tenantCode, Site site) {
        return locate(tenantCode, site, false);
    }

    /** A point set by hand: Plus Code or coordinates, never an existing geofence; the source is manual. */
    public Outcome place(Site site) {
        return locate(null, site, true);
    }

    private Outcome locate(String tenantCode, Site site, boolean manual) {
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
        if (found == null) {
            return review(declared, null, null, note != null ? note : "no geofence, plus code or coordinates");
        }
        String source = manual ? MANUAL : found.source();
        Point p = found.point();
        if (b == null) {
            return review(declared, p, source, district.note());
        }
        if (b.shape() == null) {
            return review(declared, p, source, "district " + b.code() + " has no boundary to check against");
        }
        if (!b.shape().contains(p.lon(), p.lat()) && b.shape().distanceMeters(p.lon(), p.lat()) > BORDER_METERS) {
            String where = boundaries.containing(country, p.lon(), p.lat())
                    .map(o -> "the point is in " + o.name() + " (" + o.code() + ")")
                    .orElse("the point is outside " + country);
            return review(declared, p, source, where + ", not in " + b.name() + " (" + b.code() + ")");
        }
        return new Outcome(declared.withResult(plusCode(p), p.lat(), p.lon(), source, Location.RESOLVED, null),
                found.geofenceId());
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

    private static Outcome review(Placement declared, Point p, String source, String note) {
        return new Outcome(declared.withResult(p == null ? null : plusCode(p), p == null ? null : p.lat(),
                p == null ? null : p.lon(), source, Location.NEEDS_REVIEW, note), null);
    }

    private static String plusCode(Point p) {
        return OpenLocationCode.encode(p.lat(), p.lon());
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.strip();
    }
}
