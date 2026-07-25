package com.microboxlabs.miot.integrations.persistence;

import com.microboxlabs.miot.integrations.domain.IntegrationTemplate;
import com.microboxlabs.miot.integrations.domain.ProviderType;
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
public class IntegrationTemplateRepository {

    private static final String COLUMNS = """
            id, tenant_code, name, provider_type, operation_name, method, path,
            request_schema, response_schema""";

    private static final String SELECT_BY_TENANT = "SELECT " + COLUMNS + """
             FROM miot_integrations.integration_templates
            WHERE tenant_code = $1 AND active
            ORDER BY name
            """;

    private static final String SELECT_BY_TENANT_AND_ID = "SELECT " + COLUMNS + """
             FROM miot_integrations.integration_templates
            WHERE tenant_code = $1 AND id = $2 AND active
            """;

    private static final String INSERT = """
            INSERT INTO miot_integrations.integration_templates (
                id, tenant_code, name, provider_type, operation_name, method, path,
                request_schema, response_schema
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING
            """ + COLUMNS;

    // Partial update: a null parameter leaves the column unchanged (explicit ::casts so the
    // NULL binds keep their type). provider_type is intentionally immutable — a template's
    // kind is fixed once instances exist against it.
    private static final String UPDATE = """
            UPDATE miot_integrations.integration_templates
            SET name           = COALESCE($3::text, name),
                operation_name = COALESCE($4::text, operation_name),
                method         = COALESCE($5::text, method),
                path           = COALESCE($6::text, path),
                request_schema = COALESCE($7::jsonb, request_schema),
                response_schema = COALESCE($8::jsonb, response_schema),
                updated_at     = now()
            WHERE tenant_code = $1 AND id = $2 AND active
            RETURNING
            """ + COLUMNS;

    private static final String SOFT_DELETE = """
            UPDATE miot_integrations.integration_templates
            SET active = false, updated_at = now()
            WHERE tenant_code = $1 AND id = $2 AND active
            """;

    private final Instance<Pool> clientInstance;

    // Protected so tests can subclass it with a null pool, as the sibling repositories allow.
    protected IntegrationTemplateRepository(Instance<Pool> clientInstance) {
        this.clientInstance = clientInstance;
    }

    public List<IntegrationTemplate> listByTenant(String tenantCode) {
        return client().preparedQuery(SELECT_BY_TENANT)
                .execute(Tuple.of(tenantCode))
                .await().indefinitely()
                .stream()
                .map(this::mapRow)
                .toList();
    }

    /** @return the template, or {@code null} when the id is unknown, inactive, or another tenant's. */
    public IntegrationTemplate findByTenantAndId(String tenantCode, String templateId) {
        UUID id = parseUuidOrNull(templateId);
        if (id == null) {
            return null;
        }
        var rows = client().preparedQuery(SELECT_BY_TENANT_AND_ID)
                .execute(Tuple.of(tenantCode, id))
                .await().indefinitely();
        return rows.iterator().hasNext() ? mapRow(rows.iterator().next()) : null;
    }

    public IntegrationTemplate create(IntegrationTemplate template) {
        Tuple params = Tuple.tuple()
                .addUUID(UUID.fromString(template.id()))
                .addString(template.tenantCode())
                .addString(template.name())
                .addString(template.providerType().name())
                .addString(template.operationName())
                .addString(template.method())
                .addString(template.path())
                .addJsonObject(toJson(template.requestSchema()))
                .addJsonObject(toJson(template.responseSchema()));
        return mapRow(client().preparedQuery(INSERT)
                .execute(params)
                .await().indefinitely()
                .iterator().next());
    }

    /**
     * Partial update. {@code null} fields leave their columns unchanged.
     *
     * @return the updated template, or {@code null} when the id is unknown or inactive
     */
    public IntegrationTemplate update(
            String tenantCode,
            String templateId,
            String name,
            String operationName,
            String method,
            String path,
            Map<String, Object> requestSchema,
            Map<String, Object> responseSchema) {
        Tuple params = Tuple.tuple()
                .addString(tenantCode)
                .addUUID(UUID.fromString(templateId))
                .addString(name)
                .addString(operationName)
                .addString(method)
                .addString(path)
                .addValue(requestSchema == null ? null : new JsonObject(requestSchema))
                .addValue(responseSchema == null ? null : new JsonObject(responseSchema));
        var rows = client().preparedQuery(UPDATE)
                .execute(params)
                .await().indefinitely();
        return rows.iterator().hasNext() ? mapRow(rows.iterator().next()) : null;
    }

    /** @return {@code true} when a row was deactivated, {@code false} when nothing matched. */
    public boolean softDelete(String tenantCode, String templateId) {
        UUID id = parseUuidOrNull(templateId);
        if (id == null) {
            return false;
        }
        return client().preparedQuery(SOFT_DELETE)
                .execute(Tuple.of(tenantCode, id))
                .await().indefinitely()
                .rowCount() > 0;
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

    private IntegrationTemplate mapRow(Row row) {
        return new IntegrationTemplate(
                row.getUUID("id").toString(),
                row.getString("tenant_code"),
                row.getString("name"),
                ProviderType.valueOf(row.getString("provider_type")),
                row.getString("operation_name"),
                row.getString("method"),
                row.getString("path"),
                toMap(row.getJsonObject("request_schema")),
                toMap(row.getJsonObject("response_schema")));
    }

    private JsonObject toJson(Map<String, Object> value) {
        return new JsonObject(value == null ? Map.of() : value);
    }

    private Map<String, Object> toMap(JsonObject value) {
        return value == null ? Map.of() : new LinkedHashMap<>(value.getMap());
    }
}
