package com.microboxlabs.miot.integrations.persistence;

import com.microboxlabs.miot.integrations.domain.InteractionEpisode;
import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Append-only writer for {@code miot_integrations.interaction_episodes}. Mirrors
 * {@code AsyncJobRepository} (Vert.x reactive PG, blocking via
 * {@code await().indefinitely()}, JSONB via {@code JsonObject}) but carries no
 * claim/lease/retry surface — an episode is inserted once and read by the
 * distiller. The {@code protected} constructor lets unit tests subclass with a
 * null pool.
 */
@ApplicationScoped
public class InteractionEpisodeRepository {

    private static final String COLUMNS = """
            id, tenant_code, user_id, surface, run_id, signal, payload, created_at""";

    private static final String INSERT = """
            INSERT INTO miot_integrations.interaction_episodes (
                tenant_code, user_id, surface, run_id, signal, payload
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING %s""".formatted(COLUMNS);

    private final Instance<Pool> clientInstance;

    protected InteractionEpisodeRepository(Instance<Pool> clientInstance) {
        this.clientInstance = clientInstance;
    }

    /** Appends one episode; returns the persisted row (id + created_at assigned). */
    public InteractionEpisode insert(InteractionEpisode episode) {
        Tuple params = Tuple.tuple()
                .addString(episode.tenantCode())
                .addString(episode.userId())
                .addString(episode.surface())
                .addString(episode.runId())
                .addString(episode.signal())
                .addJsonObject(toJson(episode.payload()));
        RowSet<Row> rows = client().preparedQuery(INSERT)
                .execute(params)
                .await().indefinitely();
        return rows.iterator().hasNext() ? mapRow(rows.iterator().next()) : null;
    }

    private Pool client() {
        return clientInstance.get();
    }

    private InteractionEpisode mapRow(Row row) {
        return new InteractionEpisode(
                row.getUUID("id").toString(),
                row.getString("tenant_code"),
                row.getString("user_id"),
                row.getString("surface"),
                row.getString("run_id"),
                row.getString("signal"),
                toMap(row.getJsonObject("payload")),
                row.getOffsetDateTime("created_at"));
    }

    private JsonObject toJson(Map<String, Object> value) {
        return new JsonObject(value == null ? Map.of() : value);
    }

    private Map<String, Object> toMap(JsonObject value) {
        return value == null ? Map.of() : new LinkedHashMap<>(value.getMap());
    }
}
