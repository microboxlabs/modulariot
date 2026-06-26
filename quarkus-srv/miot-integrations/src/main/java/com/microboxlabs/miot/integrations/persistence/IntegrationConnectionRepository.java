package com.microboxlabs.miot.integrations.persistence;

import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import java.net.URI;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@ApplicationScoped
public class IntegrationConnectionRepository {

    private static final String SELECT_BY_TENANT = """
            SELECT id, tenant_code, name, provider_type, base_url, credential_profile_id,
                   status, last_tested_at, last_test_result, metadata
            FROM miot_integrations.integration_connections
            WHERE tenant_code = $1 AND active
            ORDER BY name
            """;

    private static final String SELECT_BY_TENANT_AND_ID = """
            SELECT id, tenant_code, name, provider_type, base_url, credential_profile_id,
                   status, last_tested_at, last_test_result, metadata
            FROM miot_integrations.integration_connections
            WHERE tenant_code = $1 AND id = $2 AND active
            """;

    // Best connection of a provider for a tenant: prefer ACTIVE, then a passing test,
    // then the most recently tested. Lets a caller send through whichever connection the
    // operator most recently validated.
    private static final String SELECT_ACTIVE_BY_PROVIDER = """
            SELECT id, tenant_code, name, provider_type, base_url, credential_profile_id,
                   status, last_tested_at, last_test_result, metadata
            FROM miot_integrations.integration_connections
            WHERE tenant_code = $1 AND provider_type = $2 AND active
            ORDER BY (status = 'ACTIVE') DESC,
                     last_test_result DESC NULLS LAST,
                     last_tested_at DESC NULLS LAST
            LIMIT 1
            """;

    private static final String INSERT = """
            INSERT INTO miot_integrations.integration_connections (
                id, tenant_code, name, provider_type, base_url, credential_profile_id,
                status, last_tested_at, last_test_result, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id, tenant_code, name, provider_type, base_url, credential_profile_id,
                      status, last_tested_at, last_test_result, metadata
            """;

    private static final String UPDATE_TEST_RESULT = """
            UPDATE miot_integrations.integration_connections
            SET status = $3, last_tested_at = $4, last_test_result = $5, updated_at = $4
            WHERE tenant_code = $1 AND id = $2 AND active
            RETURNING id, tenant_code, name, provider_type, base_url, credential_profile_id,
                      status, last_tested_at, last_test_result, metadata
            """;

    private final Instance<Pool> clientInstance;

    IntegrationConnectionRepository(Instance<Pool> clientInstance) {
        this.clientInstance = clientInstance;
    }

    public List<IntegrationConnection> listByTenant(String tenantCode) {
        return client().preparedQuery(SELECT_BY_TENANT)
                .execute(Tuple.of(tenantCode))
                .await().indefinitely()
                .stream()
                .map(this::mapRow)
                .toList();
    }

    public IntegrationConnection create(IntegrationConnection connection) {
        Tuple params = Tuple.tuple()
                .addUUID(UUID.fromString(connection.id()))
                .addString(connection.tenantCode())
                .addString(connection.name())
                .addString(connection.providerType().name())
                .addString(connection.baseUrl().toString())
                .addUUID(toUuid(connection.credentialProfileId()))
                .addString(connection.status().name())
                .addOffsetDateTime(connection.lastTestedAt())
                .addBoolean(connection.lastTestResult())
                .addJsonObject(toJson(connection.metadata()));
        return mapRow(client().preparedQuery(INSERT)
                .execute(params)
                .await().indefinitely()
                .iterator().next());
    }

    public IntegrationConnection findByTenantAndId(String tenantCode, String connectionId) {
        var rows = client().preparedQuery(SELECT_BY_TENANT_AND_ID)
                .execute(Tuple.of(tenantCode, UUID.fromString(connectionId)))
                .await().indefinitely();
        return rows.iterator().hasNext() ? mapRow(rows.iterator().next()) : null;
    }

    public IntegrationConnection findActiveByProvider(String tenantCode, ProviderType providerType) {
        var rows = client().preparedQuery(SELECT_ACTIVE_BY_PROVIDER)
                .execute(Tuple.of(tenantCode, providerType.name()))
                .await().indefinitely();
        var iterator = rows.iterator();
        return iterator.hasNext() ? mapRow(iterator.next()) : null;
    }

    public IntegrationConnection updateTestResult(
            String tenantCode,
            String connectionId,
            ConnectionStatus status,
            OffsetDateTime testedAt,
            Boolean testResult) {
        var rows = client().preparedQuery(UPDATE_TEST_RESULT)
                .execute(Tuple.of(
                        tenantCode,
                        UUID.fromString(connectionId),
                        status.name(),
                        testedAt,
                        testResult))
                .await().indefinitely();
        return rows.iterator().hasNext() ? mapRow(rows.iterator().next()) : null;
    }

    private Pool client() {
        return clientInstance.get();
    }

    private IntegrationConnection mapRow(Row row) {
        UUID credentialProfileId = row.getUUID("credential_profile_id");
        return new IntegrationConnection(
                row.getUUID("id").toString(),
                row.getString("tenant_code"),
                row.getString("name"),
                ProviderType.valueOf(row.getString("provider_type")),
                URI.create(row.getString("base_url")),
                credentialProfileId == null ? null : credentialProfileId.toString(),
                ConnectionStatus.valueOf(row.getString("status")),
                row.getOffsetDateTime("last_tested_at"),
                row.getBoolean("last_test_result"),
                toMap(row.getJsonObject("metadata")));
    }

    private UUID toUuid(String value) {
        return value == null || value.isBlank() ? null : UUID.fromString(value);
    }

    private JsonObject toJson(Map<String, Object> value) {
        return new JsonObject(value == null ? Map.of() : value);
    }

    private Map<String, Object> toMap(JsonObject value) {
        return value == null ? Map.of() : new LinkedHashMap<>(value.getMap());
    }
}
