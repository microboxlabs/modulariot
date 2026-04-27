package com.microboxlabs.miot.integrations.persistence;

import com.microboxlabs.miot.integrations.domain.IntegrationOperation;
import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
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

    private static final String INSERT = """
            INSERT INTO miot_integrations.integration_operations (
                id, connection_id, name, method, path, request_schema, response_schema, test_operation
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, connection_id, name, method, path, request_schema, response_schema, test_operation
            """;

    private final Instance<Pool> clientInstance;

    IntegrationOperationRepository(Instance<Pool> clientInstance) {
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
        return value == null ? Map.of() : Map.copyOf(value.getMap());
    }
}
