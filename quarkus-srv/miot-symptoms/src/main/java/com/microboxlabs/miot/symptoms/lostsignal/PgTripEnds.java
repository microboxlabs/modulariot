package com.microboxlabs.miot.symptoms.lostsignal;

import com.microboxlabs.miot.symptoms.cases.EngineCaseStore;
import com.microboxlabs.miot.symptoms.cases.EngineCaseStore.StaleCase;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgException;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * {@link TripEnds} on the modulith database: a trip ended when {@code miot_trips.trip} has it {@code completed} or
 * {@code cancelled}, or has no such trip; it arrived when its {@code arrival} milestone is confirmed. Without the
 * trips module no trip ends (the signals carry none).
 */
public class PgTripEnds implements TripEnds {

    private static final Duration QUERY_TIMEOUT = Duration.ofSeconds(10);
    private static final String UNDEFINED_TABLE = "42P01";

    static final String STATES = """
            SELECT r.tenant, t.id IS NULL OR t.status IN ('completed', 'cancelled') AS ended,
                   EXISTS (SELECT 1 FROM miot_trips.trip_milestone m
                            WHERE m.tenant_code = t.tenant_code AND m.trip_id = t.id
                              AND m.milestone = 'arrival' AND m.status = 'confirmed') AS arrived
              FROM unnest($1::text[], $2::text[]) AS r(tenant, trip_id)
              LEFT JOIN miot_trips.trip t ON t.tenant_code = r.tenant AND t.id::text = r.trip_id
            """;

    private final Supplier<Pool> pool;
    private final EngineCaseStore cases;

    public PgTripEnds(Supplier<Pool> pool, EngineCaseStore cases) {
        this.pool = pool;
        this.cases = cases;
    }

    @Override
    public Map<String, State> states(Map<String, String> tripByTenant) {
        if (tripByTenant.isEmpty()) {
            return Map.of();
        }
        String[] tenants = tripByTenant.keySet().toArray(String[]::new);
        String[] trips = new String[tenants.length];
        for (int i = 0; i < tenants.length; i++) {
            trips[i] = tripByTenant.get(tenants[i]);
        }
        try {
            Map<String, State> out = new HashMap<>();
            for (Row r : pool.get().preparedQuery(STATES).execute(Tuple.of(tenants, trips)).await()
                    .atMost(QUERY_TIMEOUT)) {
                out.put(r.getString("tenant"), new State(Boolean.TRUE.equals(r.getBoolean("ended")),
                        Boolean.TRUE.equals(r.getBoolean("arrived"))));
            }
            return out;
        } catch (PgException e) {
            if (UNDEFINED_TABLE.equals(e.getSqlState())) {
                return Map.of();
            }
            throw e;
        }
    }

    @Override
    public List<StaleCase> close(String tenant, String tripId, List<UUID> definitionIds, Instant at) {
        return cases.closeTrip(tenant, tripId, definitionIds, at, REASON);
    }
}
