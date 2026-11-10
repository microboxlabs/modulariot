package com.microboxlabs.miot.core.gps;

import io.vertx.mutiny.sqlclient.Pool;
import jakarta.enterprise.inject.Vetoed;
import java.util.Optional;

/** Test facade for a scratch-schema read pool (and write pool), or for a GPS database that is not configured. */
@Vetoed
public class PlacesTestGpsDatabase extends GpsDatabase {
    private final Pool reads;
    private final Pool writes;

    private PlacesTestGpsDatabase(Pool reads, Pool writes) {
        super(null, null, Optional.of("synthetic"));
        this.reads = reads;
        this.writes = writes;
    }

    public static PlacesTestGpsDatabase reading(Pool reads) {
        return new PlacesTestGpsDatabase(reads, null);
    }

    /** Reads and writes on {@code pool}, as the StreamHub sync does. */
    public static PlacesTestGpsDatabase writing(Pool pool) {
        return new PlacesTestGpsDatabase(pool, pool);
    }

    public static PlacesTestGpsDatabase notConfigured() {
        return new PlacesTestGpsDatabase(null, null);
    }

    /** Activation tests never resolve a pool. */
    public static PlacesTestGpsDatabase configuredWithoutPool() {
        return new PlacesTestGpsDatabase(null, null) {
            @Override
            public boolean configured() {
                return true;
            }
        };
    }

    @Override
    public boolean configured() {
        return reads != null;
    }

    @Override
    public Pool pool() {
        if (writes == null) {
            throw new UnsupportedOperationException("places only reads");
        }
        return writes;
    }

    @Override
    public Pool readPool() {
        return reads;
    }
}
