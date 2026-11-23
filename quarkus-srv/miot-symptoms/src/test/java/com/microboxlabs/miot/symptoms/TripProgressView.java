package com.microboxlabs.miot.symptoms;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * The {@code miot_trips.trip_progress} view as miot-trips' migration creates it, so a test reads the real contract
 * rather than a copy. Maven runs the tests from the module directory.
 */
public final class TripProgressView {

    private static final Path MIGRATION = Path.of("..", "miot-trips", "src", "main", "resources", "db", "migration",
            "trips", "V0.10.31__trip_progress.sql");

    private TripProgressView() {
    }

    /** Drops and creates the view in {@code miot_trips}. */
    public static String sql() {
        return sql("miot_trips");
    }

    /** Drops and creates the view, reading its tables from {@code schema} ({@code pg_temp} makes it temporary). */
    public static String sql(String schema) {
        try {
            String create = Files.readString(MIGRATION).replace("miot_trips.", schema + ".");
            return "DROP VIEW IF EXISTS " + schema + ".trip_progress;\n" + create;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
