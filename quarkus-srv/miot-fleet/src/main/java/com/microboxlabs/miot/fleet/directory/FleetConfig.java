package com.microboxlabs.miot.fleet.directory;

import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithDefault;
import java.time.Duration;
import java.util.Optional;

/** {@code miot.fleet.*}; the GPS connection falls back to {@code miot.symptoms.gps.*} in application.properties. */
@ConfigMapping(prefix = "miot.fleet")
public interface FleetConfig {

    @WithDefault("none")
    String source();

    Gps gps();

    @WithDefault("America/Santiago")
    String zone();

    @WithDefault("PT1M")
    Duration cacheTtl();

    Activity activity();

    interface Gps {

        Optional<String> reactiveUrl();

        Optional<String> username();

        Optional<String> password();
    }

    interface Activity {

        @WithDefault("P30D")
        Duration history();

        @WithDefault("8")
        int backfillPerRun();
    }
}
