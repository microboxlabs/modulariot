package com.microboxlabs.miot.symptoms.store;

import static com.microboxlabs.miot.symptoms.catalog.store.PgJson.QUERY_TIMEOUT;

import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.SqlClient;
import io.vertx.mutiny.sqlclient.Tuple;
import java.util.UUID;

/** Id and query helpers shared by the Control Tower Postgres stores. */
final class PgIds {

    private PgIds() {
    }

    /** The UUID an API id stands for, or null when it is not one (such an id matches no row). */
    static UUID parse(String id) {
        if (id == null) {
            return null;
        }
        try {
            return UUID.fromString(id);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    static String text(UUID id) {
        return id == null ? null : id.toString();
    }

    static RowSet<Row> query(SqlClient client, String sql, Tuple params) {
        return client.preparedQuery(sql).execute(params).await().atMost(QUERY_TIMEOUT);
    }
}
