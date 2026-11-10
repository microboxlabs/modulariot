package com.microboxlabs.miot.cli;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.places.service.PlaceSync;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import jakarta.inject.Inject;
import java.util.HashMap;
import java.util.Map;
import org.eclipse.microprofile.config.Config;
import org.junit.jupiter.api.Test;

/** A places owner without GPS must boot and leave its writes pending, without Docker or a database. */
@QuarkusTest
@TestProfile(PlacesWithoutGpsTest.Profile.class)
class PlacesWithoutGpsTest {
    @Inject
    PlaceSync sync;

    @Inject
    Config config;

    @Test
    void thePlacesOwnerStartsWithoutAGpsDatasource() {
        assertTrue(config.getValue("miot.component.places.enabled", Boolean.class));
        assertTrue(config.getValue("miot.places.sync.enabled", Boolean.class));
        assertFalse(sync.copies());
    }

    public static class Profile implements QuarkusTestProfile {
        @Override
        public Map<String, String> getConfigOverrides() {
            Map<String, String> overrides = new HashMap<>(new EngineOnlyPodTest.Profile().getConfigOverrides());
            overrides.put("miot.component.places.enabled", "true");
            overrides.put("miot.component.symptoms.enabled", "false");
            overrides.remove("quarkus.datasource.gps.active");
            overrides.remove("quarkus.datasource.\"gps-read\".active");
            for (String name : new String[] {"gps", "\"gps-read\""}) {
                overrides.put("quarkus.datasource." + name + ".username", "");
                overrides.put("quarkus.datasource." + name + ".password", "");
                overrides.put("quarkus.datasource." + name + ".reactive.url", "");
            }
            return overrides;
        }
    }
}
