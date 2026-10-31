package com.microboxlabs.miot.core.gps;

import io.vertx.mutiny.sqlclient.Pool;
import jakarta.enterprise.inject.Vetoed;
import java.util.Optional;

/** Test facade for a scratch-schema read pool, or for a GPS database that is not configured. */
@Vetoed
public class PlacesTestGpsDatabase extends GpsDatabase {
    private final Pool reads;

    private PlacesTestGpsDatabase(Pool reads) {
        super(null, null, Optional.of("synthetic"));
        this.reads = reads;
    }

    public static PlacesTestGpsDatabase reading(Pool reads) {
        return new PlacesTestGpsDatabase(reads);
    }

    public static PlacesTestGpsDatabase notConfigured() {
        return new PlacesTestGpsDatabase(null);
    }

    @Override
    public boolean configured() {
        return reads != null;
    }

    @Override
    public Pool pool() {
        throw new UnsupportedOperationException("places only reads");
    }

    @Override
    public Pool readPool() {
        return reads;
    }
}
