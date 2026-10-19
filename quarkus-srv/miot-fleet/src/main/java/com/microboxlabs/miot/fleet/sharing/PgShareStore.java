package com.microboxlabs.miot.fleet.sharing;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.smallrye.mutiny.Uni;
import io.vertx.core.json.JsonArray;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

/** {@link ShareStore} on the modulith database, schema {@code miot_fleet}. */
public class PgShareStore implements ShareStore {

    private static final Duration QUERY_TIMEOUT = Duration.ofSeconds(15);
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final TypeReference<List<String>> LIST = new TypeReference<>() {
    };

    private static final String ALL = """
            SELECT id, source_org, target_org, scope, owners::text AS owners, kinds::text AS kinds, origin,
                   valid_from, valid_to, note, created_by, created_at, revoked_at, revoked_by
            FROM miot_fleet.data_share
            ORDER BY created_at DESC""";

    private static final String ASSETS = "SELECT share_id, asset_id FROM miot_fleet.data_share_asset";

    private static final String INSERT = """
            INSERT INTO miot_fleet.data_share (id, source_org, target_org, scope, owners, kinds, origin, valid_from,
                valid_to, note, created_by, created_at)
            VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11, $12)""";

    // Serializes creates for one organization pair, across modulith instances, until the transaction ends.
    private static final String LOCK_PAIR = "SELECT pg_advisory_xact_lock(hashtextextended($1 || '>' || $2, 0))";

    // DataShare.alreadyCovers, in SQL: an ALL share in force for the pair whose window overlaps [$3, $4).
    private static final String COVERED = """
            SELECT 1 FROM miot_fleet.data_share
            WHERE source_org = $1 AND target_org = $2 AND scope = 'ALL' AND revoked_at IS NULL
              AND (valid_to IS NULL OR valid_to > now())
              AND (valid_to IS NULL OR $3 < valid_to)
              AND ($4::timestamptz IS NULL OR $4 > valid_from)
            LIMIT 1""";

    private static final String INSERT_ASSET =
            "INSERT INTO miot_fleet.data_share_asset (share_id, asset_id) VALUES ($1, $2)";

    private static final String REVOKE = """
            UPDATE miot_fleet.data_share SET revoked_at = $2, revoked_by = $3
            WHERE id = $1 AND revoked_at IS NULL""";

    private final Supplier<Pool> pool;

    public PgShareStore(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public List<DataShare> all() {
        Map<UUID, List<String>> assets = new HashMap<>();
        for (Row r : query(ASSETS, Tuple.tuple())) {
            assets.computeIfAbsent(r.getUUID("share_id"), k -> new ArrayList<>()).add(r.getString("asset_id"));
        }
        List<DataShare> shares = new ArrayList<>();
        for (Row r : query(ALL, Tuple.tuple())) {
            UUID id = r.getUUID("id");
            shares.add(new DataShare(id, r.getString("source_org"), r.getString("target_org"),
                    DataShare.Scope.valueOf(r.getString("scope")),
                    new ShareFilter(list(r.getString("owners")), list(r.getString("kinds"))),
                    assets.getOrDefault(id, List.of()), DataShare.Origin.valueOf(r.getString("origin")),
                    instant(r.getOffsetDateTime("valid_from")), instant(r.getOffsetDateTime("valid_to")),
                    r.getString("note"), r.getString("created_by"), instant(r.getOffsetDateTime("created_at")),
                    instant(r.getOffsetDateTime("revoked_at")), r.getString("revoked_by")));
        }
        return shares;
    }

    @Override
    public void create(DataShare s) {
        Tuple row = Tuple.tuple().addValue(s.id()).addValue(s.sourceOrg()).addValue(s.targetOrg())
                .addValue(s.scope().name()).addValue(json(s.filter().owners())).addValue(json(s.filter().kinds()))
                .addValue(s.origin().name()).addValue(time(s.validFrom())).addValue(time(s.validTo()))
                .addValue(s.note()).addValue(s.createdBy()).addValue(time(s.createdAt()));
        List<Tuple> assets = s.assetIds().stream().map(a -> Tuple.of(s.id(), a)).toList();
        Tuple pair = Tuple.of(s.sourceOrg(), s.targetOrg());
        Tuple window = Tuple.of(s.sourceOrg(), s.targetOrg(), time(s.validFrom()), time(s.validTo()));
        pool.get().withTransaction(tx -> tx.preparedQuery(LOCK_PAIR).execute(pair)
                .chain(() -> tx.preparedQuery(COVERED).execute(window))
                .chain(covered -> {
                    if (covered.rowCount() > 0) {
                        return Uni.createFrom().failure(new AlreadyCovered());
                    }
                    Uni<Void> insert = tx.preparedQuery(INSERT).execute(row).replaceWithVoid();
                    return assets.isEmpty() ? insert
                            : insert.chain(() -> tx.preparedQuery(INSERT_ASSET).executeBatch(assets).replaceWithVoid());
                })).await().atMost(QUERY_TIMEOUT);
    }

    @Override
    public Optional<DataShare> revoke(UUID id, String by, Instant at) {
        RowSet<Row> updated = query(REVOKE, Tuple.of(id, time(at), by));
        if (updated.rowCount() == 0) {
            return Optional.empty();
        }
        return all().stream().filter(s -> s.id().equals(id)).findFirst();
    }

    private RowSet<Row> query(String sql, Tuple params) {
        return pool.get().preparedQuery(sql).execute(params).await().atMost(QUERY_TIMEOUT);
    }

    /** A JSON array; a String bound to a jsonb parameter would be stored as a JSON string. */
    private static JsonArray json(List<String> values) {
        return new JsonArray(new ArrayList<>(values));
    }

    private static List<String> list(String json) {
        try {
            return json == null ? List.of() : JSON.readValue(json, LIST);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private static OffsetDateTime time(Instant at) {
        return at == null ? null : at.atOffset(ZoneOffset.UTC);
    }

    private static Instant instant(OffsetDateTime at) {
        return at == null ? null : at.toInstant();
    }
}
