package com.microboxlabs.miot.cli;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.util.List;
import org.junit.jupiter.api.Test;

/** The Teltonika schema migrates only when the component is on, after the other locations. */
class TeltonikaMigrationTest {

    @Test
    void teltonikaLocationFollowsTheComponent() {
        FlywayMigrator migrator = new FlywayMigrator();
        migrator.baseLocations = List.of("db/migration/core");

        assertFalse(migrator.migrationLocations().contains("db/migration/teltonika"));
        migrator.teltonikaEnabled = true;
        assertEquals("db/migration/teltonika", migrator.migrationLocations().getLast());
    }
}
