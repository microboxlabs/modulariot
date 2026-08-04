package com.microboxlabs.miot.integrations.persistence;

import com.microboxlabs.miot.integrations.domain.IntegrationEventBinding;
import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@ApplicationScoped
public class IntegrationEventBindingRepository {

    /**
     * Shared projection. Every clause that appends this must leave the keyword before it on
     * its own line: a text block strips trailing spaces from each line, so {@code RETURNING }
     * followed by the closing delimiter loses its space and yields {@code RETURNINGid}.
     */
    private static final String COLUMNS = """
            id, tenant_client_id, owner_org_slug, event_type, scope_kind, scope_key,
            connection_id, operation_id, match_condition, field_templates, response_templates,
            field_defaults, response_conditions,
            enabled, created_at, updated_at, created_by, updated_by
            """;

    /**
     * The orgs whose bindings a caller may read: its own, plus its parent's. A parent
     * configures once for the orgs beneath it; a child can still add its own. Resolved in
     * SQL against {@code miot_core.organizations} rather than threading a parent slug
     * through the request context, which would mean changing miot-core for one consumer.
     */
    private static final String VISIBLE_OWNERS = """
            (
                SELECT o.slug FROM miot_core.organizations o
                 WHERE o.slug = $2 AND o.active
                UNION
                SELECT p.slug FROM miot_core.organizations o
                  JOIN miot_core.organizations p ON p.id = o.parent_id
                 WHERE o.slug = $2 AND o.active AND p.active
            )
            """;

    private static final String SELECT_VISIBLE = "SELECT " + COLUMNS + """
            FROM miot_integrations.integration_event_bindings
            WHERE tenant_client_id = $1
              AND owner_org_slug IN
            """ + VISIBLE_OWNERS + """
              AND active
            ORDER BY event_type, scope_kind NULLS FIRST, scope_key NULLS FIRST
            """;

    private static final String SELECT_BY_ID = "SELECT " + COLUMNS + """
            FROM miot_integrations.integration_event_bindings
            WHERE tenant_client_id = $1
              AND owner_org_slug IN
            """ + VISIBLE_OWNERS + """
              AND id = $3 AND active
            """;

    /**
     * Dispatch-time lookup: every armed binding for this tenant and event type, across all
     * owning orgs. Scope matching happens in the service, because a NULL scope_kind means
     * "every scope" and that is a rule, not a filter.
     */
    private static final String SELECT_ARMED = "SELECT " + COLUMNS + """
            FROM miot_integrations.integration_event_bindings
            WHERE tenant_client_id = $1 AND event_type = $2 AND active AND enabled
            """;

    /**
     * Dispatch-time load by id. Scoped by tenant but not by owning org: the job was enqueued
     * because this binding matched, and a worker has no organization context to check against.
     */
    private static final String SELECT_ACTIVE_BY_ID = "SELECT " + COLUMNS + """
            FROM miot_integrations.integration_event_bindings
            WHERE tenant_client_id = $1 AND id = $2 AND active
            """;

    /**
     * Upsert on the binding's natural key. COALESCE mirrors the unique index, which keys on
     * COALESCE(scope_*, '') so two "every scope" bindings collide instead of both inserting.
     */
    private static final String UPSERT = """
            INSERT INTO miot_integrations.integration_event_bindings (
                tenant_client_id, owner_org_slug, event_type, scope_kind, scope_key,
                connection_id, operation_id, match_condition, field_templates,
                response_templates, field_defaults, response_conditions,
                enabled, created_by, updated_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)
            ON CONFLICT (tenant_client_id, owner_org_slug, event_type,
                         COALESCE(scope_kind, ''), COALESCE(scope_key, ''), connection_id)
                WHERE active
            DO UPDATE SET
                operation_id        = EXCLUDED.operation_id,
                match_condition     = EXCLUDED.match_condition,
                field_templates     = EXCLUDED.field_templates,
                response_templates  = EXCLUDED.response_templates,
                field_defaults      = EXCLUDED.field_defaults,
                response_conditions = EXCLUDED.response_conditions,
                enabled             = EXCLUDED.enabled,
                updated_by          = EXCLUDED.updated_by,
                updated_at          = now()
            RETURNING
            """ + COLUMNS;

    // Soft delete: the row stays for audit and frees its slot in the unique index.
    private static final String SOFT_DELETE = """
            UPDATE miot_integrations.integration_event_bindings
            SET active = false, updated_at = now(), updated_by = COALESCE($4::text, updated_by)
            WHERE tenant_client_id = $1
              AND owner_org_slug IN
            """ + VISIBLE_OWNERS + """
              AND id = $3 AND active
            """;

    private static final String COUNT_BY_CONNECTION = """
            SELECT count(*) AS total
            FROM miot_integrations.integration_event_bindings
            WHERE connection_id = $1 AND active
            """;

    private final Instance<Pool> clientInstance;

    protected IntegrationEventBindingRepository(Instance<Pool> clientInstance) {
        this.clientInstance = clientInstance;
    }

    public List<IntegrationEventBinding> listVisible(String tenantClientId, String orgSlug) {
        return client().preparedQuery(SELECT_VISIBLE)
                .execute(Tuple.of(tenantClientId, orgSlug))
                .await().indefinitely()
                .stream()
                .map(this::mapRow)
                .toList();
    }

    public IntegrationEventBinding findVisibleById(
            String tenantClientId, String orgSlug, String id) {
        UUID bindingId = toUuid(id);
        if (bindingId == null) {
            return null;
        }
        return first(client().preparedQuery(SELECT_BY_ID)
                .execute(Tuple.of(tenantClientId, orgSlug, bindingId))
                .await().indefinitely());
    }

    /** Every enabled binding for the event, regardless of which org owns it. */
    public List<IntegrationEventBinding> listArmed(String tenantClientId, String eventType) {
        return client().preparedQuery(SELECT_ARMED)
                .execute(Tuple.of(tenantClientId, eventType))
                .await().indefinitely()
                .stream()
                .map(this::mapRow)
                .toList();
    }

    /** @return the binding, or null when it was unbound between enqueue and dispatch */
    public IntegrationEventBinding findActiveById(String tenantClientId, String id) {
        UUID bindingId = toUuid(id);
        if (bindingId == null) {
            return null;
        }
        return first(client().preparedQuery(SELECT_ACTIVE_BY_ID)
                .execute(Tuple.of(tenantClientId, bindingId))
                .await().indefinitely());
    }

    public IntegrationEventBinding upsert(IntegrationEventBinding binding, String actor) {
        Tuple params = Tuple.tuple()
                .addString(binding.tenantClientId())
                .addString(binding.ownerOrgSlug())
                .addString(binding.eventType())
                .addString(binding.scopeKind())
                .addString(binding.scopeKey())
                .addUUID(UUID.fromString(binding.connectionId()))
                .addValue(binding.operationId() == null ? null : UUID.fromString(binding.operationId()))
                .addJsonObject(toJson(binding.matchCondition()))
                .addJsonObject(toJsonFromStrings(binding.fieldTemplates()))
                .addJsonObject(toJsonFromStrings(binding.responseTemplates()))
                .addJsonObject(toJsonFromStrings(binding.fieldDefaults()))
                .addJsonObject(toJson(binding.responseConditions()))
                .addBoolean(binding.enabled())
                .addString(actor);
        return mapRow(client().preparedQuery(UPSERT)
                .execute(params)
                .await().indefinitely()
                .iterator().next());
    }

    /** @return true when a row was deactivated, false when the id matched nothing visible */
    public boolean softDelete(String tenantClientId, String orgSlug, String id, String actor) {
        UUID bindingId = toUuid(id);
        if (bindingId == null) {
            return false;
        }
        return client().preparedQuery(SOFT_DELETE)
                .execute(Tuple.of(tenantClientId, orgSlug, bindingId, actor))
                .await().indefinitely()
                .rowCount() > 0;
    }

    /** How many live bindings still point at a connection — checked before deleting one. */
    public int countByConnection(String connectionId) {
        UUID id = toUuid(connectionId);
        if (id == null) {
            return 0;
        }
        return client().preparedQuery(COUNT_BY_CONNECTION)
                .execute(Tuple.of(id))
                .await().indefinitely()
                .iterator().next().getInteger("total");
    }

    private Pool client() {
        return clientInstance.get();
    }

    private IntegrationEventBinding first(RowSet<Row> rows) {
        var iterator = rows.iterator();
        return iterator.hasNext() ? mapRow(iterator.next()) : null;
    }

    private IntegrationEventBinding mapRow(Row row) {
        UUID operationId = row.getUUID("operation_id");
        return new IntegrationEventBinding(
                row.getUUID("id").toString(),
                row.getString("tenant_client_id"),
                row.getString("owner_org_slug"),
                row.getString("event_type"),
                row.getString("scope_kind"),
                row.getString("scope_key"),
                row.getUUID("connection_id").toString(),
                operationId == null ? null : operationId.toString(),
                toMap(row.getJsonObject("match_condition")),
                toStringMap(row.getJsonObject("field_templates")),
                toStringMap(row.getJsonObject("response_templates")),
                toStringMapKeepingNulls(row.getJsonObject("field_defaults")),
                toMap(row.getJsonObject("response_conditions")),
                row.getBoolean("enabled"),
                row.getOffsetDateTime("created_at"),
                row.getOffsetDateTime("updated_at"),
                row.getString("created_by"),
                row.getString("updated_by"));
    }

    /** Blank or non-UUID ids short-circuit before any DB access, so they never reach the pool. */
    private UUID toUuid(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private JsonObject toJson(Map<String, Object> value) {
        return new JsonObject(value == null ? Map.of() : value);
    }

    private JsonObject toJsonFromStrings(Map<String, String> value) {
        JsonObject json = new JsonObject();
        if (value != null) {
            // putNull, not put(key, null): a null field default is a stored fact (an
            // explicit-null default the renderer honors), and it must survive the trip.
            value.forEach((key, text) -> {
                if (text == null) {
                    json.putNull(key);
                } else {
                    json.put(key, text);
                }
            });
        }
        return json;
    }

    private Map<String, Object> toMap(JsonObject value) {
        return value == null ? Map.of() : new LinkedHashMap<>(value.getMap());
    }

    private Map<String, String> toStringMap(JsonObject value) {
        Map<String, String> map = new LinkedHashMap<>();
        if (value != null) {
            value.forEach(entry ->
                    map.put(entry.getKey(), entry.getValue() == null ? "" : entry.getValue().toString()));
        }
        return map;
    }

    /**
     * Like {@link #toStringMap} but a JSON null stays a map null: in {@code field_defaults}
     * a present-but-null value is an explicit-null default (the renderer sends
     * {@code "field": null}), not a blank to coalesce away.
     */
    private Map<String, String> toStringMapKeepingNulls(JsonObject value) {
        Map<String, String> map = new LinkedHashMap<>();
        if (value != null) {
            value.forEach(entry -> map.put(entry.getKey(),
                    entry.getValue() == null ? null : entry.getValue().toString()));
        }
        return map;
    }
}
