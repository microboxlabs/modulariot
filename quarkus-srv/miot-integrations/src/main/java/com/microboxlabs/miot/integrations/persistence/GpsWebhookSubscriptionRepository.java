package com.microboxlabs.miot.integrations.persistence;

import com.microboxlabs.miot.integrations.domain.FilterMode;
import com.microboxlabs.miot.integrations.domain.GpsWebhookSubscription;
import io.smallrye.mutiny.Uni;
import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.SqlConnection;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@ApplicationScoped
public class GpsWebhookSubscriptionRepository {

    private static final String SELECT_COLUMNS = """
            s.id, s.tenant_code, s.connection_id, s.name, s.enabled, s.filter_mode,
            s.filter_json, s.include_all_visible, s.compiled_at, s.created_at, s.updated_at,
            c.base_url AS webhook_url
            """;

    private static final String SELECT_BY_TENANT = """
            SELECT %s
            FROM miot_integrations.webhook_subscriptions s
            JOIN miot_integrations.integration_connections c ON c.id = s.connection_id
            WHERE s.tenant_code = $1 AND s.active
            ORDER BY s.name
            """.formatted(SELECT_COLUMNS);

    private static final String SELECT_BY_TENANT_AND_ID = """
            SELECT %s
            FROM miot_integrations.webhook_subscriptions s
            JOIN miot_integrations.integration_connections c ON c.id = s.connection_id
            WHERE s.tenant_code = $1 AND s.id = $2 AND s.active
            """.formatted(SELECT_COLUMNS);

    private static final String INSERT = """
            INSERT INTO miot_integrations.webhook_subscriptions (
                id, tenant_code, connection_id, name, enabled, filter_mode, filter_json,
                include_all_visible, compiled_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id, tenant_code, connection_id, name, enabled, filter_mode, filter_json,
                      include_all_visible, compiled_at, created_at, updated_at
            """;

    private static final String UPDATE = """
            UPDATE miot_integrations.webhook_subscriptions
            SET name = COALESCE($3::text, name),
                enabled = COALESCE($4::boolean, enabled),
                filter_mode = COALESCE($5::text, filter_mode),
                filter_json = COALESCE($6::jsonb, filter_json),
                include_all_visible = COALESCE($7::boolean, include_all_visible),
                compiled_at = COALESCE($8::timestamptz, compiled_at),
                updated_at = now()
            WHERE tenant_code = $1 AND id = $2 AND active
            RETURNING id, tenant_code, connection_id, name, enabled, filter_mode, filter_json,
                      include_all_visible, compiled_at, created_at, updated_at
            """;

    private static final String SOFT_DELETE = """
            UPDATE miot_integrations.webhook_subscriptions
            SET active = false, enabled = false, updated_at = now()
            WHERE tenant_code = $1 AND id = $2 AND active
            """;

    private static final String DELETE_ASSETS = """
            DELETE FROM miot_integrations.webhook_subscription_assets
            WHERE subscription_id = $1
            """;

    private static final String INSERT_ASSET = """
            INSERT INTO miot_integrations.webhook_subscription_assets (subscription_id, asset_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
            """;

    private static final String SELECT_ASSETS = """
            SELECT asset_id
            FROM miot_integrations.webhook_subscription_assets
            WHERE subscription_id = $1
            ORDER BY asset_id
            """;

    private final Instance<Pool> clientInstance;

    GpsWebhookSubscriptionRepository(Instance<Pool> clientInstance) {
        this.clientInstance = clientInstance;
    }

    public List<GpsWebhookSubscription> listByTenant(String tenantCode) {
        List<GpsWebhookSubscription> rows = client().preparedQuery(SELECT_BY_TENANT)
                .execute(Tuple.of(tenantCode))
                .await().indefinitely()
                .stream()
                .map(this::mapJoinedRow)
                .toList();
        return rows.stream().map(this::withAssets).toList();
    }

    public GpsWebhookSubscription findByTenantAndId(String tenantCode, String subscriptionId) {
        UUID id = parseUuidOrNull(subscriptionId);
        if (id == null) {
            return null;
        }
        var result = client().preparedQuery(SELECT_BY_TENANT_AND_ID)
                .execute(Tuple.of(tenantCode, id))
                .await().indefinitely();
        if (!result.iterator().hasNext()) {
            return null;
        }
        return withAssets(mapJoinedRow(result.iterator().next()));
    }

    /**
     * Inserts the subscription and replaces assets in one transaction so a failed
     * membership write never leaves a partial create.
     */
    public GpsWebhookSubscription create(CreateSubscriptionParams params) {
        Tuple tuple = Tuple.tuple()
                .addUUID(UUID.fromString(params.id()))
                .addString(params.tenantCode())
                .addUUID(UUID.fromString(params.connectionId()))
                .addString(params.name())
                .addBoolean(params.enabled())
                .addString(params.filterMode().name())
                .addJsonObject(toJson(params.filterJson()))
                .addBoolean(params.includeAllVisible())
                .addOffsetDateTime(params.compiledAt());
        List<String> assets = params.assetIds() == null ? List.of() : List.copyOf(params.assetIds());
        return client().withTransaction(conn -> conn.preparedQuery(INSERT)
                        .execute(tuple)
                        .chain(rs -> {
                            Row row = rs.iterator().next();
                            return replaceAssetsOn(conn, UUID.fromString(params.id()), assets)
                                    .replaceWith(withAssetList(mapCoreRow(row, params.webhookUrl()), assets));
                        }))
                .await()
                .indefinitely();
    }

    /**
     * Updates subscription columns and, when asset membership is supplied, replaces
     * assets in the same transaction.
     */
    public GpsWebhookSubscription update(UpdateSubscriptionParams params) {
        UUID id = parseUuidOrNull(params.subscriptionId());
        if (id == null) {
            return null;
        }
        FilterMode filterMode = params.filterMode();
        Map<String, Object> filterJson = params.filterJson();
        Tuple tuple = Tuple.tuple()
                .addString(params.tenantCode())
                .addUUID(id)
                .addString(params.name())
                .addBoolean(params.enabled())
                .addString(filterMode == null ? null : filterMode.name())
                .addValue(filterJson == null ? null : toJson(filterJson))
                .addBoolean(params.includeAllVisible())
                .addOffsetDateTime(params.compiledAt());
        List<String> assetsOrNull = params.assetIdsOrNull();

        return client().withTransaction(conn -> conn.preparedQuery(UPDATE)
                        .execute(tuple)
                        .chain(rs -> {
                            if (!rs.iterator().hasNext()) {
                                return Uni.createFrom().nullItem();
                            }
                            Row row = rs.iterator().next();
                            GpsWebhookSubscription core = mapCoreRow(row, params.webhookUrl());
                            if (assetsOrNull == null) {
                                return listAssetsOn(conn, id)
                                        .map(assets -> withAssetList(core, assets));
                            }
                            List<String> assets = List.copyOf(assetsOrNull);
                            return replaceAssetsOn(conn, id, assets)
                                    .replaceWith(withAssetList(core, assets));
                        }))
                .await()
                .indefinitely();
    }

    public boolean softDelete(String tenantCode, String subscriptionId) {
        UUID id = parseUuidOrNull(subscriptionId);
        if (id == null) {
            return false;
        }
        int updated = client().preparedQuery(SOFT_DELETE)
                .execute(Tuple.of(tenantCode, id))
                .await().indefinitely()
                .rowCount();
        return updated > 0;
    }

    /**
     * Replaces membership in a single transaction so a failed insert never leaves
     * the subscription with a wiped asset set.
     */
    public void replaceAssets(String subscriptionId, List<String> assetIds) {
        UUID id = UUID.fromString(subscriptionId);
        List<String> assets = assetIds == null ? List.of() : assetIds;
        client().withTransaction(conn -> replaceAssetsOn(conn, id, assets))
                .await()
                .indefinitely();
    }

    private Uni<Void> replaceAssetsOn(SqlConnection conn, UUID id, List<String> assets) {
        Uni<Void> chain = conn.preparedQuery(DELETE_ASSETS)
                .execute(Tuple.of(id))
                .replaceWithVoid();
        for (String assetId : assets) {
            chain = chain.chain(() -> conn.preparedQuery(INSERT_ASSET)
                    .execute(Tuple.of(id, assetId))
                    .replaceWithVoid());
        }
        return chain;
    }

    private GpsWebhookSubscription withAssets(GpsWebhookSubscription subscription) {
        List<String> assets = listAssets(subscription.id());
        return withAssetList(subscription, assets);
    }

    private static GpsWebhookSubscription withAssetList(
            GpsWebhookSubscription subscription, List<String> assets) {
        return new GpsWebhookSubscription(
                subscription.id(),
                subscription.tenantCode(),
                subscription.connectionId(),
                subscription.name(),
                subscription.enabled(),
                subscription.filterMode(),
                subscription.filterJson(),
                subscription.includeAllVisible(),
                subscription.compiledAt(),
                subscription.createdAt(),
                subscription.updatedAt(),
                assets,
                subscription.webhookUrl());
    }

    private List<String> listAssets(String subscriptionId) {
        List<String> assets = new ArrayList<>();
        client().preparedQuery(SELECT_ASSETS)
                .execute(Tuple.of(UUID.fromString(subscriptionId)))
                .await().indefinitely()
                .forEach(row -> assets.add(row.getString("asset_id")));
        return List.copyOf(assets);
    }

    private Uni<List<String>> listAssetsOn(SqlConnection conn, UUID id) {
        return conn.preparedQuery(SELECT_ASSETS)
                .execute(Tuple.of(id))
                .map(rs -> {
                    List<String> assets = new ArrayList<>();
                    rs.forEach(row -> assets.add(row.getString("asset_id")));
                    return List.copyOf(assets);
                });
    }

    private GpsWebhookSubscription mapJoinedRow(Row row) {
        return mapCoreRow(row, row.getString("webhook_url"));
    }

    private GpsWebhookSubscription mapCoreRow(Row row, String webhookUrl) {
        return new GpsWebhookSubscription(
                row.getUUID("id").toString(),
                row.getString("tenant_code"),
                row.getUUID("connection_id").toString(),
                row.getString("name"),
                Boolean.TRUE.equals(row.getBoolean("enabled")),
                FilterMode.valueOf(row.getString("filter_mode")),
                toMap(row.getJsonObject("filter_json")),
                Boolean.TRUE.equals(row.getBoolean("include_all_visible")),
                row.getOffsetDateTime("compiled_at"),
                row.getOffsetDateTime("created_at"),
                row.getOffsetDateTime("updated_at"),
                List.of(),
                webhookUrl);
    }

    private Pool client() {
        return clientInstance.get();
    }

    private static UUID parseUuidOrNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static JsonObject toJson(Map<String, Object> value) {
        return new JsonObject(value == null ? Map.of() : value);
    }

    private static Map<String, Object> toMap(JsonObject value) {
        return value == null ? Map.of() : new LinkedHashMap<>(value.getMap());
    }
}
