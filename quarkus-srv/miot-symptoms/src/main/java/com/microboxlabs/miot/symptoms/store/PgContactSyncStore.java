package com.microboxlabs.miot.symptoms.store;

import static com.microboxlabs.miot.symptoms.catalog.store.PgJson.QUERY_TIMEOUT;
import static com.microboxlabs.miot.symptoms.store.PgIds.query;

import com.microboxlabs.miot.symptoms.catalog.store.PgJson;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.SqlConnection;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.function.Supplier;

/** {@link ContactSyncStore} on the modulith database, schema {@code miot_symptoms}. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class PgContactSyncStore implements ContactSyncStore {

    private final Supplier<Pool> pool;

    @Inject
    PgContactSyncStore(Instance<Pool> pool) {
        this(pool::get);
    }

    PgContactSyncStore(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public Optional<OffsetDateTime> syncedUntil(String tenantCode, String source) {
        return query(pool.get(), """
                SELECT synced_until FROM miot_symptoms.contact_sync WHERE tenant_code = $1 AND source = $2""",
                Tuple.of(tenantCode, source)).stream().findFirst().map(r -> PgJson.time(r, "synced_until"));
    }

    @Override
    public void save(String tenantCode, String source, OffsetDateTime syncedUntil) {
        query(pool.get(), """
                INSERT INTO miot_symptoms.contact_sync (tenant_code, source, synced_until) VALUES ($1, $2, $3)
                ON CONFLICT (tenant_code, source) DO UPDATE SET synced_until = EXCLUDED.synced_until, updated_at = now()
                """, Tuple.of(tenantCode, source, syncedUntil));
    }

    @Override
    public List<String> tenants(String source) {
        return query(pool.get(), "SELECT tenant_code FROM miot_symptoms.contact_sync WHERE source = $1 "
                + "ORDER BY tenant_code", Tuple.of(source)).stream().map(r -> r.getString("tenant_code")).toList();
    }

    /** An open transaction pins the lock's connection even through a transaction-mode pooler. */
    @Override
    public <T> Optional<T> exclusively(String name, Supplier<T> work) {
        SqlConnection conn = pool.get().getConnection().await().atMost(QUERY_TIMEOUT);
        try {
            var transaction = conn.begin().await().atMost(QUERY_TIMEOUT);
            try {
                boolean held = query(conn, "SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0))", Tuple.of(name))
                        .iterator().next().getBoolean(0);
                if (!held) {
                    return Optional.empty();
                }
                return Optional.ofNullable(work.get());
            } finally {
                transaction.rollback().await().atMost(QUERY_TIMEOUT);
            }
        } finally {
            conn.close().await().atMost(QUERY_TIMEOUT);
        }
    }
}
