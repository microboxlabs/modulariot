package com.microboxlabs.miot.symptoms.lostsignal;

import com.microboxlabs.miot.symptoms.cases.EngineCaseStore;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.cases.EngineCaseStore.StaleCase;
import com.microboxlabs.miot.symptoms.store.PgEngineCases;
import com.microboxlabs.miot.symptoms.evaluator.AssetEpisodes;
import com.microboxlabs.miot.symptoms.evaluator.Episode;
import com.microboxlabs.miot.symptoms.evaluator.EpisodeRepository;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgException;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
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
                              AND m.milestone = 'arrival' AND m.status = 'confirmed') AS arrived,
                   l.asset_id
              FROM unnest($1::text[], $2::uuid[]) AS r(tenant, trip_id)
              LEFT JOIN miot_trips.trip t ON t.tenant_code = r.tenant AND t.id = r.trip_id
              LEFT JOIN miot_trips.trip_live l ON l.tenant_code = t.tenant_code AND l.trip_id = t.id
            """;

    private final Supplier<Pool> pool;
    private final EngineCaseStore cases;
    private final EpisodeRepository episodes;

    public PgTripEnds(Supplier<Pool> pool, EngineCaseStore cases) {
        this(pool, cases, null);
    }

    private PgTripEnds(Supplier<Pool> pool, EngineCaseStore cases, EpisodeRepository episodes) {
        this.episodes = episodes;
        this.pool = pool;
        this.cases = cases;
    }

    @Override
    public TripEnds withEpisodes(EpisodeRepository episodes) {
        return new PgTripEnds(pool, cases, episodes);
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
                        Boolean.TRUE.equals(r.getBoolean("arrived")), r.getString("asset_id")));
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
        return cases.closeTrip(tenant, tripId, definitionIds, at, REASON, null, frames(tenant));
    }

    @Override
    public List<StaleCase> closeOthers(String tenant, String tripId, List<UUID> definitionIds, String keepAsset,
            Instant at) {
        return cases.closeTrip(tenant, tripId, definitionIds, at, ASSET_CHANGED, keepAsset, frames(tenant));
    }

    private Function<StaleCase, EngineCaseStore.ClosingFrame> frames(String tenant) {
        Map<String, AssetEpisodes> loaded = new HashMap<>();
        return c -> {
            if (episodes == null) {
                return null;
            }
            Episode e = loaded.computeIfAbsent(c.assetId(), asset -> episodes.load(tenant, asset))
                    .find(tenant, c.assetId(), c.definitionId()).orElse(null);
            if (e == null || e.openedAt() == null
                    || !c.openedAt().equals(e.openedAt().truncatedTo(ChronoUnit.MICROS))
                    || (e.state() != null && (e.state() == SymptomState.TEST)
                            != c.test())) {
                return null;
            }
            Map<String, Object> context = e.lastContext();
            return new EngineCaseStore.ClosingFrame(e.maxMeasure(),
                    context == null || context.isEmpty() ? null : context);
        };
    }

    @Override
    public int end(String tenant, String tripId, List<UUID> definitions, Instant at, Consumer<Closure> effect) {
        List<StaleCase> closed = close(tenant, tripId, definitions, at);
        retry(effect);
        return closed.size();
    }

    @Override
    public int leave(String tenant, String tripId, List<UUID> definitions, String keepAsset, Instant at,
            Consumer<Closure> effect) {
        List<StaleCase> closed = closeOthers(tenant, tripId, definitions, keepAsset, at);
        retry(effect);
        return closed.size();
    }

    private static String reason(Row r) {
        String closedBy = r.getString("closed_by");
        return closedBy == null ? REASON : closedBy;
    }

    /** Queue rows remain durable until cleanup and asynchronous observers both complete successfully. */
    @Override
    public int retry(Consumer<Closure> effect) {
        return pool.get().withTransaction(conn -> conn.query(PENDING).execute()
                .emitOn(Infrastructure.getDefaultWorkerPool())
                .invoke(rows -> rows.forEach(r -> effect.accept(new Closure(PgEngineCases.staleCase(r),
                        r.getOffsetDateTime("at").toInstant(), reason(r)))))
                .flatMap(rows -> {
                    Long[] ids = java.util.stream.StreamSupport.stream(rows.spliterator(), false)
                            .map(r -> r.getLong("case_id")).toArray(Long[]::new);
                    return conn.preparedQuery("DELETE FROM miot_symptoms.trip_end_effects WHERE opened_id = ANY($1::bigint[])")
                            .execute(Tuple.of(ids)).replaceWith(ids.length);
                })).await().atMost(Duration.ofMinutes(2));
    }
}
