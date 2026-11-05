package com.microboxlabs.miot.core.gps;

import io.vertx.mutiny.sqlclient.Pool;
import jakarta.enterprise.inject.Vetoed;
import java.util.Optional;

/** Test facade for private scratch-schema pools, with no production configuration lookup. */
@Vetoed
public class TestGpsDatabase extends GpsDatabase {
    private final Pool reads;
    private final Pool writes;
    public TestGpsDatabase(Pool reads, Pool writes) {
        super(null, null, Optional.of("synthetic"));
        this.reads = reads;
        this.writes = writes;
    }
    @Override
    public boolean configured() { return true; }
    @Override
    public Pool pool() { return writes; }
    @Override
    public Pool readPool() { return reads; }
}
