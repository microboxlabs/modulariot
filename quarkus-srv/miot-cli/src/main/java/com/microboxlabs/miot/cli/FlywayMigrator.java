package com.microboxlabs.miot.cli;

import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.enterprise.inject.Instance;
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
    Instance<DataSource> dataSourceInstance;

    @ConfigProperty(name = "miot.flyway.base-locations")
    List<String> baseLocations;

    @ConfigProperty(name = "miot.component.fleet.enabled", defaultValue = "false")
    boolean fleetEnabled;

    @ConfigProperty(name = "miot.component.driver.enabled", defaultValue = "false")
    boolean driverEnabled;

    @ConfigProperty(name = "miot.component.tracking.enabled", defaultValue = "false")
    boolean trackingEnabled;

    void onStart(@Observes StartupEvent ev) {
        // Gateway and other stateless components have no DB schema.
        // Skip migration entirely when no DB-dependent component is active
        // to avoid connecting to (or validating against) a database that isn't needed.
        if (!fleetEnabled && !driverEnabled && !trackingEnabled) {
            LOG.debug("No DB-dependent components enabled — skipping Flyway");
            return;
        }

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
                .dataSource(dataSourceInstance.get())
                .locations(locations.toArray(String[]::new))
                .outOfOrder(true)
                .ignoreMigrationPatterns("*:missing")
                .load();

        flyway.migrate();
    }
}
