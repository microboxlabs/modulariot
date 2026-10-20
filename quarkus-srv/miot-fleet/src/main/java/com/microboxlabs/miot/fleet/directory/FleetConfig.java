package com.microboxlabs.miot.fleet.directory;

import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithDefault;
import java.time.Duration;

/** {@code miot.fleet.*}. The GPS database is {@code miot.gps.*}, shared with the other components. */
@ConfigMapping(prefix = "miot.fleet")
public interface FleetConfig {

    @WithDefault("none")
    String source();

    @WithDefault("America/Santiago")
    String zone();

    @WithDefault("PT1M")
    Duration cacheTtl();

    Activity activity();

    interface Activity {

        @WithDefault("P30D")
        Duration history();

        @WithDefault("8")
        int backfillPerRun();
    }
}
