package com.microboxlabs.miot.integrations.persistence;

import com.microboxlabs.miot.integrations.domain.HarnessThread;
import com.microboxlabs.miot.integrations.domain.HarnessThreadMessage;
import com.microboxlabs.miot.integrations.domain.HarnessThreadShare;
import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Storage for the harness chat panel's threads (Vert.x reactive PG, blocking via
 * {@code await().indefinitely()}, JSONB via {@code JsonObject} — same shape as
 * {@code InteractionEpisodeRepository}). The {@code protected} constructor lets
 * unit tests subclass with a null pool.
 *
 * <p>Every read is scoped by {@code tenant_code} in the SQL itself rather than
 * filtered afterwards, and expired or deleted threads are excluded there too, so
 * a caller cannot reach one by asking for it directly.
 */
@ApplicationScoped
public class HarnessThreadRepository {

    private static final String CREATED_AT = "created_at";

    private static final String THREAD_COLUMNS =
            "id, tenant_code, owner_id, title, expires_at, last_message_at, created_at, updated_at";

    /** A thread is visible while it is neither soft-deleted nor past its expiry. */
    private static final String LIVE = "deleted_at IS NULL AND (expires_at IS NULL OR expires_at > now())";

    // Creating a thread is idempotent: the panel mints the id up front and
    // creates the row lazily on the first message, so a retry must not fail.
    // The guards on the UPDATE half stop one user's retry from taking over
    // another user's thread if the two ever minted the same id, and stop a
    // deleted or expired thread being written back to life — `find` hides
    // those, so messages appended to one would be unreadable and would leave
    // with it when the purge runs.
    private static final String UPSERT_THREAD = """
            INSERT INTO miot_integrations.harness_thread (
                id, tenant_code, owner_id, title, expires_at, last_message_at
            ) VALUES ($1, $2, $3, $4, $5, now())
            ON CONFLICT (id) DO UPDATE
                SET title = COALESCE(EXCLUDED.title, miot_integrations.harness_thread.title),
                    expires_at = COALESCE(EXCLUDED.expires_at, miot_integrations.harness_thread.expires_at),
                    updated_at = now()
                WHERE miot_integrations.harness_thread.tenant_code = EXCLUDED.tenant_code
                  AND miot_integrations.harness_thread.owner_id = EXCLUDED.owner_id
                  AND miot_integrations.harness_thread.deleted_at IS NULL
                  AND (miot_integrations.harness_thread.expires_at IS NULL
                       OR miot_integrations.harness_thread.expires_at > now())
            RETURNING %s""".formatted(THREAD_COLUMNS);

    private static final String LIST_OWNED = """
            SELECT %s
            FROM miot_integrations.harness_thread
            WHERE tenant_code = $1 AND owner_id = $2 AND %s
            ORDER BY last_message_at DESC
            LIMIT $3""".formatted(THREAD_COLUMNS, LIVE);

    private static final String LIST_SHARED_WITH = """
            SELECT t.id, t.tenant_code, t.owner_id, t.title, t.expires_at,
                   t.last_message_at, t.created_at, t.updated_at
            FROM miot_integrations.harness_thread t
            JOIN miot_integrations.harness_thread_share s ON s.thread_id = t.id
            WHERE t.tenant_code = $1 AND s.principal = $2
              AND t.deleted_at IS NULL AND (t.expires_at IS NULL OR t.expires_at > now())
            ORDER BY t.last_message_at DESC
            LIMIT $3""";

    private static final String FIND_THREAD = """
            SELECT %s
            FROM miot_integrations.harness_thread
            WHERE id = $1 AND tenant_code = $2 AND %s""".formatted(THREAD_COLUMNS, LIVE);

    private static final String UPDATE_THREAD = """
            UPDATE miot_integrations.harness_thread
            SET title = COALESCE($3, title),
                expires_at = CASE WHEN $5 THEN NULL ELSE COALESCE($4, expires_at) END,
                updated_at = now()
            WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL
            RETURNING %s""".formatted(THREAD_COLUMNS);

    // Soft delete: the row stays until the purge job collects it, so a delete
    // racing an in-flight run cannot orphan that run's message writes.
    private static final String SOFT_DELETE_THREAD = """
            UPDATE miot_integrations.harness_thread
            SET deleted_at = now(), updated_at = now()
            WHERE id = $1 AND tenant_code = $2 AND owner_id = $3 AND deleted_at IS NULL""";

    // One statement, so the message and the thread's activity stamp cannot
    // disagree: as two autocommit round trips, a failure between them left the
    // message stored, the endpoint reporting an error, and the thread ordered
    // by a stale last_message_at.
    private static final String UPSERT_MESSAGE = """
            WITH upserted AS (
                INSERT INTO miot_integrations.harness_thread_message (
                    thread_id, id, parent_id, format, payload
                ) VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (thread_id, id) DO UPDATE
                    SET parent_id = EXCLUDED.parent_id,
                        format = EXCLUDED.format,
                        payload = EXCLUDED.payload
                RETURNING thread_id, id, parent_id, format, payload, created_at
            ), touched AS (
                UPDATE miot_integrations.harness_thread
                SET last_message_at = now(), updated_at = now()
                WHERE id = $1
            )
            SELECT thread_id, id, parent_id, format, payload, created_at FROM upserted""";

    // `seq` rather than created_at: a run appends several messages inside the
    // same millisecond and the client replays them in append order.
    private static final String LIST_MESSAGES = """
            SELECT thread_id, id, parent_id, format, payload, created_at
            FROM miot_integrations.harness_thread_message
            WHERE thread_id = $1
            ORDER BY seq ASC""";

    private static final String UPSERT_SHARE = """
            INSERT INTO miot_integrations.harness_thread_share (
                thread_id, principal, permission, created_by
            ) VALUES ($1, $2, $3, $4)
            ON CONFLICT (thread_id, principal) DO UPDATE
                SET permission = EXCLUDED.permission
            RETURNING thread_id, principal, permission, created_by, created_at""";

    private static final String DELETE_SHARE = """
            DELETE FROM miot_integrations.harness_thread_share
            WHERE thread_id = $1 AND principal = $2""";

    // The listing needs shares for every thread it returns, and one query per
    // thread would be up to 200 sequential round trips for one request.
    private static final String LIST_SHARES_FOR = """
            SELECT thread_id, principal, permission, created_by, created_at
            FROM miot_integrations.harness_thread_share
            WHERE thread_id = ANY($1)
            ORDER BY thread_id, principal""";

    private static final String LIST_SHARES = """
            SELECT thread_id, principal, permission, created_by, created_at
            FROM miot_integrations.harness_thread_share
            WHERE thread_id = $1
            ORDER BY principal""";

    // Retention: expired threads go, and so do soft-deleted ones once the grace
    // window passes. Messages and shares follow via ON DELETE CASCADE.
    private static final String PURGE_EXPIRED = """
            DELETE FROM miot_integrations.harness_thread
            WHERE (expires_at IS NOT NULL AND expires_at <= now())
               OR (deleted_at IS NOT NULL AND deleted_at <= $1)""";

    private final Instance<Pool> clientInstance;

    protected HarnessThreadRepository(Instance<Pool> clientInstance) {
        this.clientInstance = clientInstance;
    }

    /** Creates the thread, or renames an existing one the same owner holds.
     * Returns null when the id belongs to someone else. */
    public HarnessThread upsert(HarnessThread thread) {
        Tuple params = Tuple.tuple()
                .addUUID(UUID.fromString(thread.id()))
                .addString(thread.tenantCode())
                .addString(thread.ownerId())
                .addString(thread.title())
                .addValue(thread.expiresAt());
        return firstThread(execute(UPSERT_THREAD, params));
    }

    public List<HarnessThread> listOwned(String tenantCode, String ownerId, int limit) {
        return threads(execute(LIST_OWNED, Tuple.of(tenantCode, ownerId, limit)));
    }

    public List<HarnessThread> listSharedWith(String tenantCode, String principal, int limit) {
        return threads(execute(LIST_SHARED_WITH, Tuple.of(tenantCode, principal, limit)));
    }

    public HarnessThread find(String threadId, String tenantCode) {
        return firstThread(execute(FIND_THREAD, Tuple.of(UUID.fromString(threadId), tenantCode)));
    }

    /** Applies a partial update. Returns null when the caller does not own the
     * thread, since the owner guard lives in the WHERE clause. */
    public HarnessThread update(
            String threadId, String ownerId, String title, OffsetDateTime expiresAt, boolean clearExpiry) {
        Tuple params = Tuple.tuple()
                .addUUID(UUID.fromString(threadId))
                .addString(ownerId)
                .addString(title)
                .addValue(expiresAt)
                .addBoolean(clearExpiry);
        return firstThread(execute(UPDATE_THREAD, params));
    }

    /** @return true when a row was actually marked deleted. */
    public boolean softDelete(String threadId, String tenantCode, String ownerId) {
        return execute(SOFT_DELETE_THREAD,
                Tuple.of(UUID.fromString(threadId), tenantCode, ownerId)).rowCount() > 0;
    }

    public HarnessThreadMessage appendMessage(HarnessThreadMessage message) {
        Tuple params = Tuple.tuple()
                .addUUID(UUID.fromString(message.threadId()))
                .addString(message.id())
                .addString(message.parentId())
                .addString(message.format())
                .addJsonObject(toJson(message.payload()));
        return firstMessage(execute(UPSERT_MESSAGE, params));
    }

    public List<HarnessThreadMessage> listMessages(String threadId) {
        RowSet<Row> rows = execute(LIST_MESSAGES, Tuple.of(UUID.fromString(threadId)));
        List<HarnessThreadMessage> out = new ArrayList<>();
        for (Row row : rows) {
            out.add(mapMessage(row));
        }
        return out;
    }

    public HarnessThreadShare upsertShare(HarnessThreadShare share) {
        Tuple params = Tuple.of(
                UUID.fromString(share.threadId()),
                share.principal(),
                share.permission(),
                share.createdBy());
        RowSet<Row> rows = execute(UPSERT_SHARE, params);
        return rows.iterator().hasNext() ? mapShare(rows.iterator().next()) : null;
    }

    public boolean deleteShare(String threadId, String principal) {
        return execute(DELETE_SHARE, Tuple.of(UUID.fromString(threadId), principal)).rowCount() > 0;
    }

    /** Shares for several threads at once, grouped by thread id. */
    public Map<String, List<HarnessThreadShare>> listSharesFor(List<String> threadIds) {
        if (threadIds.isEmpty()) {
            return Map.of();
        }
        UUID[] ids = threadIds.stream().map(UUID::fromString).toArray(UUID[]::new);
        RowSet<Row> rows = execute(LIST_SHARES_FOR, Tuple.tuple().addArrayOfUUID(ids));
        Map<String, List<HarnessThreadShare>> out = new LinkedHashMap<>();
        for (Row row : rows) {
            HarnessThreadShare share = mapShare(row);
            out.computeIfAbsent(share.threadId(), key -> new ArrayList<>()).add(share);
        }
        return out;
    }

    public List<HarnessThreadShare> listShares(String threadId) {
        RowSet<Row> rows = execute(LIST_SHARES, Tuple.of(UUID.fromString(threadId)));
        List<HarnessThreadShare> out = new ArrayList<>();
        for (Row row : rows) {
            out.add(mapShare(row));
        }
        return out;
    }

    /** Drops expired threads and soft-deleted ones older than the grace cutoff.
     * @return how many threads went. */
    public int purge(OffsetDateTime deletedBefore) {
        return execute(PURGE_EXPIRED, Tuple.of(deletedBefore)).rowCount();
    }

    private RowSet<Row> execute(String sql, Tuple params) {
        return client().preparedQuery(sql).execute(params).await().indefinitely();
    }

    private Pool client() {
        return clientInstance.get();
    }

    private List<HarnessThread> threads(RowSet<Row> rows) {
        List<HarnessThread> out = new ArrayList<>();
        for (Row row : rows) {
            out.add(mapThread(row));
        }
        return out;
    }

    private HarnessThread firstThread(RowSet<Row> rows) {
        return rows.iterator().hasNext() ? mapThread(rows.iterator().next()) : null;
    }

    private HarnessThreadMessage firstMessage(RowSet<Row> rows) {
        return rows.iterator().hasNext() ? mapMessage(rows.iterator().next()) : null;
    }

    private HarnessThread mapThread(Row row) {
        return new HarnessThread(
                row.getUUID("id").toString(),
                row.getString("tenant_code"),
                row.getString("owner_id"),
                row.getString("title"),
                row.getOffsetDateTime("expires_at"),
                row.getOffsetDateTime("last_message_at"),
                row.getOffsetDateTime(CREATED_AT),
                row.getOffsetDateTime("updated_at"));
    }

    private HarnessThreadMessage mapMessage(Row row) {
        return new HarnessThreadMessage(
                row.getUUID("thread_id").toString(),
                row.getString("id"),
                row.getString("parent_id"),
                row.getString("format"),
                toMap(row.getJsonObject("payload")),
                row.getOffsetDateTime(CREATED_AT));
    }

    private HarnessThreadShare mapShare(Row row) {
        return new HarnessThreadShare(
                row.getUUID("thread_id").toString(),
                row.getString("principal"),
                row.getString("permission"),
                row.getString("created_by"),
                row.getOffsetDateTime(CREATED_AT));
    }

    private JsonObject toJson(Map<String, Object> value) {
        return new JsonObject(value == null ? Map.of() : value);
    }

    private Map<String, Object> toMap(JsonObject value) {
        return value == null ? Map.of() : new LinkedHashMap<>(value.getMap());
    }
}
