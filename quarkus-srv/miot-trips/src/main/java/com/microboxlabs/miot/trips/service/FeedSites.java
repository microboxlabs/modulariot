package com.microboxlabs.miot.trips.service;

import com.google.openlocationcode.OpenLocationCode;
import com.microboxlabs.miot.trips.domain.Location;
import com.microboxlabs.miot.trips.domain.Location.Placement;
import com.microboxlabs.miot.trips.dto.FeedServiceRequest;
import com.microboxlabs.miot.trips.dto.FeedServiceRequest.Site;
import com.microboxlabs.miot.trips.dto.LocationResolveRequest;
import com.microboxlabs.miot.trips.geo.Addresses;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;
import org.jboss.logging.Logger;

/**
 * Locates the origin and destination a feed declares, after the service is applied and outside its transaction. A
 * missing site is inferred from an address or Plus Code cell using the feed's country. A location is located when
 * it was never tried, or when it waits for review and the feed now sends a different site.
 * A site that names one of the organization's geofences links the location to it and resolves it there; one that
 * names another geofence falls back to its other parts.
 * A resolved or rejected location, or one already linked to a geofence, is left as it is. A failure is logged and
 * does not fail the service: the location stays where review finds it.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class FeedSites {
    private static final Logger LOG = Logger.getLogger(FeedSites.class);

    private final LocationService locations;
    private final LocationResolutionService resolution;

    @Inject
    public FeedSites(LocationService locations, LocationResolutionService resolution) {
        this.locations = locations;
        this.resolution = resolution;
    }

    /** The locations it tried to locate, as "code: status". {@code organization} is whose quota a provider call uses. */
    public List<String> locate(String organization, String tenantCode, String actor, String country,
            FeedServiceRequest desired) {
        List<String> done = new ArrayList<>();
        if (desired == null) {
            return done;
        }
        boolean same = Objects.equals(desired.origin(), desired.destination());
        Site origin = desired.originSite();
        if (origin == null && same) {
            origin = desired.destinationSite();
        }
        locate(organization, tenantCode, actor, desired.origin(), origin, country, done);
        if (!same) {
            locate(organization, tenantCode, actor, desired.destination(), desired.destinationSite(), country, done);
        }
        return done;
    }

    private void locate(String organization, String tenantCode, String actor, String code, Site declared, String country,
            List<String> done) {
        if (code == null || code.isBlank()) {
            return;
        }
        if (declared != null && declared.geofenceId() != null
                && useGeofence(tenantCode, actor, code, declared.geofenceId(), done)) {
            return;
        }
        Site site = declared == null ? cellSite(code.strip(), country) : declared;
        if (site == null) {
            return;
        }
        try {
            Location l = locations.byCode(tenantCode, code).orElse(null);
            if (l == null || !due(l, site)) {
                return;
            }
            Location resolved = resolution.resolve(organization, tenantCode, actor, new LocationResolveRequest(
                    l.id(), null, null, null, site.address(), site.country(), site.districtCode(), site.district(),
                    site.plusCode(), site.latitude(), site.longitude()));
            done.add(code.trim() + ": " + resolved.placement().status());
        } catch (RuntimeException e) {
            LOG.warnf("Feed site %s of %s not located: %s", code, tenantCode, e.getMessage());
            done.add(code.trim() + ": could not resolve site");
        }
    }

    /**
     * Links the location to the geofence the feed declared. False when that geofence cannot be used, so the site's
     * other parts are tried.
     */
    private boolean useGeofence(String tenantCode, String actor, String code, int geofenceId, List<String> done) {
        try {
            Location l = locations.byCode(tenantCode, code).orElse(null);
            if (l == null || !geofenceDue(l)) {
                return true;
            }
            Location linked = resolution.useGeofence(tenantCode, actor, UUID.fromString(l.id()), geofenceId);
            done.add(code.trim() + ": " + linked.placement().status());
            return true;
        } catch (IllegalArgumentException e) {
            done.add(code.trim() + ": " + e.getMessage());
            return false;
        } catch (RuntimeException e) {
            LOG.warnf("Feed geofence %s of %s not linked: %s", code, tenantCode, e.getMessage());
            done.add(code.trim() + ": could not resolve site");
            return true;
        }
    }

    /** A location already linked, resolved or rejected keeps what it has. */
    static boolean geofenceDue(Location l) {
        String status = l.placement().status();
        return l.geofenceId() == null && !Location.RESOLVED.equals(status) && !Location.REJECTED.equals(status);
    }

    private static Site cellSite(String text, String country) {
        String plusCode = text.split("\\s+")[0].toUpperCase(Locale.ROOT);
        if (OpenLocationCode.isValidCode(plusCode)) {
            boolean shortCode = new OpenLocationCode(plusCode).isShort();
            if (country == null && shortCode) {
                return null;
            }
            return new Site(null, shortCode ? country : null, null, null, plusCode, null, null);
        }
        if (country != null && text.codePoints().anyMatch(Character::isWhitespace)
                && text.codePoints().anyMatch(Character::isLetter) && text.codePoints().anyMatch(Character::isDigit)) {
            return new Site(text, country, null, null, null, null, null);
        }
        return null;
    }

    static boolean due(Location l, Site site) {
        Placement p = l.placement();
        if (l.geofenceId() != null || Location.RESOLVED.equals(p.status()) || Location.REJECTED.equals(p.status())) {
            return false;
        }
        return p.status() == null || contextChanged(site, p) || pointChanged(site, p);
    }

    private static boolean contextChanged(Site site, Placement p) {
        return changed(site.address(), p.address())
                || changed(site.districtCode(), p.districtCode())
                || changed(country(site.country()), country(p.country()))
                || site.district() != null && !Addresses.fold(site.district()).equals(Addresses.fold(p.districtName()));
    }

    private static boolean pointChanged(Site site, Placement p) {
        return site.plusCode() != null && !site.plusCode().strip().equalsIgnoreCase(String.valueOf(p.plusCode()))
                || site.latitude() != null && !site.latitude().equals(p.latitude())
                || site.longitude() != null && !site.longitude().equals(p.longitude());
    }

    private static boolean changed(String requested, String saved) {
        return requested != null && !Objects.equals(requested.strip(), saved == null ? null : saved.strip());
    }

    private static String country(String value) {
        return value == null ? null : value.strip().toUpperCase(Locale.ROOT);
    }
}
