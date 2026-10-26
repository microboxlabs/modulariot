package com.microboxlabs.miot.core.content;

import com.microboxlabs.miot.core.db.PgTx;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

/** {@link ContentStore} on the modulith database. Joins the open {@link PgTx} transaction. */
@ApplicationScoped
public class PgContentStore implements ContentStore {

    private static final String COLUMNS =
            "id, tenant_code, content_url, name, mimetype, size, sha256, owner, created_at, created_by";

    private final Supplier<Pool> pool;

    @Inject
    PgContentStore(Instance<Pool> pool) {
        this(pool::get);
    }

    public PgContentStore(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public Content insert(Content c) {
        return query("INSERT INTO miot_core.content (" + COLUMNS + ")"
                + " VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), $9) RETURNING " + COLUMNS,
                Tuple.tuple().addUUID(UUID.fromString(c.id())).addString(c.tenantCode()).addString(c.contentUrl())
                        .addString(c.name()).addString(c.mimetype()).addLong(c.size()).addString(c.sha256())
                        .addString(c.owner()).addString(c.createdBy()))
                .stream().map(PgContentStore::content).findFirst().orElseThrow();
    }

    @Override
    public Optional<Content> find(String tenantCode, UUID id) {
        return query("SELECT " + COLUMNS + " FROM miot_core.content WHERE tenant_code = $1 AND id = $2" + PgTx.lock(),
                Tuple.of(tenantCode, id)).stream().map(PgContentStore::content).findFirst();
    }

    @Override
    public boolean owner(String tenantCode, UUID id, String owner) {
        return query("UPDATE miot_core.content SET owner = $3 WHERE tenant_code = $1 AND id = $2",
                Tuple.of(tenantCode, id, owner)).rowCount() > 0;
    }

    @Override
    public List<Content> unowned(OffsetDateTime before, int limit) {
        return query("SELECT " + COLUMNS + " FROM miot_core.content WHERE owner IS NULL AND created_at < $1"
                        + " ORDER BY created_at LIMIT $2 FOR UPDATE SKIP LOCKED", Tuple.of(before, limit))
                .stream().map(PgContentStore::content).toList();
    }

    @Override
    public boolean deleteUnowned(String tenantCode, UUID id, OffsetDateTime before) {
        return query("DELETE FROM miot_core.content WHERE tenant_code = $1 AND id = $2"
                        + " AND owner IS NULL AND created_at < $3", Tuple.of(tenantCode, id, before)).rowCount() > 0;
    }

    private RowSet<Row> query(String sql, Tuple params) {
        try {
            return PgTx.client(pool.get()).preparedQuery(sql).execute(params).await().atMost(PgTx.TIMEOUT);
        } catch (PgException e) {
            PgTx.statementFailed();
            throw e;
        }
    }

    private static Content content(Row r) {
        OffsetDateTime created = r.getOffsetDateTime("created_at");
        return new Content(r.getUUID("id").toString(), r.getString("tenant_code"), r.getString("content_url"),
                r.getString("name"), r.getString("mimetype"), r.getLong("size"), r.getString("sha256"),
                r.getString("owner"), created == null ? null : created.withOffsetSameInstant(ZoneOffset.UTC),
                r.getString("created_by"));
    }
}
