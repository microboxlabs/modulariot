package com.microboxlabs.miot.integrations.persistence;

import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.domain.CredentialProfile;
import com.microboxlabs.miot.integrations.domain.CredentialType;
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
public class CredentialProfileRepository {

    private static final String COLUMNS = """
            id, tenant_code, display_name, credential_type, auth_type, environment,
            public_config, encrypted_secret_json, secret_preview, secret_version,
            last_tested_at, last_test_result, created_at, updated_at, created_by, updated_by
            """;

    private static final String SELECT_BY_TENANT = "SELECT " + COLUMNS + """
            FROM miot_integrations.credential_profiles
            WHERE tenant_code = $1 AND active
            ORDER BY display_name
            """;

    private static final String SELECT_BY_ID = "SELECT " + COLUMNS + """
            FROM miot_integrations.credential_profiles
            WHERE tenant_code = $1 AND id = $2 AND active
            """;

    private static final String INSERT = """
            INSERT INTO miot_integrations.credential_profiles (
                id, tenant_code, display_name, credential_type, auth_type, environment,
                public_config, encrypted_secret_json, secret_preview, secret_version,
                created_at, updated_at, created_by, updated_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING """ + COLUMNS;

    private static final String UPDATE_SECRET = """
            UPDATE miot_integrations.credential_profiles
            SET encrypted_secret_json = $3, secret_preview = $4,
                secret_version = secret_version + 1, updated_at = now()
            WHERE tenant_code = $1 AND id = $2 AND active
            RETURNING """ + COLUMNS;

    // Partial update: a null parameter leaves the column unchanged (explicit ::casts so
    // the NULL binds keep their type in the prepared statement). The secret is rotated
    // only when a new ciphertext is supplied — a blank secret on the form means "keep the
    // stored one", so secret_version must not move either.
    private static final String UPDATE_PROFILE = """
            UPDATE miot_integrations.credential_profiles
            SET display_name = COALESCE($3::text, display_name),
                environment = COALESCE($4::text, environment),
                public_config = COALESCE($5::jsonb, public_config),
                encrypted_secret_json = COALESCE($6::text, encrypted_secret_json),
                secret_preview = CASE WHEN $6::text IS NULL THEN secret_preview ELSE $7::text END,
                secret_version = CASE WHEN $6::text IS NULL THEN secret_version ELSE secret_version + 1 END,
                updated_by = COALESCE($8::text, updated_by),
                updated_at = now()
            WHERE tenant_code = $1 AND id = $2 AND active
            RETURNING """ + COLUMNS;

    // Testing a credential is not editing it: updated_at stays put so a round of tests
    // does not reshuffle a list sorted by "last updated".
    private static final String UPDATE_TEST_RESULT = """
            UPDATE miot_integrations.credential_profiles
            SET last_tested_at = $3, last_test_result = $4
            WHERE tenant_code = $1 AND id = $2 AND active
            RETURNING """ + COLUMNS;

    // Soft delete: the row stays for audit and for anything still holding its id, but
    // drops out of every read path (all of which filter on active) and frees its name.
    private static final String SOFT_DELETE = """
            UPDATE miot_integrations.credential_profiles
            SET active = false, updated_at = now(), updated_by = COALESCE($3::text, updated_by)
            WHERE tenant_code = $1 AND id = $2 AND active
            """;

    private final Instance<Pool> clientInstance;

    // Protected so tests can subclass it with a null pool, as AsyncJobRepository allows.
    protected CredentialProfileRepository(Instance<Pool> clientInstance) {
        this.clientInstance = clientInstance;
    }

    public List<CredentialProfile> listByTenant(String tenantCode) {
        return client().preparedQuery(SELECT_BY_TENANT)
                .execute(Tuple.of(tenantCode))
                .await().indefinitely()
                .stream()
                .map(this::mapRow)
                .toList();
    }

    public CredentialProfile findByTenantAndId(String tenantCode, String id) {
        UUID profileId = toUuid(id);
        if (profileId == null) {
            return null;
        }
        return first(client().preparedQuery(SELECT_BY_ID)
                .execute(Tuple.of(tenantCode, profileId))
                .await().indefinitely());
    }

    public CredentialProfile updateSecret(
            String tenantCode, String id, String encryptedSecretJson, String secretPreview) {
        UUID profileId = toUuid(id);
        if (profileId == null) {
            return null;
        }
        return first(client().preparedQuery(UPDATE_SECRET)
                .execute(Tuple.of(tenantCode, profileId, encryptedSecretJson, secretPreview))
                .await().indefinitely());
    }

    /**
     * Partial update. Every parameter except the identifiers is optional; a null leaves
     * the column as it was. {@code encryptedSecretJson} is the only trigger for a secret
     * rotation, so passing null keeps both the stored secret and its version.
     *
     * @return the updated profile, or {@code null} when it does not exist
     */
    public CredentialProfile update(UpdateCredentialProfileParams params) {
        UUID profileId = toUuid(params.id());
        if (profileId == null) {
            return null;
        }
        Tuple tuple = Tuple.tuple()
                .addString(params.tenantCode())
                .addUUID(profileId)
                .addString(params.displayName())
                .addString(params.environment())
                .addValue(params.publicConfig() == null ? null : new JsonObject(params.publicConfig()))
                .addString(params.encryptedSecretJson())
                .addString(params.secretPreview())
                .addString(params.updatedBy());
        return first(client().preparedQuery(UPDATE_PROFILE).execute(tuple).await().indefinitely());
    }

    public CredentialProfile updateTestResult(
            String tenantCode, String id, OffsetDateTime testedAt, Boolean testResult) {
        UUID profileId = toUuid(id);
        if (profileId == null) {
            return null;
        }
        return first(client().preparedQuery(UPDATE_TEST_RESULT)
                .execute(Tuple.of(tenantCode, profileId, testedAt, testResult))
                .await().indefinitely());
    }

    /** @return true when a row was deactivated, false when the id matched nothing active */
    public boolean softDelete(String tenantCode, String id, String deletedBy) {
        UUID profileId = toUuid(id);
        if (profileId == null) {
            return false;
        }
        return client().preparedQuery(SOFT_DELETE)
                .execute(Tuple.of(tenantCode, profileId, deletedBy))
                .await().indefinitely()
                .rowCount() > 0;
    }

    public CredentialProfile create(CredentialProfile profile) {
        Tuple params = Tuple.tuple()
                .addUUID(UUID.fromString(profile.id()))
                .addString(profile.tenantCode())
                .addString(profile.displayName())
                .addString(profile.credentialType().name())
                .addString(profile.authType().name())
                .addString(profile.environment())
                .addJsonObject(toJson(profile.publicConfig()))
                .addString(profile.encryptedSecretJson())
                .addString(profile.secretPreview())
                .addInteger(profile.secretVersion())
                .addOffsetDateTime(profile.createdAt())
                .addOffsetDateTime(profile.updatedAt())
                .addString(profile.createdBy())
                .addString(profile.updatedBy());
        return mapRow(client().preparedQuery(INSERT)
                .execute(params)
                .await().indefinitely()
                .iterator().next());
    }

    private Pool client() {
        return clientInstance.get();
    }

    private CredentialProfile first(RowSet<Row> rows) {
        var iterator = rows.iterator();
        return iterator.hasNext() ? mapRow(iterator.next()) : null;
    }

    private CredentialProfile mapRow(Row row) {
        return new CredentialProfile(
                row.getUUID("id").toString(),
                row.getString("tenant_code"),
                row.getString("display_name"),
                CredentialType.valueOf(row.getString("credential_type")),
                AuthType.valueOf(row.getString("auth_type")),
                row.getString("environment"),
                toMap(row.getJsonObject("public_config")),
                row.getString("encrypted_secret_json"),
                row.getString("secret_preview"),
                row.getInteger("secret_version"),
                row.getOffsetDateTime("last_tested_at"),
                row.getBoolean("last_test_result"),
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

    private Map<String, Object> toMap(JsonObject value) {
        return value == null ? Map.of() : new LinkedHashMap<>(value.getMap());
    }
}
