package com.microboxlabs.miot.integrations.persistence;

import com.microboxlabs.miot.integrations.domain.IntegrationOperation;
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
public class IntegrationOperationRepository {

    private static final String SELECT_BY_CONNECTION = """
            SELECT id, connection_id, name, method, path, request_schema, response_schema, test_operation
            FROM miot_integrations.integration_operations
            WHERE connection_id = $1 AND active
            ORDER BY name
            """;

    // Both lookups are scoped by connection_id as well as the operation's own key. The
    // table has no tenant_code column, so an operation is only ever tenant-safe when it
    // is reached through a connection the caller already resolved for that tenant —
    // querying by operation id alone would cross orgs.
    private static final String SELECT_BY_CONNECTION_AND_ID = """
            SELECT id, connection_id, name, method, path, request_schema, response_schema, test_operation
            FROM miot_integrations.integration_operations
            WHERE connection_id = $1 AND id = $2 AND active
            """;

    private static final String SELECT_BY_CONNECTION_AND_NAME = """
            SELECT id, connection_id, name, method, path, request_schema, response_schema, test_operation
            FROM miot_integrations.integration_operations
            WHERE connection_id = $1 AND lower(name) = lower($2) AND active
            """;

    private static final String INSERT = """
            INSERT INTO miot_integrations.integration_operations (
                id, connection_id, name, method, path, request_schema, response_schema, test_operation
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, connection_id, name, method, path, request_schema, response_schema, test_operation
            """;

    private final Instance<Pool> clientInstance;

    // Protected so tests can subclass it with a null pool, as the sibling repositories allow.
    protected IntegrationOperationRepository(Instance<Pool> clientInstance) {
        this.clientInstance = clientInstance;
    }

    public List<IntegrationOperation> listByConnection(String connectionId) {
        return client().preparedQuery(SELECT_BY_CONNECTION)
                .execute(Tuple.of(UUID.fromString(connectionId)))
                .await().indefinitely()
                .stream()
                .map(this::mapRow)
                .toList();
    }

    /**
     * @return the operation, or {@code null} when the id is unknown, inactive, or belongs
     *         to a different connection
     */
    public IntegrationOperation findByConnectionAndId(String connectionId, String operationId) {
        UUID id = toUuid(operationId);
        if (id == null) {
            return null;
        }
        return first(SELECT_BY_CONNECTION_AND_ID,
                Tuple.of(UUID.fromString(connectionId), id));
    }

    /** Name match is case-insensitive, mirroring the unique index on {@code lower(name)}. */
    public IntegrationOperation findByConnectionAndName(String connectionId, String name) {
        if (name == null || name.isBlank()) {
            return null;
        }
        return first(SELECT_BY_CONNECTION_AND_NAME,
                Tuple.of(UUID.fromString(connectionId), name.trim()));
    }

    public IntegrationOperation create(IntegrationOperation operation) {
        Tuple params = Tuple.tuple()
                .addUUID(UUID.fromString(operation.id()))
                .addUUID(UUID.fromString(operation.connectionId()))
                .addString(operation.name())
                .addString(operation.method())
                .addString(operation.path())
                .addJsonObject(toJson(operation.requestSchema()))
                .addJsonObject(toJson(operation.responseSchema()))
                .addBoolean(operation.testOperation());
        return mapRow(client().preparedQuery(INSERT)
                .execute(params)
                .await().indefinitely()
                .iterator().next());
    }

    private Pool client() {
        return clientInstance.get();
    }

    private IntegrationOperation first(String sql, Tuple params) {
        var iterator = client().preparedQuery(sql).execute(params).await().indefinitely().iterator();
        return iterator.hasNext() ? mapRow(iterator.next()) : null;
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

    private IntegrationOperation mapRow(Row row) {
        return new IntegrationOperation(
                row.getUUID("id").toString(),
                row.getUUID("connection_id").toString(),
                row.getString("name"),
                row.getString("method"),
                row.getString("path"),
                toMap(row.getJsonObject("request_schema")),
                toMap(row.getJsonObject("response_schema")),
                row.getBoolean("test_operation"));
    }

    private JsonObject toJson(Map<String, Object> value) {
        return new JsonObject(value == null ? Map.of() : value);
    }

    private Map<String, Object> toMap(JsonObject value) {
        return value == null ? Map.of() : new LinkedHashMap<>(value.getMap());
    }
}
