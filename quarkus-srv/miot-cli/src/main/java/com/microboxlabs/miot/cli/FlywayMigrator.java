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

    @ConfigProperty(name = "miot.component.integrations.enabled", defaultValue = "false")
    boolean integrationsEnabled;

    @ConfigProperty(name = "quarkus.datasource.active", defaultValue = "true")
    boolean dataSourceActive;

    void onStart(@Observes StartupEvent ev) {
        // Gateway and other stateless components have no DB schema.
        // Skip migration entirely when no DB-dependent component is active
        // to avoid connecting to (or validating against) a database that isn't needed.
        if (!fleetEnabled && !driverEnabled && !trackingEnabled && !integrationsEnabled) {
            LOG.debug("No DB-dependent components enabled — skipping Flyway");
            return;
        }

        if (!dataSourceActive) {
            LOG.warn("Datasource is deactivated — skipping Flyway migration");
            return;
        }

        if (dataSourceInstance.isUnsatisfied() || !dataSourceInstance.isResolvable()) {
            LOG.warn("Datasource bean is not resolvable — skipping Flyway migration");
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
        if (integrationsEnabled) {
            locations.add("db/migration/integrations");
        }

        LOG.infof("Flyway locations: %s", locations);

        // Pin Flyway's metadata table to a schema we own. Without these,
        // Flyway's default schema is the JDBC connection's default — `public`
        // on PostgreSQL — so `flyway_schema_history` ends up next to anything
        // else that stray writes drop into `public`, and a single non-Flyway
        // table there will fail startup with "Found non-empty schema(s)
        // 'public' but no schema history table".
        Flyway flyway = Flyway.configure()
                .dataSource(dataSourceInstance.get())
                .locations(locations.toArray(String[]::new))
                .schemas("miot_core")
                .defaultSchema("miot_core")
                .outOfOrder(true)
                .ignoreMigrationPatterns("*:missing")
                .load();

        flyway.migrate();
    }
}
