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
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.jboss.logging.Logger;

@ApplicationScoped
public class IntegrationConnectionRepository {

    private static final Logger LOG = Logger.getLogger(IntegrationConnectionRepository.class);

    // Shared read/return column list, so template_id is threaded through every query that
    // feeds mapRow without repeating (and mis-indenting) it.
    private static final String COLUMNS = """
            id, tenant_code, name, provider_type, base_url, credential_profile_id,
            status, last_tested_at, last_test_result, metadata, template_id""";

    private static final String SELECT_BY_TENANT = "SELECT " + COLUMNS + """

            FROM miot_integrations.integration_connections
            WHERE tenant_code = $1 AND active
            ORDER BY name
            """;

    private static final String SELECT_BY_TENANT_AND_ID = "SELECT " + COLUMNS + """

            FROM miot_integrations.integration_connections
            WHERE tenant_code = $1 AND id = $2 AND active
            """;

    // Best connection of a provider for a tenant: prefer ACTIVE, then a passing test,
    // then the most recently tested. Lets a caller send through whichever connection the
    // operator most recently validated.
    private static final String SELECT_ACTIVE_BY_PROVIDER = "SELECT " + COLUMNS + """

            FROM miot_integrations.integration_connections
            WHERE tenant_code = $1 AND provider_type = $2 AND active
            ORDER BY (status = 'ACTIVE') DESC,
                     last_test_result DESC NULLS LAST,
                     last_tested_at DESC NULLS LAST
            LIMIT 1
            """;

    // Keyed on template *name*, not id: template ids are per-environment UUIDs, so a workflow
    // variable or config value can only name the template. Subquery rather than JOIN keeps the
    // shared COLUMNS list usable unqualified, and repeating $1 inside it confines the match to
    // templates the tenant owns — a template_id pointing at another tenant's row resolves to
    // nothing rather than borrowing its contract.
    private static final String SELECT_ACTIVE_BY_TEMPLATE_NAME = "SELECT " + COLUMNS + """

            FROM miot_integrations.integration_connections
            WHERE tenant_code = $1
              AND active
              AND template_id IN (
                  SELECT id FROM miot_integrations.integration_templates
                  WHERE tenant_code = $1 AND lower(name) = lower($2) AND active
              )
            ORDER BY (status = 'ACTIVE') DESC,
                     last_test_result DESC NULLS LAST,
                     last_tested_at DESC NULLS LAST
            LIMIT 1
            """;

    // Reverse lookup for inbound Meta webhooks: an inbound event carries only the
    // phone_number_id (which of our numbers received it), so we map that back to the org that
    // owns the active WHATSAPP connection advertising it. provider_type is a literal so the
    // partial UNIQUE index (V0.6.3) on metadata->>'phone_number_id' is used. That index guarantees
    // at most one such row, but we deliberately fetch LIMIT 2: the read path fails closed in
    // findActiveWhatsAppByPhoneNumberId if the invariant is ever violated, so inbound is never
    // silently routed to an arbitrary tenant (a cross-tenant leak).
    private static final String SELECT_ACTIVE_WHATSAPP_BY_PHONE_NUMBER_ID = "SELECT " + COLUMNS + """

            FROM miot_integrations.integration_connections
            WHERE provider_type = 'WHATSAPP'
              AND active
              AND metadata->>'phone_number_id' = $1
            LIMIT 2
            """;

    // Reverse index for the credentials screen: which connections reference these
    // profiles. Takes the whole id set at once so listing N credentials stays one query
    // instead of N.
    private static final String SELECT_BY_CREDENTIAL_PROFILES = "SELECT " + COLUMNS + """

            FROM miot_integrations.integration_connections
            WHERE tenant_code = $1 AND credential_profile_id = ANY($2) AND active
            ORDER BY name
            """;

    // Instances of a template, for the "used by" panel and the template delete guard.
    private static final String SELECT_BY_TEMPLATE = "SELECT " + COLUMNS + """

            FROM miot_integrations.integration_connections
            WHERE tenant_code = $1 AND template_id = $2 AND active
            ORDER BY name
            """;

    private static final String INSERT = """
            INSERT INTO miot_integrations.integration_connections (
                id, tenant_code, name, provider_type, base_url, credential_profile_id,
                status, last_tested_at, last_test_result, metadata, template_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING
            """ + COLUMNS;

    private static final String UPDATE_TEST_RESULT = """
            UPDATE miot_integrations.integration_connections
            SET status = $3, last_tested_at = $4, last_test_result = $5, updated_at = $4
            WHERE tenant_code = $1 AND id = $2 AND active
            RETURNING
            """ + COLUMNS;

    // Partial update: a null parameter leaves the column unchanged (explicit ::casts so the
    // NULL binds keep their type in the prepared statement). metadata is replaced wholesale.
    private static final String UPDATE_CONNECTION = """
            UPDATE miot_integrations.integration_connections
            SET name = COALESCE($3::text, name),
                base_url = COALESCE($4::text, base_url),
                metadata = COALESCE($5::jsonb, metadata),
                credential_profile_id = COALESCE($6::uuid, credential_profile_id),
                updated_at = now()
            WHERE tenant_code = $1 AND id = $2 AND active
            RETURNING
            """ + COLUMNS;

    // Soft delete: the row stays for audit and drops out of every "AND active" query,
    // so a removed instance disappears from listings and dispatch-targets alike.
    private static final String SOFT_DELETE = """
            UPDATE miot_integrations.integration_connections
            SET active = false, updated_at = now()
            WHERE tenant_code = $1 AND id = $2 AND active
            """;

    private final Instance<Pool> clientInstance;

    // Protected so tests can subclass it with a null pool, as AsyncJobRepository allows.
    protected IntegrationConnectionRepository(Instance<Pool> clientInstance) {
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
                .addJsonObject(toJson(connection.metadata()))
                .addUUID(toUuid(connection.templateId()));
        return mapRow(client().preparedQuery(INSERT)
                .execute(params)
                .await().indefinitely()
                .iterator().next());
    }

    public IntegrationConnection findByTenantAndId(String tenantCode, String connectionId) {
        UUID id = parseUuidOrNull(connectionId);
        if (id == null) {
            return null;
        }
        var rows = client().preparedQuery(SELECT_BY_TENANT_AND_ID)
                .execute(Tuple.of(tenantCode, id))
                .await().indefinitely();
        return rows.iterator().hasNext() ? mapRow(rows.iterator().next()) : null;
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

    public IntegrationConnection findActiveByProvider(String tenantCode, ProviderType providerType) {
        var rows = client().preparedQuery(SELECT_ACTIVE_BY_PROVIDER)
                .execute(Tuple.of(tenantCode, providerType.name()))
                .await().indefinitely();
        var iterator = rows.iterator();
        return iterator.hasNext() ? mapRow(iterator.next()) : null;
    }

    /**
     * The connection a tenant uses for a named template, or {@code null} when it has none — the
     * normal state during rollout, not an error. Ordered like {@link #findActiveByProvider} so
     * the instance the operator most recently validated serves traffic. Blank guard runs before
     * {@code client()}, mirroring {@link #findByTenantAndId}.
     */
    public IntegrationConnection findActiveByTemplateName(String tenantCode, String templateName) {
        if (tenantCode == null || tenantCode.isBlank()
                || templateName == null || templateName.isBlank()) {
            return null;
        }
        var rows = client().preparedQuery(SELECT_ACTIVE_BY_TEMPLATE_NAME)
                .execute(Tuple.of(tenantCode, templateName))
                .await().indefinitely();
        var iterator = rows.iterator();
        return iterator.hasNext() ? mapRow(iterator.next()) : null;
    }

    // Blank guard runs before client() so a missing phone_number_id never hits the DB (and is
    // safe with a null pool in unit tests), mirroring findByTenantAndId.
    public IntegrationConnection findActiveWhatsAppByPhoneNumberId(String phoneNumberId) {
        if (phoneNumberId == null || phoneNumberId.isBlank()) {
            return null;
        }
        List<IntegrationConnection> matches = client().preparedQuery(SELECT_ACTIVE_WHATSAPP_BY_PHONE_NUMBER_ID)
                .execute(Tuple.of(phoneNumberId))
                .await().indefinitely()
                .stream()
                .map(this::mapRow)
                .toList();
        if (matches.size() > 1) {
            // Fail closed: the V0.6.3 unique index should make this impossible, but if two active
            // WHATSAPP connections ever share a phone_number_id we refuse to route rather than
            // leak one tenant's inbound message into another tenant's inbox.
            LOG.errorf("Multiple active WHATSAPP connections advertise phone_number_id %s — refusing "
                    + "to route inbound (the V0.6.3 unique index should prevent this)", phoneNumberId);
            return null;
        }
        return matches.isEmpty() ? null : matches.get(0);
    }

    /**
     * Connections referencing any of {@code credentialProfileIds}, for the "used by"
     * panel and the delete guard. Blank ids are dropped and an empty set short-circuits
     * before the pool, so a credential with no id to check costs no query.
     */
    public List<IntegrationConnection> listByCredentialProfiles(
            String tenantCode, Collection<String> credentialProfileIds) {
        if (credentialProfileIds == null || credentialProfileIds.isEmpty()) {
            return List.of();
        }
        UUID[] ids = credentialProfileIds.stream()
                .map(this::toUuid)
                .filter(Objects::nonNull)
                .distinct()
                .toArray(UUID[]::new);
        if (ids.length == 0) {
            return List.of();
        }
        return client().preparedQuery(SELECT_BY_CREDENTIAL_PROFILES)
                .execute(Tuple.of(tenantCode, ids))
                .await().indefinitely()
                .stream()
                .map(this::mapRow)
                .toList();
    }

    /**
     * Connections that are instances of {@code templateId}. Blank or non-UUID ids
     * short-circuit before the pool, so they never reach the DB (and are safe with a null
     * pool in unit tests).
     */
    public List<IntegrationConnection> listByTemplate(String tenantCode, String templateId) {
        UUID id = parseUuidOrNull(templateId);
        if (id == null) {
            return List.of();
        }
        return client().preparedQuery(SELECT_BY_TEMPLATE)
                .execute(Tuple.of(tenantCode, id))
                .await().indefinitely()
                .stream()
                .map(this::mapRow)
                .toList();
    }

    public IntegrationConnection update(
            String tenantCode,
            String connectionId,
            String name,
            String baseUrl,
            String credentialProfileId,
            Map<String, Object> metadata) {
        Tuple params = Tuple.tuple()
                .addString(tenantCode)
                .addUUID(UUID.fromString(connectionId))
                .addString(name)
                .addString(baseUrl)
                .addValue(metadata == null ? null : new JsonObject(metadata))
                .addUUID(toUuid(credentialProfileId));
        var rows = client().preparedQuery(UPDATE_CONNECTION)
                .execute(params)
                .await().indefinitely();
        return rows.iterator().hasNext() ? mapRow(rows.iterator().next()) : null;
    }

    /** @return {@code true} when a row was deactivated, {@code false} when nothing matched. */
    public boolean softDelete(String tenantCode, String connectionId) {
        UUID id = parseUuidOrNull(connectionId);
        if (id == null) {
            return false;
        }
        return client().preparedQuery(SOFT_DELETE)
                .execute(Tuple.of(tenantCode, id))
                .await().indefinitely()
                .rowCount() > 0;
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
        UUID templateId = row.getUUID("template_id");
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
                toMap(row.getJsonObject("metadata")),
                templateId == null ? null : templateId.toString());
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
