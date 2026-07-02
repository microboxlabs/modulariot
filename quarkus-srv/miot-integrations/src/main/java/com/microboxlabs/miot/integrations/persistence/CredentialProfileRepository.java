package com.microboxlabs.miot.integrations.persistence;

import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.domain.CredentialProfile;
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
public class CredentialProfileRepository {

    private static final String SELECT_BY_TENANT = """
            SELECT id, tenant_code, display_name, auth_type, public_config, encrypted_secret_json,
                   secret_preview, secret_version, created_at, updated_at
            FROM miot_integrations.credential_profiles
            WHERE tenant_code = $1 AND active
            ORDER BY display_name
            """;

    private static final String SELECT_BY_ID = """
            SELECT id, tenant_code, display_name, auth_type, public_config, encrypted_secret_json,
                   secret_preview, secret_version, created_at, updated_at
            FROM miot_integrations.credential_profiles
            WHERE tenant_code = $1 AND id = $2 AND active
            """;

    private static final String INSERT = """
            INSERT INTO miot_integrations.credential_profiles (
                id, tenant_code, display_name, auth_type, public_config, encrypted_secret_json,
                secret_preview, secret_version, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id, tenant_code, display_name, auth_type, public_config, encrypted_secret_json,
                      secret_preview, secret_version, created_at, updated_at
            """;

    private static final String UPDATE_SECRET = """
            UPDATE miot_integrations.credential_profiles
            SET encrypted_secret_json = $3, secret_preview = $4,
                secret_version = secret_version + 1, updated_at = now()
            WHERE tenant_code = $1 AND id = $2 AND active
            RETURNING id, tenant_code, display_name, auth_type, public_config, encrypted_secret_json,
                      secret_preview, secret_version, created_at, updated_at
            """;

    private final Instance<Pool> clientInstance;

    CredentialProfileRepository(Instance<Pool> clientInstance) {
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
        if (id == null || id.isBlank()) {
            return null;
        }
        UUID profileId;
        try {
            profileId = UUID.fromString(id);
        } catch (IllegalArgumentException e) {
            return null;
        }
        var rows = client().preparedQuery(SELECT_BY_ID)
                .execute(Tuple.of(tenantCode, profileId))
                .await().indefinitely();
        var iterator = rows.iterator();
        return iterator.hasNext() ? mapRow(iterator.next()) : null;
    }

    public CredentialProfile updateSecret(
            String tenantCode, String id, String encryptedSecretJson, String secretPreview) {
        if (id == null || id.isBlank()) {
            return null;
        }
        UUID profileId;
        try {
            profileId = UUID.fromString(id);
        } catch (IllegalArgumentException e) {
            return null;
        }
        var rows = client().preparedQuery(UPDATE_SECRET)
                .execute(Tuple.of(tenantCode, profileId, encryptedSecretJson, secretPreview))
                .await().indefinitely();
        var iterator = rows.iterator();
        return iterator.hasNext() ? mapRow(iterator.next()) : null;
    }

    public CredentialProfile create(CredentialProfile profile) {
        Tuple params = Tuple.tuple()
                .addUUID(UUID.fromString(profile.id()))
                .addString(profile.tenantCode())
                .addString(profile.displayName())
                .addString(profile.authType().name())
                .addJsonObject(toJson(profile.publicConfig()))
                .addString(profile.encryptedSecretJson())
                .addString(profile.secretPreview())
                .addInteger(profile.secretVersion())
                .addOffsetDateTime(profile.createdAt())
                .addOffsetDateTime(profile.updatedAt());
        return mapRow(client().preparedQuery(INSERT)
                .execute(params)
                .await().indefinitely()
                .iterator().next());
    }

    private Pool client() {
        return clientInstance.get();
    }

    private CredentialProfile mapRow(Row row) {
        return new CredentialProfile(
                row.getUUID("id").toString(),
                row.getString("tenant_code"),
                row.getString("display_name"),
                AuthType.valueOf(row.getString("auth_type")),
                toMap(row.getJsonObject("public_config")),
                row.getString("encrypted_secret_json"),
                row.getString("secret_preview"),
                row.getInteger("secret_version"),
                row.getOffsetDateTime("created_at"),
                row.getOffsetDateTime("updated_at"));
    }

    private JsonObject toJson(Map<String, Object> value) {
        return new JsonObject(value == null ? Map.of() : value);
    }

    private Map<String, Object> toMap(JsonObject value) {
        return value == null ? Map.of() : new LinkedHashMap<>(value.getMap());
    }
}
