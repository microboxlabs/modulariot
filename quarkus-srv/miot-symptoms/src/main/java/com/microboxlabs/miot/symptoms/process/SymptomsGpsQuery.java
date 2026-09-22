package com.microboxlabs.miot.symptoms.process;

import io.smallrye.mutiny.Uni;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;

/**
 * Parameterised read/write access to the StreamHub GPS database. Kept as an
 * interface so the Control Tower services can be unit-tested with an in-memory
 * fake instead of a Postgres pool.
 */
public interface SymptomsGpsQuery {

    Uni<RowSet<Row>> query(String sql, Tuple params);
}
