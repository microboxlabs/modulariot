package com.microboxlabs.miot.fleet.sharing;

import io.smallrye.mutiny.Uni;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.SqlConnection;
import io.vertx.mutiny.sqlclient.Tuple;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;
import java.util.function.Supplier;

/**
 * {@link ClientMapStore} on the GPS database. Touches only rows whose {@code managed_by} is
 * {@value ClientMapStore#MANAGED_BY}; a row already there for the same asset and client stays as it is.
 */
public class PgClientMapStore implements ClientMapStore {

    private static final Duration TIMEOUT = Duration.ofMinutes(2);
    private static final int BATCH = 500;

    private static final String MANAGED = """
            SELECT asset_id, shared_client_id, valid_from, valid_to FROM public.asset_client_map
            WHERE managed_by = $1""";

    private static final String INSERT = """
            INSERT INTO public.asset_client_map (asset_id, shared_client_id, active, valid_from, valid_to, managed_by)
            VALUES ($1, $2, true, $3, $4, $5)
            ON CONFLICT (asset_id, shared_client_id) DO NOTHING""";

    private static final String UPDATE = """
            UPDATE public.asset_client_map SET active = true, valid_from = $3, valid_to = $4
            WHERE asset_id = $1 AND shared_client_id = $2 AND managed_by = $5""";

    private static final String DELETE = """
            DELETE FROM public.asset_client_map
            WHERE asset_id = $1 AND shared_client_id = $2 AND managed_by = $3""";

    private final Supplier<Pool> pool;

    public PgClientMapStore(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public List<ClientMap.Row> managed() {
        List<ClientMap.Row> rows = new ArrayList<>();
        for (Row r : pool.get().preparedQuery(MANAGED).execute(Tuple.of(MANAGED_BY)).await().atMost(TIMEOUT)) {
            rows.add(new ClientMap.Row(r.getString("asset_id"), r.getString("shared_client_id"),
                    instant(r.getOffsetDateTime("valid_from")), instant(r.getOffsetDateTime("valid_to"))));
        }
        return rows;
    }

    @Override
    public void apply(ClientMap.Plan plan) {
        if (plan.isEmpty()) {
            return;
        }
        List<Tuple> inserts = plan.insert().stream().map(r -> window(r).addValue(MANAGED_BY)).toList();
        List<Tuple> updates = plan.update().stream().map(r -> window(r).addValue(MANAGED_BY)).toList();
        List<Tuple> deletes = plan.delete().stream().map(r -> Tuple.of(r.assetId(), r.clientId(), MANAGED_BY))
                .toList();
        pool.get().withTransaction(tx -> batches(tx, INSERT, inserts)
                .chain(() -> batches(tx, UPDATE, updates))
                .chain(() -> batches(tx, DELETE, deletes)))
                .await().atMost(TIMEOUT);
    }

    private static Uni<Void> batches(SqlConnection tx, String sql, List<Tuple> rows) {
        Uni<Void> chain = Uni.createFrom().voidItem();
        for (int from = 0; from < rows.size(); from += BATCH) {
            List<Tuple> batch = rows.subList(from, Math.min(from + BATCH, rows.size()));
            Function<Void, Uni<? extends Void>> next = ignored -> tx.preparedQuery(sql).executeBatch(batch)
                    .replaceWithVoid();
            chain = chain.chain(next);
        }
        return chain;
    }

    private static Tuple window(ClientMap.Row r) {
        return Tuple.tuple().addValue(r.assetId()).addValue(r.clientId())
                .addValue(r.validFrom().atOffset(ZoneOffset.UTC)).addValue(r.storedTo().atOffset(ZoneOffset.UTC));
    }

    private static Instant instant(OffsetDateTime at) {
        return at == null ? null : at.toInstant();
    }
}
