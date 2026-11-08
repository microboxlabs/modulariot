package com.microboxlabs.miot.symptoms.duty;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** The frame's zones on the duty check. */
class DutyChecksTest {

    private static final String TENANT = "tenant-a";
    private static final String ASSET = "DEMO01";
    private static final Instant T0 = Instant.parse("2026-01-01T00:00:00Z");
    private static final Map<String, Object> INSIDE = Map.of("authorized_zone", true, "zone", "Base",
            "outside_authorized", false);

    /** Two frames 60 s and about 1 km apart: one minute of driving. */
    private static Map<String, Object> run(Map<String, Object> extra) {
        DutyChecks checks = new DutyChecks(new InMemoryDutyStore());
        checks.save(TENANT, ASSET, checks.apply(TENANT, ASSET, T0, signal(-33.0, extra)).orElseThrow().next());
        return checks.apply(TENANT, ASSET, T0.plusSeconds(60), signal(-33.009, extra)).orElseThrow().check();
    }

    private static Map<String, Object> signal(double lat, Map<String, Object> extra) {
        Map<String, Object> s = new HashMap<>(Map.of("trip", Map.of("active", true, "id", "T-1"), "frame",
                Map.of("gps", Map.of("latitude", lat, "longitude", -70.0, "speed", 60.0))));
        s.putAll(extra);
        return s;
    }

    @Test
    void aFrameInAnAuthorizedZoneCarriesItsGeoAndCountsAsOutsideIt() {
        Map<String, Object> inside = run(Map.of("geo", INSIDE));
        Map<String, Object> outside = run(Map.of("geo", Map.of("authorized_zone", false)));

        assertEquals(INSIDE, inside.get("geo"));
        assertEquals(1.0, (Double) inside.get("driving_minutes"), 0.01);
        for (String counter : new String[] {"driving_minutes", "resting_minutes", "duty_minutes",
                "signal_lost_minutes"}) {
            assertEquals(outside.get(counter), inside.get(counter), counter);
        }
    }

    @Test
    void aFrameWithoutGeoHasNoGeo() {
        Map<String, Object> check = run(Map.of());

        assertFalse(check.containsKey("geo"));
        assertEquals(1.0, (Double) check.get("driving_minutes"), 0.01);
    }

    @Test
    void aSharedSignalGivesOnlyTheOrganizationsGeo() {
        Map<String, Object> other = Map.of("authorized_zone", false);
        assertEquals(INSIDE, run(Map.of("geo", other, "geos", Map.of(TENANT, INSIDE, "tenant-b", other)))
                .get("geo"));
        assertFalse(run(Map.of("geo", INSIDE, "geos", Map.of("tenant-b", INSIDE))).containsKey("geo"),
                "another organization's zones are never this one's");
        assertNull(DutyChecks.geo(null, Map.of("geos", Map.of(TENANT, INSIDE))));
    }

    @Test
    void theCaseContextKeepsTheGeoWithoutTheTrip() {
        DutyChecks.Check c = new DutyChecks.Check(run(Map.of("geo", INSIDE)), null);
        @SuppressWarnings("unchecked")
        Map<String, Object> kept = (Map<String, Object>) c.context().get("check");

        assertEquals(INSIDE, kept.get("geo"));
        assertFalse(kept.containsKey("trip"));
    }
}
