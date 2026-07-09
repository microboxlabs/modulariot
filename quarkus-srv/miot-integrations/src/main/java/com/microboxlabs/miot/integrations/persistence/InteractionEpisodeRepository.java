package com.microboxlabs.miot.integrations.persistence;

import com.microboxlabs.miot.integrations.domain.InteractionEpisode;
import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
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

    private static final String COLUMNS =
            "id, tenant_code, user_id, surface, run_id, signal, payload, created_at";

    private static final String INSERT = """
            INSERT INTO miot_integrations.interaction_episodes (
                tenant_code, user_id, surface, run_id, signal, payload
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING %s""".formatted(COLUMNS);

    // The distiller's READ side: recent episodes for one tenant (newest first),
    // and the set of tenants with fresh activity to iterate. Both are bounded by
    // a `since` cutoff so a background pass only reflects on recent signal, and
    // ride the `(tenant_code, created_at DESC)` index the migration created.
    private static final String LIST_RECENT_BY_TENANT = """
            SELECT %s
            FROM miot_integrations.interaction_episodes
            WHERE tenant_code = $1 AND created_at >= $2
            ORDER BY created_at DESC
            LIMIT $3""".formatted(COLUMNS);

    private static final String LIST_DISTINCT_RECENT_TENANTS = """
            SELECT DISTINCT tenant_code
            FROM miot_integrations.interaction_episodes
            WHERE created_at >= $1""";

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

    /** Recent episodes for one tenant, newest first — bounded by `since` + `limit`. */
    public List<InteractionEpisode> listRecentByTenant(
            String tenantCode, OffsetDateTime since, int limit) {
        RowSet<Row> rows = client().preparedQuery(LIST_RECENT_BY_TENANT)
                .execute(Tuple.of(tenantCode, since, limit))
                .await().indefinitely();
        List<InteractionEpisode> out = new ArrayList<>();
        for (Row row : rows) {
            out.add(mapRow(row));
        }
        return out;
    }

    /** Distinct tenant_codes with an episode since `since` — the per-tenant loop
     * driver. tenant_code already equals the org's tenant_client_id, so callers
     * use it verbatim as the harness `X-Miot-Tenant-Client-Id`. */
    public List<String> listDistinctTenantsSince(OffsetDateTime since) {
        RowSet<Row> rows = client().preparedQuery(LIST_DISTINCT_RECENT_TENANTS)
                .execute(Tuple.of(since))
                .await().indefinitely();
        List<String> out = new ArrayList<>();
        for (Row row : rows) {
            out.add(row.getString("tenant_code"));
        }
        return out;
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
