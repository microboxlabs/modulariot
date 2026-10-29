package com.microboxlabs.miot.integrations.orgaccount;

import io.smallrye.mutiny.Uni;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.Duration;
import java.util.Optional;

/** Blocking access with a bounded wait, like {@code ModelProviderRepository}. */
@ApplicationScoped
public class OrgServiceAccountRepository {

    private static final Duration QUERY_TIMEOUT = Duration.ofSeconds(10);
    private static final String COLUMNS = "tenant_code, project_id, account_id, email, unique_id, disabled,"
            + " created_at, created_by, updated_at, updated_by";

    private static final String FIND = "SELECT " + COLUMNS
            + " FROM miot_integrations.org_service_accounts WHERE tenant_code = $1";

    private static final String INSERT = "INSERT INTO miot_integrations.org_service_accounts"
            + " (tenant_code, project_id, account_id, email, unique_id, disabled, created_by, updated_by)"
            + " VALUES ($1, $2, $3, $4, $5, $6, $7, $7) RETURNING " + COLUMNS;

    private static final String SET_DISABLED = "UPDATE miot_integrations.org_service_accounts"
            + " SET disabled = $2, updated_by = $3, updated_at = now() WHERE tenant_code = $1 RETURNING " + COLUMNS;

    private final Instance<Pool> pool;

    @Inject
    public OrgServiceAccountRepository(Instance<Pool> pool) {
        this.pool = pool;
    }

    /** For unit tests that override every method. */
    protected OrgServiceAccountRepository() {
        this.pool = null;
    }

    public Optional<OrgServiceAccount> find(String tenantCode) {
        RowSet<Row> rows = execute(FIND, Tuple.of(tenantCode));
        return rows.iterator().hasNext() ? Optional.of(map(rows.iterator().next())) : Optional.empty();
    }

    public OrgServiceAccount insert(OrgServiceAccount account) {
        Tuple params = Tuple.tuple()
                .addString(account.tenantCode())
                .addString(account.projectId())
                .addString(account.accountId())
                .addString(account.email())
                .addString(account.uniqueId())
                .addBoolean(account.disabled())
                .addString(account.createdBy());
        return map(execute(INSERT, params).iterator().next());
    }

    public OrgServiceAccount setDisabled(String tenantCode, boolean disabled, String actor) {
        return map(execute(SET_DISABLED, Tuple.of(tenantCode, disabled, actor)).iterator().next());
    }

    private RowSet<Row> execute(String sql, Tuple params) {
        Uni<RowSet<Row>> query = pool.get().preparedQuery(sql).execute(params);
        return query.await().atMost(QUERY_TIMEOUT);
    }

    private static OrgServiceAccount map(Row row) {
        return new OrgServiceAccount(
                row.getString("tenant_code"),
                row.getString("project_id"),
                row.getString("account_id"),
                row.getString("email"),
                row.getString("unique_id"),
                row.getBoolean("disabled"),
                row.getOffsetDateTime("created_at"),
                row.getString("created_by"),
                row.getOffsetDateTime("updated_at"),
                row.getString("updated_by"));
    }
}
