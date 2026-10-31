package com.microboxlabs.miot.trips.store;

import static com.microboxlabs.miot.trips.store.Pg.query;

import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Tuple;
import java.util.Map;

/**
 * The Postgres channel that tells every modulith pod a trip changed. The notice is sent in the transaction of the
 * change, so Postgres delivers it only when the change commits. Payload: {@code {"tenant": …, "tripId": …}}.
 */
public final class BoardChannel {

    public static final String CHANNEL = "miot_trips_board";

    private BoardChannel() {
    }

    public static void touched(Pool pool, String tenantCode, String tripId) {
        if (tripId == null) {
            return;
        }
        query(pool, "SELECT pg_notify('" + CHANNEL + "', $1)",
                Tuple.of(Pg.json(Map.of("tenant", tenantCode, "tripId", tripId))));
    }
}
