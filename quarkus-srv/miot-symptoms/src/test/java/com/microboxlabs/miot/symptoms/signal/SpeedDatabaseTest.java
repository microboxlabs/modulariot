package com.microboxlabs.miot.symptoms.signal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.vertx.pgclient.PgConnectOptions;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class SpeedDatabaseTest {

    private record Settings(Optional<String> host, int port, Optional<String> name, Optional<String> username,
            Optional<String> password, int maxSize) implements SpeedDatabase.Settings {
    }

    private static Settings settings(String host, String name, String username) {
        return new Settings(Optional.ofNullable(host), 5433, Optional.ofNullable(name), Optional.ofNullable(username),
                Optional.of("secret"), 2);
    }

    @Test
    void configuredOnlyWithAHostADatabaseAndAUser() {
        assertTrue(new SpeedDatabase(settings("db", "speed", "reader"), null).configured());
        assertFalse(new SpeedDatabase(settings(null, "speed", "reader"), null).configured());
        assertFalse(new SpeedDatabase(settings("db", " ", "reader"), null).configured());
        assertFalse(new SpeedDatabase(settings("db", "speed", null), null).configured());
        SpeedDatabase unconfigured = new SpeedDatabase(settings(null, null, null), null);
        assertThrows(IllegalStateException.class, unconfigured::pool);
    }

    @Test
    void theSecretsKeysMapStraightToTheSettings() {
        SpeedDatabase.Settings s = new io.smallrye.config.SmallRyeConfigBuilder()
                .withMapping(SpeedDatabase.Settings.class)
                .withSources(new io.smallrye.config.EnvConfigSource(java.util.Map.of("MIOT_SPEED_DB_HOST", "db",
                        "MIOT_SPEED_DB_PORT", "5433", "MIOT_SPEED_DB_NAME", "speed", "MIOT_SPEED_DB_USERNAME", "reader",
                        "MIOT_SPEED_DB_PASSWORD", "secret"), 300))
                .build().getConfigMapping(SpeedDatabase.Settings.class);
        assertTrue(new SpeedDatabase(s, null).configured());
        assertEquals(5433, s.port());
        assertEquals("secret", s.password().orElseThrow());
        assertFalse(new SpeedDatabase(new io.smallrye.config.SmallRyeConfigBuilder()
                .withMapping(SpeedDatabase.Settings.class).build().getConfigMapping(SpeedDatabase.Settings.class), null)
                .configured(), "inactive when unset");
    }

    @Test
    void sessionsAreReadOnly() {
        PgConnectOptions o = SpeedDatabase.options(settings("db", "speed", "reader"));
        assertEquals("db", o.getHost());
        assertEquals(5433, o.getPort());
        assertEquals("speed", o.getDatabase());
        assertEquals("reader", o.getUser());
        assertEquals("on", o.getProperties().get("default_transaction_read_only"));
    }
}
