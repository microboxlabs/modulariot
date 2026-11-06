package com.microboxlabs.miot.symptoms.lostsignal;

import com.microboxlabs.miot.symptoms.cases.EngineCaseStore;
import com.microboxlabs.miot.symptoms.cases.EngineCaseStore.StaleCase;
import com.microboxlabs.miot.symptoms.store.PgEngineCases;
import io.smallrye.mutiny.infrastructure.Infrastructure;
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
import java.util.function.Consumer;

/**
 * {@link TripEnds} on the modulith database: a trip ended when {@code miot_trips.trip} has it {@code completed} or
 * {@code cancelled}, or has no such trip; it arrived when its {@code arrival} milestone is confirmed. Without the
 * trips module no trip ends (the signals carry none).
 */
public class PgTripEnds implements TripEnds {

    private static final Duration QUERY_TIMEOUT = Duration.ofSeconds(10);
    private static final String UNDEFINED_TABLE = "42P01";

    private static final String PENDING = """
            SELECT c.*, o.id AS case_id, o.at AS opened_at
              FROM miot_symptoms.trip_end_effects e
              JOIN miot_symptoms.signal_transitions c ON c.id = e.closed_id
              JOIN miot_symptoms.signal_transitions o ON o.id = e.opened_id
             ORDER BY e.opened_id LIMIT 20 FOR UPDATE OF e SKIP LOCKED
            """;

    static final String STATES = """
            SELECT r.tenant, t.id IS NULL OR t.status IN ('completed', 'cancelled') AS ended,
                   EXISTS (SELECT 1 FROM miot_trips.trip_milestone m
                            WHERE m.tenant_code = t.tenant_code AND m.trip_id = t.id
                              AND m.milestone = 'arrival' AND m.status = 'confirmed') AS arrived
              FROM unnest($1::text[], $2::uuid[]) AS r(tenant, trip_id)
              LEFT JOIN miot_trips.trip t ON t.tenant_code = r.tenant AND t.id = r.trip_id
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
        UUID[] trips = new UUID[tenants.length];
        for (int i = 0; i < tenants.length; i++) {
            trips[i] = TripEnds.uuid(tripByTenant.get(tenants[i]));
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

    @Override
    public int end(String tenant, String tripId, List<UUID> definitions, Instant at, Consumer<Closure> effect) {
        List<StaleCase> closed = close(tenant, tripId, definitions, at);
        retry(effect);
        return closed.size();
    }

    /** Queue rows remain durable until cleanup and asynchronous observers both complete successfully. */
    @Override
    public int retry(Consumer<Closure> effect) {
        return pool.get().withTransaction(conn -> conn.query(PENDING).execute()
                .emitOn(Infrastructure.getDefaultWorkerPool())
                .invoke(rows -> rows.forEach(r -> effect.accept(new Closure(PgEngineCases.staleCase(r),
                        r.getOffsetDateTime("at").toInstant()))))
                .flatMap(rows -> {
                    Long[] ids = java.util.stream.StreamSupport.stream(rows.spliterator(), false)
                            .map(r -> r.getLong("case_id")).toArray(Long[]::new);
                    return conn.preparedQuery("DELETE FROM miot_symptoms.trip_end_effects WHERE opened_id = ANY($1::bigint[])")
                            .execute(Tuple.of((Object) ids)).replaceWith(ids.length);
                })).await().atMost(Duration.ofMinutes(2));
    }
}
