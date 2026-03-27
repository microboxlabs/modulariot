package com.microboxlabs.miot.assignment.config;

import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithDefault;

@ConfigMapping(prefix = "miot.assignment")
public interface AssignmentConfig {

    Resource resource();

    Coordinator coordinator();

    StreamHub streamhub();

    interface Resource {
        @WithDefault("miot_fleet")
        String fleetSchema();

        @WithDefault("miot_driver")
        String driverSchema();
    }

    interface Coordinator {
        @WithDefault("false")
        boolean enabled();

        @WithDefault("alerce")
        String schema();
    }

    interface StreamHub {
        @WithDefault("false")
        boolean enabled();

        @WithDefault("public")
        String schema();
    }
}
