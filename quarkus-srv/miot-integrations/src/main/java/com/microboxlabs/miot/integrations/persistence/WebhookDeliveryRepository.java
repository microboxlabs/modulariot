package com.microboxlabs.miot.integrations.persistence;

import com.microboxlabs.miot.integrations.domain.WebhookDelivery;
import com.microboxlabs.miot.integrations.domain.WebhookDeliveryState;
import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@ApplicationScoped
public class WebhookDeliveryRepository {

    private static final String COLUMNS = """
            id, subscription_id, tenant_code, dedupe_key, payload, state, attempts, max_attempts,
            next_retry_at, last_status_code, last_error, created_at, updated_at
            """;

    private static final String SELECT_BY_SUBSCRIPTION = """
            SELECT %s
            FROM miot_integrations.webhook_deliveries
            WHERE tenant_code = $1 AND subscription_id = $2
            ORDER BY created_at DESC
            LIMIT $3
            """.formatted(COLUMNS);

    private final Instance<Pool> clientInstance;

    WebhookDeliveryRepository(Instance<Pool> clientInstance) {
        this.clientInstance = clientInstance;
    }

    public List<WebhookDelivery> listBySubscription(String tenantCode, String subscriptionId, int limit) {
        UUID id = parseUuidOrNull(subscriptionId);
        if (id == null) {
            return List.of();
        }
        int safeLimit = Math.min(Math.max(limit, 1), 200);
        return client().preparedQuery(SELECT_BY_SUBSCRIPTION)
                .execute(Tuple.of(tenantCode, id, safeLimit))
                .await().indefinitely()
                .stream()
                .map(this::mapRow)
                .toList();
    }

    private WebhookDelivery mapRow(Row row) {
        return new WebhookDelivery(
                row.getUUID("id").toString(),
                row.getUUID("subscription_id").toString(),
                row.getString("tenant_code"),
                row.getString("dedupe_key"),
                toMap(row.getJsonObject("payload")),
                WebhookDeliveryState.valueOf(row.getString("state")),
                row.getInteger("attempts"),
                row.getInteger("max_attempts"),
                row.getOffsetDateTime("next_retry_at"),
                row.getInteger("last_status_code"),
                row.getString("last_error"),
                row.getOffsetDateTime("created_at"),
                row.getOffsetDateTime("updated_at"));
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

    private static Map<String, Object> toMap(JsonObject value) {
        return value == null ? Map.of() : new LinkedHashMap<>(value.getMap());
    }
}
