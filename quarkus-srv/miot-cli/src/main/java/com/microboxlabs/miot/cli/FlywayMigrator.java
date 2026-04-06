package com.microboxlabs.miot.cli;

import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.List;
import javax.sql.DataSource;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.flywaydb.core.Flyway;
import org.jboss.logging.Logger;

@ApplicationScoped
public class FlywayMigrator {

    private static final Logger LOG = Logger.getLogger(FlywayMigrator.class);

    @Inject
    DataSource dataSource;

    @ConfigProperty(name = "miot.flyway.base-locations")
    List<String> baseLocations;

    @ConfigProperty(name = "miot.component.fleet.enabled", defaultValue = "false")
    boolean fleetEnabled;

    @ConfigProperty(name = "miot.component.driver.enabled", defaultValue = "false")
    boolean driverEnabled;

    @ConfigProperty(name = "miot.component.tracking.enabled", defaultValue = "false")
    boolean trackingEnabled;

    void onStart(@Observes StartupEvent ev) {
        List<String> locations = new ArrayList<>(baseLocations);

        if (fleetEnabled) {
            locations.add("db/migration/fleet");
        }
        if (driverEnabled) {
            locations.add("db/migration/driver");
        }
        if (trackingEnabled) {
            locations.add("db/migration/tracking");
        }

        LOG.infof("Flyway locations: %s", locations);

        Flyway flyway = Flyway.configure()
                .dataSource(dataSource)
                .locations(locations.toArray(String[]::new))
                .outOfOrder(true)
                .load();

        flyway.migrate();
    }
}
