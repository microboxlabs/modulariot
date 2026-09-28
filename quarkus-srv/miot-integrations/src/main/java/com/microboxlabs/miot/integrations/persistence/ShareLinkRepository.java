package com.microboxlabs.miot.integrations.persistence;

import com.microboxlabs.miot.integrations.domain.ShareLink;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/** Storage for share links. Every read is scoped by tenant and hides revoked links. */
@ApplicationScoped
public class ShareLinkRepository extends BoundedPgRepository {

    private static final String COLUMNS = "token, tenant_code, target_type, target_id, access, created_by, created_at";

    private static final String INSERT = """
            INSERT INTO miot_integrations.share_link (token, tenant_code, target_type, target_id, access, created_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (tenant_code, target_type, target_id) WHERE revoked_at IS NULL DO NOTHING
            RETURNING %s""".formatted(COLUMNS);

    private static final String FIND_ACTIVE = """
            SELECT %s
            FROM miot_integrations.share_link
            WHERE token = $1 AND tenant_code = $2 AND revoked_at IS NULL""".formatted(COLUMNS);

    private static final String LIST_ACTIVE_FOR_TARGET = """
            SELECT %s
            FROM miot_integrations.share_link
            WHERE tenant_code = $1 AND target_type = $2 AND target_id = $3 AND revoked_at IS NULL
            ORDER BY created_at DESC""".formatted(COLUMNS);

    private static final String REVOKE = """
            UPDATE miot_integrations.share_link
            SET revoked_at = now()
            WHERE token = $1 AND tenant_code = $2 AND revoked_at IS NULL""";

    @Inject
    public ShareLinkRepository(
            Instance<Pool> clientInstance,
            @ConfigProperty(name = "miot.stories.query-timeout", defaultValue = "10s") Duration queryTimeout) {
        super(clientInstance, queryTimeout);
    }

    /** For unit tests, which subclass with no pool and never reach the wire. */
    protected ShareLinkRepository() {
        super(null, DEFAULT_QUERY_TIMEOUT);
    }

    /** Null when the target already has an active link, e.g. one a concurrent request just made. */
    public ShareLink insert(ShareLink link) {
        Tuple params = Tuple.tuple()
                .addString(link.token())
                .addString(link.tenantCode())
                .addString(link.targetType())
                .addUUID(UUID.fromString(link.targetId()))
                .addString(link.access())
                .addString(link.createdBy());
        Row row = first(execute(INSERT, params));
        return row == null ? null : map(row);
    }

    public ShareLink findActive(String token, String tenantCode) {
        Row row = first(execute(FIND_ACTIVE, Tuple.of(token, tenantCode)));
        return row == null ? null : map(row);
    }

    public List<ShareLink> listActive(String tenantCode, String targetType, String targetId) {
        List<ShareLink> out = new ArrayList<>();
        for (Row row : execute(LIST_ACTIVE_FOR_TARGET,
                Tuple.of(tenantCode, targetType, UUID.fromString(targetId)))) {
            out.add(map(row));
        }
        return out;
    }

    public boolean revoke(String token, String tenantCode) {
        return execute(REVOKE, Tuple.of(token, tenantCode)).rowCount() > 0;
    }

    private static ShareLink map(Row row) {
        return new ShareLink(
                row.getString("token"),
                row.getString("tenant_code"),
                row.getString("target_type"),
                row.getUUID("target_id").toString(),
                row.getString("access"),
                row.getString("created_by"),
                row.getOffsetDateTime("created_at"));
    }
}
