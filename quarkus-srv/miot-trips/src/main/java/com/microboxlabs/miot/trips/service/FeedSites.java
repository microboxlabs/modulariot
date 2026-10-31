package com.microboxlabs.miot.trips.service;

import com.microboxlabs.miot.trips.domain.Location;
import com.microboxlabs.miot.trips.domain.Location.Placement;
import com.microboxlabs.miot.trips.dto.FeedServiceRequest;
import com.microboxlabs.miot.trips.dto.FeedServiceRequest.Site;
import com.microboxlabs.miot.trips.dto.LocationResolveRequest;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Locale;
import com.microboxlabs.miot.trips.geo.Addresses;
import org.jboss.logging.Logger;

/**
 * Locates the origin and destination a feed declares, after the service is applied and outside its transaction. A
 * location is located when it was never tried, or when it waits for review and the feed now sends a different site.
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
    public List<String> locate(String organization, String tenantCode, String actor, FeedServiceRequest desired) {
        List<String> done = new ArrayList<>();
        if (desired == null) {
            return done;
        }
        locate(organization, tenantCode, actor, desired.origin(), desired.originSite(), done);
        if (desired.originSite() == null || !Objects.equals(desired.origin(), desired.destination())) {
            locate(organization, tenantCode, actor, desired.destination(), desired.destinationSite(), done);
        }
        return done;
    }

    private void locate(String organization, String tenantCode, String actor, String code, Site site,
            List<String> done) {
        if (code == null || code.isBlank() || site == null) {
            return;
        }
        try {
            Location l = locations.byCode(tenantCode, code.trim()).orElse(null);
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
