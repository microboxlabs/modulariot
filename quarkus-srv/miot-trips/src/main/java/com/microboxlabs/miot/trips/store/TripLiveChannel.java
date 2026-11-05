package com.microboxlabs.miot.trips.store;

import static com.microboxlabs.miot.trips.store.Pg.query;

import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Tuple;
import java.util.Map;

/**
 * The Postgres channel that tells every modulith pod a {@code trip_live} row changed, so the symptom engine reads
 * it again. Sent in the transaction of the change: Postgres delivers it only when the change commits. Payload:
 * {@code {"tenant": …, "tripId": …}}.
 */
public final class TripLiveChannel {

    public static final String CHANNEL = "miot_trips_live";

    private TripLiveChannel() {
    }

    public static void changed(Pool pool, String tenantCode, String tripId) {
        query(pool, "SELECT pg_notify('" + CHANNEL + "', $1)",
                Tuple.of(Pg.json(Map.of("tenant", tenantCode, "tripId", tripId))));
    }
}
