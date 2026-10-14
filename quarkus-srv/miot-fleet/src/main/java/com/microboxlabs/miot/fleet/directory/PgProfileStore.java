package com.microboxlabs.miot.fleet.directory;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.smallrye.mutiny.Uni;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.SqlClient;
import io.vertx.mutiny.sqlclient.Tuple;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Supplier;

/** {@link ProfileStore} on the modulith database, schema {@code miot_fleet}. */
public class PgProfileStore implements ProfileStore {

    private static final Duration QUERY_TIMEOUT = Duration.ofSeconds(15);
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final TypeReference<Map<String, String>> MAP = new TypeReference<>() {
    };

    private static final String COLUMNS = "organization_id, asset_id, fields::text AS fields, "
            + "documents::text AS documents, updated_by, updated_at";

    private static final String ALL = "SELECT " + COLUMNS + " FROM miot_fleet.asset_profile WHERE organization_id = $1";

    private static final String FIND = ALL + " AND asset_id = $2";

    private static final String UPSERT = """
            INSERT INTO miot_fleet.asset_profile (organization_id, asset_id, fields, documents, updated_by, updated_at)
            VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6)
            ON CONFLICT (organization_id, asset_id) DO UPDATE SET fields = EXCLUDED.fields,
                documents = EXCLUDED.documents, updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at""";

    private static final String INSERT_CHANGE = """
            INSERT INTO miot_fleet.asset_change (organization_id, asset_id, field, old_value, new_value, origin,
                changed_by, changed_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)""";

    private static final String CHANGES = """
            SELECT field, old_value, new_value, origin, changed_by, changed_at FROM miot_fleet.asset_change
            WHERE organization_id = $1 AND asset_id = $2
            ORDER BY changed_at DESC, id DESC
            LIMIT $3""";

    private static final String DISMISSED = """
            SELECT asset_id, suggestion FROM miot_fleet.asset_suggestion_dismissal WHERE organization_id = $1""";

    private static final String DISMISS = """
            INSERT INTO miot_fleet.asset_suggestion_dismissal (organization_id, asset_id, suggestion, dismissed_by)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT DO NOTHING""";

    private final Supplier<Pool> pool;

    public PgProfileStore(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public Map<String, Profile> all(String organizationId) {
        Map<String, Profile> found = new HashMap<>();
        for (Row r : query(pool.get(), ALL, Tuple.of(organizationId))) {
            Profile p = profile(r);
            found.put(p.assetId(), p);
        }
        return found;
    }

    @Override
    public Optional<Profile> find(String organizationId, String assetId) {
        var rows = query(pool.get(), FIND, Tuple.of(organizationId, assetId)).iterator();
        return rows.hasNext() ? Optional.of(profile(rows.next())) : Optional.empty();
    }

    @Override
    public Profile save(Profile p, List<Change> changes) {
        Map<String, String> documents = new LinkedHashMap<>();
        p.documents().forEach((k, v) -> documents.put(k, v.toString()));
        Tuple upsert = Tuple.tuple().addValue(p.organizationId()).addValue(p.assetId()).addValue(json(p.fields()))
                .addValue(json(documents)).addValue(p.updatedBy()).addValue(time(p.updatedAt()));
        pool.get().withTransaction(tx -> {
            Uni<?> chain = tx.preparedQuery(UPSERT).execute(upsert);
            for (Change c : changes) {
                Tuple change = Tuple.tuple().addValue(p.organizationId()).addValue(p.assetId()).addValue(c.field())
                        .addValue(c.oldValue()).addValue(c.newValue()).addValue(c.origin()).addValue(c.changedBy())
                        .addValue(time(c.changedAt()));
                chain = chain.chain(() -> tx.preparedQuery(INSERT_CHANGE).execute(change));
            }
            return chain.replaceWithVoid();
        }).await().atMost(QUERY_TIMEOUT);
        return p;
    }

    @Override
    public List<Change> changes(String organizationId, String assetId, int limit) {
        List<Change> found = new ArrayList<>();
        for (Row r : query(pool.get(), CHANGES, Tuple.of(organizationId, assetId, limit))) {
            found.add(new Change(r.getString("field"), r.getString("old_value"), r.getString("new_value"),
                    r.getString("origin"), r.getString("changed_by"), r.getOffsetDateTime("changed_at").toInstant()));
        }
        return found;
    }

    @Override
    public Map<String, Set<String>> dismissed(String organizationId) {
        Map<String, Set<String>> found = new HashMap<>();
        for (Row r : query(pool.get(), DISMISSED, Tuple.of(organizationId))) {
            found.computeIfAbsent(r.getString("asset_id"), k -> new HashSet<>()).add(r.getString("suggestion"));
        }
        return found;
    }

    @Override
    public void dismiss(String organizationId, String assetId, String key, String by) {
        query(pool.get(), DISMISS, Tuple.of(organizationId, assetId, key, by));
    }

    private static RowSet<Row> query(SqlClient client, String sql, Tuple params) {
        return client.preparedQuery(sql).execute(params).await().atMost(QUERY_TIMEOUT);
    }

    private static Profile profile(Row r) {
        Map<String, LocalDate> documents = new LinkedHashMap<>();
        map(r.getString("documents")).forEach((k, v) -> documents.put(k, LocalDate.parse(v)));
        OffsetDateTime at = r.getOffsetDateTime("updated_at");
        return new Profile(r.getString("organization_id"), r.getString("asset_id"), map(r.getString("fields")),
                documents, r.getString("updated_by"), at == null ? null : at.toInstant());
    }

    private static Map<String, String> map(String json) {
        if (json == null) {
            return Map.of();
        }
        try {
            return JSON.readValue(json, MAP);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Unreadable fleet profile", e);
        }
    }

    private static String json(Map<String, String> values) {
        try {
            return JSON.writeValueAsString(values);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private static OffsetDateTime time(Instant at) {
        return at == null ? null : OffsetDateTime.ofInstant(at, ZoneOffset.UTC);
    }
}
