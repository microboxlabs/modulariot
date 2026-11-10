package com.microboxlabs.miot.cli;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

import java.util.List;
import org.junit.jupiter.api.Test;

class PlacesMigrationTest {

    @Test
    void disabledPlacesAddsNoMigrationLocationToExistingComponents() {
        FlywayMigrator migrator = new FlywayMigrator();
        migrator.baseLocations = List.of("db/migration/core");
        migrator.fleetEnabled = true;
        migrator.trackingEnabled = true;
        migrator.integrationsEnabled = true;
        migrator.conversationalEnabled = true;
        migrator.symptomsEnabled = true;
        migrator.tripsEnabled = true;
        List<String> existing = List.of("db/migration/core", "db/migration/fleet", "db/migration/tracking",
                "db/migration/integrations", "db/migration/conversational", "db/migration/symptoms",
                "db/migration/trips");
        assertEquals(existing, migrator.migrationLocations());

        migrator.placesEnabled = true;
        assertEquals("db/migration/places", migrator.migrationLocations().getLast());
        assertEquals(existing, migrator.migrationLocations().subList(0, existing.size()));
        assertEquals(List.of("db/migration/core"), migrator.baseLocations);
    }

    @Test
    void noComponentsMeansNoDatasourceAccess() {
        FlywayMigrator migrator = new FlywayMigrator();
        migrator.enabled = true;
        migrator.dataSourceActive = true;
        // No datasource injected: an attempt to resolve it would fail.
        assertDoesNotThrow(() -> migrator.onStart(null));
    }
}
